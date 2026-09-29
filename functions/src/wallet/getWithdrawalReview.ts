// ============================================
// LUMINA — CONFERÊNCIA DE SAQUE (antifraude, superadmin)
// functions/src/wallet/getWithdrawalReview.ts
//
// Recalcula o saldo do criador PELO HISTÓRICO e compara com o saldo
// gravado na carteira:
//
//   esperado = Σ sellerAmount das vendas creditadas
//              (status 'paid' ou 'refund_requested')
//            − Σ saques pagos
//   gravado  = disponível + pendente − dívida
//
// Venda reembolsada ou estornada sai do "creditadas" e também foi
// debitada da carteira: as duas contas andam juntas. Crédito que
// não veio de venda — bug, injeção — aparece como diferença
// positiva, e o saque mostra o alerta ANTES da aprovação.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { assertAuthenticated, assertSuperAdmin } from '../utils/adminGuard';
import { readPayoutKey } from '../utils/pixKey';
import { round2 } from '../utils/creatorLedger';

const CREDITED_STATUSES = new Set(['paid', 'refund_requested']);
const TOLERANCE = 0.01;

export const getWithdrawalReview = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  await assertSuperAdmin(request.auth!.uid);

  const { withdrawalId } = (request.data ?? {}) as { withdrawalId?: unknown };
  if (typeof withdrawalId !== 'string' || !withdrawalId || withdrawalId.includes('/')) {
    throw new HttpsError('invalid-argument', 'withdrawalId obrigatório');
  }

  const db = admin.firestore();
  const wSnap = await db.collection('withdrawals').doc(withdrawalId).get();
  if (!wSnap.exists) throw new HttpsError('not-found', 'Saque não encontrado');

  const w      = wSnap.data()!;
  const userId = w.userId as string;

  const [walletSnap, salesSnap, paidSnap, key, userSnap] = await Promise.all([
    db.collection('creatorWallets').doc(userId).get(),
    db.collection('sales').where('sellerId', '==', userId).get(),
    db.collection('withdrawals').where('userId', '==', userId).where('status', '==', 'paid').get(),
    readPayoutKey(userId),
    db.collection('users').doc(userId).get(),
  ]);

  let earned = 0;
  let creditedSales = 0;
  salesSnap.docs.forEach(d => {
    const s = d.data();
    if (CREDITED_STATUSES.has(s.status)) {
      earned += Number(s.sellerAmount ?? 0);
      creditedSales++;
    }
  });

  const withdrawn = paidSnap.docs.reduce((sum, d) => sum + Number(d.data().amount ?? 0), 0);

  const wallet    = walletSnap.data() ?? {};
  const available = Number(wallet.availableBalance ?? 0);
  const pending   = Number(wallet.pendingBalance ?? 0);
  const debt      = Number(wallet.debtBalance ?? 0);

  const expected = round2(earned - withdrawn);
  const actual   = round2(available + pending - debt);
  const diff     = round2(actual - expected);

  return {
    withdrawal: {
      id:        withdrawalId,
      amount:    Number(w.amount ?? 0),
      status:    w.status,
      pixKey:    w.pixKey ?? null,
      pixType:   w.pixType ?? null,
      createdAt: w.createdAt?.toDate?.()?.toISOString?.() ?? null,
    },
    creator: {
      uid:  userId,
      name: (userSnap.data()?.name as string) ?? '',
    },
    // A chave cadastrada HOJE — se divergir da do saque, o admin vê.
    currentPixKey:     key?.pixKey ?? null,
    currentPixKeyType: key?.pixKeyType ?? null,
    keyMatches:        !!key && key.pixKey === w.pixKey,
    wallet: {
      available, pending, debt,
      totalEarned:    Number(wallet.totalEarned ?? 0),
      totalWithdrawn: Number(wallet.totalWithdrawn ?? 0),
      chargebackPending: wallet.hasChargebackPending === true,
    },
    afterWithdrawal: round2(available - Number(w.amount ?? 0)),
    reconciliation: {
      creditedSales,
      earned:   round2(earned),
      withdrawn: round2(withdrawn),
      expected,
      actual,
      diff,
      alert: diff > TOLERANCE,
    },
  };
});