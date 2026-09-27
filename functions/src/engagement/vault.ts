// ============================================
// LUMINA — COFRE DE SINTONIA v6.0
// functions/src/engagement/vault.ts
//
// v6.0 — O SAQUE MOVE FRAGMENTOS, NÃO GERA CRISTAIS.
//
// Decisão de produto: o Cofre tem dois botões. Este arquivo é o
// primeiro — sacar os fragmentos do Cofre para a CARTEIRA. A
// conversão em cristais é o segundo botão (convertFragments),
// escolhida pela pessoa, sem teto, a 100 por 1.
//
// REGRAS:
//  1. Cofre armazena apenas Fragmentos
//  2. Limite: 5.000 fragmentos no Cofre (depósitos de eventos;
//     recompensas de nível entram mesmo acima)
//  3. Ciclo: 48h a partir do primeiro depósito; vencido, fica
//     liberado ATÉ o saque (não tranca de novo)
//  4. Galáxia Plus: saque sem esperar o ciclo
//  5. Saque sempre inteiro — move tudo do Cofre
//  6. Anti-spam: 30s entre saques
//  7. Ledger imutável e runTransaction() em todo saque
//
// Saíram: o teto de 100 cristais/dia e o limite de 50 por saque
// — o saque não gera mais cristais.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { isGalaxiaPlusActive } from '../payments/activateGalaxiaPlus';

const db = admin.firestore();

const VAULT_MAX_FRAGMENTS   = 5000;
/** Só para exibir quanto o Cofre vale em cristais na conversão. */
const FRAGMENTS_PER_CRYSTAL = 100;
const ANTI_SPAM_SECONDS     = 30;

type VaultStatus = 'EMPTY' | 'FILLING' | 'READY' | 'FULL';

function calcVaultStatus(fragments: number, withdrawable: boolean): VaultStatus {
  if (fragments <= 0)                   return 'EMPTY';
  if (fragments >= VAULT_MAX_FRAGMENTS) return 'FULL';
  if (withdrawable)                     return 'READY';
  return 'FILLING';
}

// As fontes e valores de depósito vivem em VAULT_SOURCES no
// VaultService.ts — fonte única desde a FASE 2F.

// ── 1. Status do Cofre ──
export const getVaultStatus = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const [walletDoc, isGalaxiaPlus] = await Promise.all([
      db.collection('wallets').doc(uid).get(),
      isGalaxiaPlusActive(uid),
    ]);
    const wallet = walletDoc.data() ?? {};

    const vaultFragments  = (wallet.vaultFragments as number) ?? 0;
    const walletFragments = (wallet.fragments      as number) ?? 0;
    const unlockAt        = wallet.vaultUnlockAt?.toDate?.()       ?? null;
    const lastWithdrawAt  = wallet.vaultLastWithdrawAt?.toDate?.() ?? null;

    const now          = Date.now();
    const lockedByTime = unlockAt ? now < unlockAt.getTime() : false;
    // A Galáxia Plus ignora o ciclo.
    const isLocked     = lockedByTime && !isGalaxiaPlus;

    const lastWithdrawMs = lastWithdrawAt ? now - lastWithdrawAt.getTime() : Infinity;
    const antiSpamActive = lastWithdrawMs < ANTI_SPAM_SECONDS * 1000;

    const canWithdraw = vaultFragments > 0 && !isLocked && !antiSpamActive;

    return {
      vaultFragments,
      walletFragments,
      vaultMax:            VAULT_MAX_FRAGMENTS,
      vaultPercent:        Math.min((vaultFragments / VAULT_MAX_FRAGMENTS) * 100, 100),
      crystalsEquivalent:  Math.floor(vaultFragments / FRAGMENTS_PER_CRYSTAL),
      status:              calcVaultStatus(vaultFragments, vaultFragments > 0 && !isLocked),
      canWithdraw,
      isGalaxiaPlus,
      isLocked,
      cooldownRemainingMs: isLocked && unlockAt ? Math.max(0, unlockAt.getTime() - now) : 0,
      antiSpamActive,
      unlockAt:            unlockAt?.toISOString() ?? null,
      lastWithdrawAt:      lastWithdrawAt?.toISOString() ?? null,
    };
  }
);

// ── 2. Depósito no Cofre — REMOVIDO na FASE 2F ──
// Quem deposita é o VaultService, acionado pelos orchestrators
// de visita, curtida e sintonia, e o levelRewardService.

// ── 3. Sacar do Cofre → fragmentos vão para a CARTEIRA ──
export const withdrawFromVault = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const walletRef = db.collection('wallets').doc(uid);

    // FORA da transação: consulta outro documento, e o Firestore
    // exige todas as leituras antes das escritas.
    const isPlus = await isGalaxiaPlusActive(uid);

    const result = await db.runTransaction(async (t) => {
      const walletDoc = await t.get(walletRef);
      if (!walletDoc.exists) {
        throw new functions.HttpsError('not-found', 'Carteira não encontrada.');
      }

      const wallet          = walletDoc.data()!;
      const vaultFragments  = (wallet.vaultFragments as number) ?? 0;
      const walletFragments = (wallet.fragments      as number) ?? 0;
      const lastWithdrawAt  = wallet.vaultLastWithdrawAt?.toDate?.() ?? null;
      const unlockAt        = wallet.vaultUnlockAt?.toDate?.()       ?? null;

      if (vaultFragments <= 0) {
        throw new functions.HttpsError('failed-precondition', 'Seu Cofre está vazio.');
      }

      // Anti-spam: 30s entre saques
      if (lastWithdrawAt) {
        const elapsed = Date.now() - lastWithdrawAt.getTime();
        if (elapsed < ANTI_SPAM_SECONDS * 1000) {
          throw new functions.HttpsError('resource-exhausted', 'Aguarde alguns segundos antes de sacar novamente.');
        }
      }

      // Ciclo de 48h — a Galáxia Plus ignora
      const lockedByTime = !!unlockAt && Date.now() < unlockAt.getTime();
      if (lockedByTime && !isPlus) {
        const hoursLeft = Math.ceil((unlockAt!.getTime() - Date.now()) / 3600000);
        throw new functions.HttpsError(
          'resource-exhausted',
          `Cofre disponível em ${hoursLeft}h. Galáxia Plus libera saque imediato.`
        );
      }

      const newWalletFragments = walletFragments + vaultFragments;

      t.set(walletRef, {
        vaultFragments:           0,
        fragments:                newWalletFragments,
        vaultLastWithdrawAt:      FieldValue.serverTimestamp(),
        vaultFullNotified:        false,
        vaultUnlockAt:            null, // reseta o ciclo
        vaultUnlockNotifyPending: false,
        updatedAt:                FieldValue.serverTimestamp(),
      }, { merge: true });

      // Ledger imutável
      t.set(db.collection('economyLedger').doc(), {
        uid,
        tipo:              'COFRE_SAQUE',
        origem:            'withdrawFromVault',
        isGalaxiaPlus:     isPlus,
        saqueImediato:     lockedByTime && isPlus,
        fragmentosMovidos: vaultFragments,
        cofreAntes:        vaultFragments,
        cofreDepois:       0,
        carteiraAntes:     walletFragments,
        carteiraDepois:    newWalletFragments,
        timestamp:         FieldValue.serverTimestamp(),
        imutavel:          true,
      });

      return {
        fragmentsMoved:  vaultFragments,
        walletFragments: newWalletFragments,
        usedPlusBypass:  lockedByTime && isPlus,
      };
    });

    // Conquistas VAULT_FIRST e VAULT_10 — fire-and-forget. Action
    // incremental: currentValue é sempre 1.
    db.collection('achievementTriggers').add({
      uid,
      action:       'VAULT_WITHDRAW',
      currentValue: 1,
      processedAt:  null,
      timestamp:    FieldValue.serverTimestamp(),
    }).catch(() => {});

    // Conta para a tela da Galáxia Plus só quando a assinatura foi
    // o motivo de não haver espera.
    if (result.usedPlusBypass) {
      db.collection('galaxiaPlus').doc(uid).set({
        instantWithdraws:     FieldValue.increment(1),
        fragmentsFromInstant: FieldValue.increment(result.fragmentsMoved),
      }, { merge: true }).catch(() => {});
    }

    return { success: true, ...result };
  }
);