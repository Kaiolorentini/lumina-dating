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

const db = admin.firestore();

const VAULT_MAX_FRAGMENTS    = 5000;
const FRAGMENTS_PER_CRYSTAL  = 100;
const MAX_CRYSTALS_PER_SWEEP = 50;   // saque inteiro máximo
const VAULT_CYCLE_HOURS      = 48;
const ANTI_SPAM_SECONDS      = 30;
const DAILY_CRYSTAL_LIMIT    = 100;

// Fontes válidas e seus limites
const VAULT_SOURCES: Record<string, { fragments: number; cooldownHours: number }> = {
  visit:    { fragments: 2,  cooldownHours: 24 },
  like:     { fragments: 5,  cooldownHours: 24 },
  sintonia: { fragments: 20, cooldownHours: 24 },
  event:    { fragments: 10, cooldownHours: 0  }, // sem cooldown (eventos oficiais)
};

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
    const todayStr       = new Date().toISOString().slice(0, 10);
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

// ── 2. Depositar no Cofre (chamado por visitas, curtidas, sintonias) ──
export const depositToVault = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const { source, targetUid } = request.data as {
      source:    'visit' | 'like' | 'sintonia' | 'event';
      targetUid: string; // quem está depositando para UID
    };

    if (!VAULT_SOURCES[source]) {
      throw new functions.HttpsError('invalid-argument', 'Fonte inválida para o Cofre.');
    }

    // targetUid = dono do cofre (quem recebe a visita/curtida)
    if (!targetUid) {
      throw new functions.HttpsError('invalid-argument', 'targetUid obrigatório.');
    }

    const { fragments: fragmentsToAdd, cooldownHours } = VAULT_SOURCES[source];
    const todayStr    = new Date().toISOString().slice(0, 10);
    const walletRef   = db.collection('wallets').doc(targetUid);
    const controlRef  = db.collection('vaultControl').doc(`${targetUid}_${todayStr}`);

    const result = await db.runTransaction(async (t) => {
      const [walletDoc, controlDoc] = await Promise.all([
        t.get(walletRef),
        t.get(controlRef),
      ]);

      const wallet  = walletDoc.data() ?? {};
      const control = controlDoc.data() ?? {};

      const currentVault = wallet.vaultFragments ?? 0;

      // REGRA 8: cofre cheio
      if (currentVault >= VAULT_MAX_FRAGMENTS) {
        return { deposited: 0, vaultFragments: currentVault, status: 'FULL' };
      }

      // REGRA 6: anti-farm — cooldown por source + uid do visitante
      if (cooldownHours > 0 && uid !== targetUid) {
        const farmKey = `${source}_${uid}`;
        if (control[farmKey]) {
          return { deposited: 0, vaultFragments: currentVault, status: calcVaultStatus(currentVault), duplicate: true };
        }
        // Registra para cooldown de 24h
        t.set(controlRef, {
          [farmKey]: true,
          updatedAt: FieldValue.serverTimestamp(),
          date:      todayStr,
          targetUid,
        }, { merge: true });
      }

      const canDeposit   = Math.min(fragmentsToAdd, VAULT_MAX_FRAGMENTS - currentVault);
      const newVault     = currentVault + canDeposit;
      const nowFull      = newVault >= VAULT_MAX_FRAGMENTS;
      const newStatus    = calcVaultStatus(newVault);

      // Inicia novo ciclo de 48h se necessário
      const currentUnlockAt = wallet.vaultUnlockAt?.toDate?.() ?? null;
      const needsNewCycle   = !currentUnlockAt || Date.now() > currentUnlockAt.getTime();

      const updates: Record<string, any> = {
        vaultFragments:        newVault,
        vaultLastContribution: FieldValue.serverTimestamp(),
        updatedAt:             FieldValue.serverTimestamp(),
      };

      if (needsNewCycle) {
        const unlockAt = new Date(Date.now() + VAULT_CYCLE_HOURS * 60 * 60 * 1000);
        updates.vaultUnlockAt = admin.firestore.Timestamp.fromDate(unlockAt);
      }

      t.set(walletRef, updates, { merge: true });

      // Notificação se ficou cheio
      if (nowFull && !wallet.vaultFullNotified) {
        t.set(db.collection('notifications').doc(), {
          userId:    targetUid,
          type:      'cofre_cheio',
          title:     '🗝️ Cofre Cheio',
          message:   'Seu Cofre está cheio! Resgate para continuar acumulando.',
          icon:      '🗝️',
          read:      false,
          dados:     { fragments: newVault },
          timestamp: FieldValue.serverTimestamp(),
        });
        t.set(walletRef, { vaultFullNotified: true }, { merge: true });
      }

      // Ledger
      t.set(db.collection('economyLedger').doc(), {
        uid:          targetUid,
        fromUid:      uid,
        tipo:         'COFRE_DEPOSITO',
        source,
        fragmentos:   canDeposit,
        saldoAntes:   currentVault,
        saldoDepois:  newVault,
        timestamp:    FieldValue.serverTimestamp(),
        imutavel:     true,
      });

      return { deposited: canDeposit, vaultFragments: newVault, status: newStatus };
    });

    return { success: true, ...result };
  }
);

// ── 3. Sacar do Cofre → converte em Cristais Gratuitos ──
export const withdrawFromVault = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const walletRef = db.collection('wallets').doc(uid);
    const todayStr  = new Date().toISOString().slice(0, 10);

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

    return { success: true, ...result };
  }
);