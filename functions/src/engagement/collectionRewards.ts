// ============================================
// LUMINA — COLETAR RECOMPENSA DE COLEÇÃO v1.1
// functions/src/engagement/collectionRewards.ts
//
// POR QUE EXISTE (10/10/2026):
// A coleção completa creditava os fragmentos direto na CARTEIRA,
// sem nenhum aviso visível — parecia que não tinha pago. Decisão
// de Kaio: a coleção completa mostra um botão "Coletar", e os
// fragmentos vão para o COFRE, com um modal de comemoração no app.
//
// O AchievementProcessor (v1.2) só marca a coleção como completa
// (título e badge na hora). Esta callable entrega os fragmentos.
//
// REGRAS (decididas por Kaio):
//  • Deposita no Cofre (wallets.vaultFragments) o valor INTEIRO,
//    mesmo acima do limite de 5.000 — como as recompensas de nível.
//  • NÃO abre o ciclo de 48h. Se o Cofre não tem ciclo aberto, os
//    fragmentos podem ser sacados na hora; o próximo depósito de
//    visita/curtida/sintonia abre o ciclo normalmente (VaultService).
//  • Uma vez por coleção: achievements.claimedCollections.
//
// SEGURANÇA:
//  • uid vem de request.auth — nunca do payload.
//  • collectionId validado contra o COLLECTIONS_CATALOG; o valor
//    pago vem do catálogo no servidor, nunca do app.
//  • A coleção precisa estar completa no servidor. Se todas as
//    conquistas estão desbloqueadas mas a coleção nunca foi marcada
//    (a checagem roda fora da transação da conquista e pode ter
//    falhado), esta função completa a coleção também — reparo.
//  • runTransaction: leitura do usuário e da carteira, conferência
//    de "já coletada" e crédito na mesma transação. Toque duplo ou
//    duas abas: a segunda vê claimedCollections e não paga.
//  • Idempotente: coletar de novo devolve alreadyClaimed, sem erro.
//  • Ledger imutável + auditLogFinanceiro, como todo crédito.
//
// v1.1 (11/10/2026): a coleta tira a coleção de
// wallets.collectionsToClaim (bolinha "para coletar" do Perfil).
// Coletar de novo também limpa — corrige uma lista que tenha
// ficado para trás.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS_CATALOG } from '../config/collectionsCatalog';
import { PrestigeService }     from './prestigeService';
import { auditLogFinanceiro }  from '../utils/auditLogFinanceiro';

const db = admin.firestore();

/** Mesmo valor do VaultService — só para avisar "Cofre cheio". */
const VAULT_MAX_FRAGMENTS = 5000;
const COLLECTION_ID_PATTERN = /^[A-Z0-9_]{1,40}$/;

interface ClaimCollectionRequest {
  collectionId?: unknown;
}

export interface ClaimCollectionResult {
  success:        true;
  alreadyClaimed: boolean;
  collectionId:   string;
  fragments:      number;
  vaultFragments: number;
}

interface TxOutcome extends ClaimCollectionResult {
  repairedCompletion: boolean;
}

export const claimCollectionReward = functions.onCall(
  { region: 'us-central1' },
  async (request): Promise<ClaimCollectionResult> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new functions.HttpsError('unauthenticated', 'Não autenticado.');
    }

    // ── Validação do pedido ──
    const rawId = (request.data as ClaimCollectionRequest | undefined)?.collectionId;
    if (typeof rawId !== 'string' || !COLLECTION_ID_PATTERN.test(rawId)) {
      throw new functions.HttpsError('invalid-argument', 'Coleção inválida.');
    }
    const collectionId = rawId;
    // hasOwnProperty: impede ids como "constructor" de passarem.
    const col = Object.prototype.hasOwnProperty.call(COLLECTIONS_CATALOG, collectionId)
      ? COLLECTIONS_CATALOG[collectionId]
      : undefined;
    if (!col) {
      throw new functions.HttpsError('not-found', 'Coleção não encontrada.');
    }
    if (col.reward.fragments <= 0) {
      throw new functions.HttpsError('failed-precondition', 'Esta coleção não tem fragmentos para coletar.');
    }

    const userRef   = db.collection('users').doc(uid);
    const walletRef = db.collection('wallets').doc(uid);
    const fragments = col.reward.fragments;

    const outcome = await db.runTransaction<TxOutcome>(async (t) => {
      // ── 1. LEITURAS ──
      const [userSnap, walletSnap] = await Promise.all([t.get(userRef), t.get(walletRef)]);
      if (!userSnap.exists) {
        throw new functions.HttpsError('not-found', 'Usuário não encontrado.');
      }

      const ach = userSnap.data()?.achievements ?? {};
      const unlocked:  string[] = Array.isArray(ach.unlocked)             ? ach.unlocked             : [];
      const completed: string[] = Array.isArray(ach.completedCollections) ? ach.completedCollections : [];
      const claimed:   string[] = Array.isArray(ach.claimedCollections)   ? ach.claimedCollections   : [];

      const wallet      = walletSnap.data() ?? {};
      const vaultBefore = typeof wallet.vaultFragments === 'number' ? wallet.vaultFragments : 0;

      if (claimed.includes(collectionId)) {
        if (Array.isArray(wallet.collectionsToClaim) && wallet.collectionsToClaim.includes(collectionId)) {
          t.set(walletRef, {
            collectionsToClaim: FieldValue.arrayRemove(collectionId),
            updatedAt:          FieldValue.serverTimestamp(),
          }, { merge: true });
        }
        return {
          success: true, alreadyClaimed: true, collectionId,
          fragments: 0, vaultFragments: vaultBefore, repairedCompletion: false,
        };
      }

      const markedComplete = completed.includes(collectionId);
      const allUnlocked    = col.achievementIds.every(id => unlocked.includes(id));
      if (!markedComplete && !allUnlocked) {
        throw new functions.HttpsError('failed-precondition', 'Complete todas as conquistas da coleção antes de coletar.');
      }

      const vaultAfter = vaultBefore + fragments;

      // ── 2. ESCRITAS ──
      const achievementsPatch: Record<string, unknown> = {
        claimedCollections:  FieldValue.arrayUnion(collectionId),
        collectionClaimedAt: { [collectionId]: FieldValue.serverTimestamp() },
      };
      // Reparo: conquistas todas desbloqueadas, coleção nunca marcada.
      if (!markedComplete) {
        achievementsPatch.completedCollections  = FieldValue.arrayUnion(collectionId);
        achievementsPatch.collectionCompletedAt = { [collectionId]: FieldValue.serverTimestamp() };
      }
      // Objeto aninhado: set() com ponto no nome cria campo literal.
      t.set(userRef, { achievements: achievementsPatch }, { merge: true });

      if (!markedComplete && col.reward.badge) {
        t.set(userRef, {
          progression: { unlockedItems: { [col.reward.badge]: true } },
        }, { merge: true });
      }
      if (!markedComplete && col.reward.title) {
        t.set(userRef, {
          progression: { availableTitles: FieldValue.arrayUnion(col.reward.title) },
        }, { merge: true });
      }

      // Cofre: valor inteiro, sem abrir ciclo de 48h (decisão de Kaio).
      const walletPatch: Record<string, unknown> = {
        vaultFragments:        vaultAfter,
        vaultLastContribution: FieldValue.serverTimestamp(),
        collectionsToClaim:    FieldValue.arrayRemove(collectionId),
        updatedAt:             FieldValue.serverTimestamp(),
      };
      const nowFull = vaultAfter >= VAULT_MAX_FRAGMENTS && wallet.vaultFullNotified !== true;
      if (nowFull) walletPatch.vaultFullNotified = true;
      t.set(walletRef, walletPatch, { merge: true });

      t.set(db.collection('economyLedger').doc(), {
        uid,
        tipo:         'COLLECTION_REWARD',
        destino:      'COFRE',
        origem:       'claimCollectionReward',
        collectionId,
        tier:         col.tier,
        fragmentos:   fragments,
        cofreAntes:   vaultBefore,
        cofreDepois:  vaultAfter,
        timestamp:    FieldValue.serverTimestamp(),
        imutavel:     true,
      });
      auditLogFinanceiro({
        uid, tipo: 'FRAG_COLECAO', valor: fragments, origem: 'claimCollectionReward',
        metadata: { collectionId, tier: col.tier, destino: 'COFRE' },
      }, t);

      if (nowFull) {
        t.set(db.collection('notifications').doc(), {
          userId: uid, type: 'cofre_cheio', title: '🗝️ Cofre Cheio',
          message: 'Resgate para continuar acumulando.',
          icon: '🗝️', read: false, dados: { fragments: vaultAfter },
          timestamp: FieldValue.serverTimestamp(),
        });
      }

      return {
        success: true, alreadyClaimed: false, collectionId,
        fragments, vaultFragments: vaultAfter, repairedCompletion: !markedComplete,
      };
    });

    // Marco de prestígio de coleção Ouro, só quando o reparo acabou
    // de completar a coleção (no fluxo normal o AchievementProcessor
    // já concedeu). Falha aqui não desfaz a coleta.
    if (outcome.repairedCompletion && col.tier === 'GOLD') {
      await grantGoldMarcos(uid).catch(error =>
        console.warn('[claimCollectionReward] marco de prestígio falhou:', error),
      );
    }

    console.log('[claimCollectionReward]', JSON.stringify({
      uid, collectionId, fragments: outcome.fragments,
      alreadyClaimed: outcome.alreadyClaimed, repaired: outcome.repairedCompletion,
    }));

    const { repairedCompletion: _repaired, ...result } = outcome;
    return result;
  },
);

/** Mesma regra do AchievementProcessor.checkGoldCollectionMarcos. */
async function grantGoldMarcos(uid: string): Promise<void> {
  const snap = await db.collection('users').doc(uid).get();
  const completed: string[] = snap.data()?.achievements?.completedCollections ?? [];
  const goldCount = completed.filter(id => COLLECTIONS_CATALOG[id]?.tier === 'GOLD').length;
  if (goldCount === 3) {
    await PrestigeService.grantMarco(uid, 'COLLECTION_GOLD_3');
  } else if (goldCount === 1) {
    await PrestigeService.grantMarco(uid, 'COLLECTION_GOLD_1');
  }
}
