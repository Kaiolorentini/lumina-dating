// ============================================
// LUMINA — COFRE DE SINTONIA v5.2
// functions/src/engagement/vault.ts
//
// REGRAS IMPLEMENTADAS:
// 1.  Cofre armazena apenas Fragmentos — nunca cristais
// 2.  Limite: 5.000 Fragmentos (= 50 cristais na conversão)
// 3.  Ciclo de saque: unlockAt = depósito + 48h
// 4.  Saque Premium: imediato (30s anti-spam)
// 5.  Fontes válidas: visitas, curtidas, sintonias, eventos
// 6.  Anti-farm: 1x por perfil/usuário a cada 24h
// 7.  Limite por evento: visita=2, curtida=5, sintonia=20
// 8.  Cofre cheio: bloqueia entrada, notifica
// 9.  Saque sempre inteiro (nunca parcial)
// 10. Limite diário: 100 cristais via cofre
// 11. Status: EMPTY / FILLING / READY / FULL
// 12. Cooldown 30s anti-spam entre saques
// 13. Economy Ledger imutável em todo saque
// 14. serverTimestamp() obrigatório
// 15. runTransaction() em toda operação financeira
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { todayBr }   from '../utils/dateBr';
const db = admin.firestore();

const VAULT_MAX_FRAGMENTS    = 5000;
const FRAGMENTS_PER_CRYSTAL  = 100;
const MAX_CRYSTALS_PER_SWEEP = 50;   // saque inteiro máximo
const ANTI_SPAM_SECONDS      = 30;
const DAILY_CRYSTAL_LIMIT    = 100;

// As fontes e valores do Cofre vivem em VAULT_SOURCES no
// VaultService.ts — fonte única desde a FASE 2F.

function calcVaultStatus(fragments: number): 'EMPTY' | 'FILLING' | 'READY' | 'FULL' {
  if (fragments <= 0)                      return 'EMPTY';
  if (fragments >= VAULT_MAX_FRAGMENTS)    return 'FULL';
  if (fragments >= FRAGMENTS_PER_CRYSTAL)  return 'READY';
  return 'FILLING';
}

// ── 1. Status do Cofre ──
export const getVaultStatus = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const walletDoc = await db.collection('wallets').doc(uid).get();
    const wallet    = walletDoc.data() ?? {};

    const vaultFragments = wallet.vaultFragments      ?? 0;
    const unlockAt       = wallet.vaultUnlockAt?.toDate?.() ?? null;
    const lastWithdrawAt = wallet.vaultLastWithdrawAt?.toDate?.() ?? null;
    const isGalaxiaPlus  = wallet.galaxiaPlus?.ativo  === true;
    const todayCrystals  = wallet.vaultCrystalsToday  ?? 0;
    const todayStr       = todayBr();
    const lastDay        = wallet.vaultCrystalsTodayDate ?? '';

    // Reset contador diário se mudou o dia
    const crystalsToday = lastDay === todayStr ? todayCrystals : 0;

    const now            = Date.now();
    const isLocked       = unlockAt ? now < unlockAt.getTime() : false;
    const cooldownRemaining = isLocked && !isGalaxiaPlus
      ? unlockAt!.getTime() - now
      : 0;

    // Anti-spam: 30s entre saques (inclusive Premium)
    const lastWithdrawMs = lastWithdrawAt ? now - lastWithdrawAt.getTime() : Infinity;
    const antiSpamActive = lastWithdrawMs < ANTI_SPAM_SECONDS * 1000;

    const crystalsEquivalent = Math.floor(vaultFragments / FRAGMENTS_PER_CRYSTAL);
    const status             = calcVaultStatus(vaultFragments);
    const canWithdraw        = (
      vaultFragments >= FRAGMENTS_PER_CRYSTAL &&
      !antiSpamActive &&
      crystalsToday < DAILY_CRYSTAL_LIMIT &&
      (isGalaxiaPlus || !isLocked)
    );

    return {
      vaultFragments,
      vaultMax:            VAULT_MAX_FRAGMENTS,
      vaultPercent:        Math.min((vaultFragments / VAULT_MAX_FRAGMENTS) * 100, 100),
      crystalsEquivalent,
      status,
      canWithdraw,
      isGalaxiaPlus,
      isLocked:            !isGalaxiaPlus && isLocked,
      cooldownRemainingMs: Math.max(0, cooldownRemaining),
      antiSpamActive,
      crystalsToday,
      dailyLimit:          DAILY_CRYSTAL_LIMIT,
      unlockAt:            unlockAt?.toISOString() ?? null,
      lastWithdrawAt:      lastWithdrawAt?.toISOString() ?? null,
    };
  }
);

// ── 2. Depósito no Cofre — REMOVIDO na FASE 2F ──
//
// depositToVault era onCall e ficou órfão após a FASE 2D: nenhum
// cliente o chamava mais. Quem deposita agora é o VaultService,
// acionado pelos orchestrators de visita, curtida e sintonia.
//
// Removido em vez de mantido dormente porque seu anti-farm era
// INCOMPATÍVEL com o caminho ativo: gravava em vaultControl com
// chave `{source}_{uid}`, enquanto o VaultService usa
// `vault_{eventType}_{fromUid}_{data}`. Mesma coleção, formatos
// que não se cruzam — reativá-lo permitiria depósito duplo.
//
// O teto diário de fragmentos por visitas (R12) vive no
// VaultService desde a 2F.

// ── 3. Sacar do Cofre → converte em Cristais Gratuitos ──
export const withdrawFromVault = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const walletRef = db.collection('wallets').doc(uid);
    // Mesma fronteira do getVaultStatus — se divergirem, a tela
    // mostra saque liberado e a CF nega, ou o contrário.
    const todayStr  = todayBr();

    const result = await db.runTransaction(async (t) => {
      const walletDoc = await t.get(walletRef);
      if (!walletDoc.exists) {
        throw new functions.HttpsError('not-found', 'Carteira não encontrada.');
      }

      const wallet         = walletDoc.data()!;
      const vaultFragments = wallet.vaultFragments      ?? 0;
      const isGalaxiaPlus  = wallet.galaxiaPlus?.ativo  === true;
      const lastWithdrawAt = wallet.vaultLastWithdrawAt?.toDate?.() ?? null;
      const todayCrystals  = wallet.vaultCrystalsToday  ?? 0;
      const lastDay        = wallet.vaultCrystalsTodayDate ?? '';
      const crystalsToday  = lastDay === todayStr ? todayCrystals : 0;

      // Mínimo para sacar
      if (vaultFragments < FRAGMENTS_PER_CRYSTAL) {
        throw new functions.HttpsError(
          'failed-precondition',
          `Mínimo de ${FRAGMENTS_PER_CRYSTAL} fragmentos para sacar.`
        );
      }

      // REGRA 12: anti-spam 30s
      if (lastWithdrawAt) {
        const elapsed = Date.now() - lastWithdrawAt.getTime();
        if (elapsed < ANTI_SPAM_SECONDS * 1000) {
          throw new functions.HttpsError('resource-exhausted', 'Aguarde alguns segundos antes de sacar novamente.');
        }
      }

      // REGRA 3: cooldown 48h para não-Premium
      if (!isGalaxiaPlus) {
        const unlockAt = wallet.vaultUnlockAt?.toDate?.() ?? null;
        if (unlockAt && Date.now() < unlockAt.getTime()) {
          const hoursLeft = Math.ceil((unlockAt.getTime() - Date.now()) / 3600000);
          throw new functions.HttpsError(
            'resource-exhausted',
            `Cofre disponível em ${hoursLeft}h. Galáxia Plus libera saque imediato.`
          );
        }
      }

      // REGRA 10: limite diário 100 cristais via cofre
      if (crystalsToday >= DAILY_CRYSTAL_LIMIT) {
        throw new functions.HttpsError('resource-exhausted', 'Limite diário de saques do Cofre atingido.');
      }

      // REGRA 9: saque inteiro
      const crystalsToGain   = Math.min(
        Math.floor(vaultFragments / FRAGMENTS_PER_CRYSTAL),
        MAX_CRYSTALS_PER_SWEEP,
        DAILY_CRYSTAL_LIMIT - crystalsToday
      );
      const fragmentsToSpend = crystalsToGain * FRAGMENTS_PER_CRYSTAL;
      const newVault         = Math.max(0, vaultFragments - fragmentsToSpend);
      const currentGratuitos = wallet.coinsGratuitos ?? 0;
      const newGratuitos     = currentGratuitos + crystalsToGain;
      const newStatus        = calcVaultStatus(newVault);

      t.set(walletRef, {
        vaultFragments:         newVault,
        vaultLastWithdrawAt:    FieldValue.serverTimestamp(),
        vaultFullNotified:      false,
        vaultUnlockAt:          null, // reseta ciclo após saque
        coinsGratuitos:         newGratuitos,
        vaultCrystalsToday:     crystalsToday + crystalsToGain,
        vaultCrystalsTodayDate: todayStr,
        updatedAt:              FieldValue.serverTimestamp(),
      }, { merge: true });

      // Ledger imutável
      t.set(db.collection('economyLedger').doc(), {
        uid,
        tipo:                 'COFRE_SAQUE',
        origem:               'withdrawFromVault',
        isGalaxiaPlus,
        fragmentosGastos:     fragmentsToSpend,
        cristaisGerados:      crystalsToGain,
        saldoVaultAntes:      vaultFragments,
        saldoVaultDepois:     newVault,
        saldoGratuitosAntes:  currentGratuitos,
        saldoGratuitosDepois: newGratuitos,
        timestamp:            FieldValue.serverTimestamp(),
        imutavel:             true,
      });

      return {
        crystalsGained:      crystalsToGain,
        fragmentsUsed:       fragmentsToSpend,
        vaultRemaining:      newVault,
        vaultStatus:         newStatus,
        newBalanceGratuitos: newGratuitos,
        isGalaxiaPlus,
      };
    });

    // Conquistas VAULT_FIRST e VAULT_10 — fire-and-forget, fora da
    // transaction. Action incremental: o onAchievementTrigger soma
    // +1 ao progresso, então currentValue é sempre 1.
    db.collection('achievementTriggers').add({
      uid,
      action:       'VAULT_WITHDRAW',
      currentValue: 1,
      processedAt:  null,
      timestamp:    FieldValue.serverTimestamp(),
    }).catch(() => {});

    return { success: true, ...result };
  }
);