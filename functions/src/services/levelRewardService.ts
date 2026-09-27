// ============================================
// LUMINA — LEVEL REWARD SERVICE
// functions/src/services/levelRewardService.ts
//
// Paga os marcos de nível (xpTable.LEVEL_REWARDS) dentro da
// transação de quem concede XP. Usado pelos DOIS caminhos de XP —
// Engine (XPService) e earnXP — para não haver duas regras.
//
// USO, em duas fases, por causa da regra do Firestore (todas as
// leituras antes de qualquer escrita):
//   1. readWalletForLevelRewards(t, uid)  → ANTES de escrever
//   2. applyLevelRewards(t, uid, ...)     → junto das escritas
//
// Uma vez só: o nível deriva do totalXP, que só cresce — cada
// marco é atravessado uma única vez. levelRewardsClaimed fica
// como REGISTRO para a tela, não como trava.
// ============================================

import * as admin from 'firebase-admin';
import { FieldValue, Timestamp, Transaction } from 'firebase-admin/firestore';
import { LevelReward } from '../config/xpTable';

const db = admin.firestore();

/** Mesmo ciclo do VaultService: depósito abre 48h de espera. */
const VAULT_CYCLE_MS = 48 * 3600 * 1000;

export interface WalletForLevelRewards {
  vaultFragments: number;
  vaultUnlockAt:  Date | null;
  coinsPremium:   number;
}

/** FASE 1 — leitura. Chamar ANTES de qualquer escrita na transação. */
export async function readWalletForLevelRewards(
  t: Transaction,
  uid: string,
): Promise<WalletForLevelRewards> {
  const snap = await t.get(db.collection('wallets').doc(uid));
  const data = snap.data() ?? {};
  return {
    vaultFragments: (data.vaultFragments as number) ?? 0,
    vaultUnlockAt:  data.vaultUnlockAt?.toDate?.() ?? null,
    coinsPremium:   (data.coinsPremium as number) ?? 0,
  };
}

/** FASE 2 — escrita. Paga os marcos, grava o pendente do modal e notifica. */
export function applyLevelRewards(
  t:       Transaction,
  uid:     string,
  rewards: LevelReward[],
  wallet:  WalletForLevelRewards,
  origem:  string,
): void {
  if (rewards.length === 0) return;

  const totalFragments = rewards.reduce((sum, r) => sum + r.fragments, 0);
  const totalPremium   = rewards.reduce((sum, r) => sum + r.crystalsPremium, 0);
  const topLevel       = Math.max(...rewards.map(r => r.level));

  const walletRef = db.collection('wallets').doc(uid);
  const userRef   = db.collection('users').doc(uid);

  // ── Carteira ──
  const walletUpdate: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (totalFragments > 0) {
    // Ignora o VAULT_MAX (5.000) de propósito: recompensa de
    // nível conquistada não se perde por o Cofre estar cheio.
    walletUpdate.vaultFragments        = FieldValue.increment(totalFragments);
    walletUpdate.vaultLastContribution = FieldValue.serverTimestamp();

    // Mesma regra do VaultService: ciclo novo só sem ciclo aberto.
    // Um ciclo vencido continua liberado até o saque.
    if (!wallet.vaultUnlockAt) {
      walletUpdate.vaultUnlockAt            = Timestamp.fromDate(new Date(Date.now() + VAULT_CYCLE_MS));
      walletUpdate.vaultUnlockNotifyPending = true;
    }
  }

  if (totalPremium > 0) {
    walletUpdate.coinsPremium = FieldValue.increment(totalPremium);
  }

  t.set(walletRef, walletUpdate, { merge: true });

  // ── Ledger imutável: uma linha por marco ──
  let cofreAntes   = wallet.vaultFragments;
  let premiumAntes = wallet.coinsPremium;

  for (const r of rewards) {
    t.set(db.collection('economyLedger').doc(), {
      uid,
      tipo:              'NIVEL_RECOMPENSA',
      origem,
      nivel:             r.level,
      fragmentos:        r.fragments,
      cristaisPremium:   r.crystalsPremium,
      cofreAntes,
      cofreDepois:       cofreAntes + r.fragments,
      saldoPremiumAntes:  premiumAntes,
      saldoPremiumDepois: premiumAntes + r.crystalsPremium,
      timestamp:         FieldValue.serverTimestamp(),
      imutavel:          true,
    });
    cofreAntes   += r.fragments;
    premiumAntes += r.crystalsPremium;
  }

  // ── Registro para a tela + pendente do modal ──
  // Mapa ANINHADO: com set+merge, uma chave com ponto viraria um
  // campo com o nome literal.
  const claimed: Record<string, boolean> = {};
  for (const r of rewards) claimed[`level_${r.level}`] = true;

  t.set(userRef, {
    xp: { levelRewardsClaimed: claimed },
    progression: {
      pendingLevelReward: {
        level:           topLevel,
        levels:          rewards.map(r => r.level),
        fragments:       totalFragments,
        crystalsPremium: totalPremium,
      },
    },
  }, { merge: true });

  // ── Sino ──
  const parts: string[] = [];
  if (totalFragments > 0) parts.push(`${totalFragments} fragmentos no seu Cofre`);
  if (totalPremium > 0)   parts.push(`${totalPremium} cristais premium`);

  t.set(db.collection('notifications').doc(), {
    userId:    uid,
    type:      'level_up',
    title:     `🎁 Recompensa do nível ${topLevel}`,
    message:   `Você ganhou ${parts.join(' e ')}!`,
    icon:      '🎁',
    read:      false,
    dados:     {
      level:           topLevel,
      fragments:       totalFragments,
      crystalsPremium: totalPremium,
    },
    timestamp: FieldValue.serverTimestamp(),
  });
}