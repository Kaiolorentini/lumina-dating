// ============================================
// LUMINA — PEDIDO DE SAQUE (servidor)
// functions/src/wallet/requestWithdrawal.ts
//
// Antes o app gravava withdrawals/{id} direto, com valor, chave Pix
// e saldo escolhidos por ele; mínimo e validação de chave rodavam
// só na tela. Agora:
//   • a chave é SEMPRE a cadastrada (área privada) — ninguém pede
//     saque para outra chave;
//   • mínimo, saldo, dívida, chargeback e saque aberto conferidos
//     numa transação.
// A criação direta pelo app está fechada nas rules.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { assertAuthenticated } from '../utils/adminGuard';
import { assertUserNotBlocked } from '../utils/assertUserNotBlocked';
import { readPayoutKey } from '../utils/pixKey';
import { round2 } from '../utils/creatorLedger';

const MIN_WITHDRAWAL = 10;

export const requestWithdrawal = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  await assertUserNotBlocked(uid);

  const { amount } = (request.data ?? {}) as { amount?: unknown };
  const value = typeof amount === 'number' ? round2(amount) : NaN;
  if (!Number.isFinite(value) || value < MIN_WITHDRAWAL) {
    throw new HttpsError('invalid-argument', `O saque mínimo é R$ ${MIN_WITHDRAWAL.toFixed(2)}.`);
  }

  const db   = admin.firestore();
  const user = (await db.collection('users').doc(uid).get()).data() ?? {};
  if (user.role !== 'creator') {
    throw new HttpsError('permission-denied', 'Apenas criadores podem solicitar saque.');
  }

  const key = await readPayoutKey(uid);
  if (!key) {
    throw new HttpsError('failed-precondition', 'Cadastre sua chave Pix antes de solicitar o saque.');
  }

  const walletRef     = db.collection('creatorWallets').doc(uid);
  const withdrawalRef = db.collection('withdrawals').doc();

  await db.runTransaction(async (t) => {
    const [walletSnap, openSnap] = await Promise.all([
      t.get(walletRef),
      t.get(db.collection('withdrawals')
        .where('userId', '==', uid)
        .where('status', 'in', ['pending', 'approved'])
        .limit(1)),
    ]);

    if (!openSnap.empty) {
      throw new HttpsError('failed-precondition', 'Você já tem um saque em andamento. Aguarde o pagamento.');
    }

    const wallet    = walletSnap.data() ?? {};
    const available = Number(wallet.availableBalance ?? 0);
    const debt      = Number(wallet.debtBalance ?? 0);

    if (debt > 0) {
      throw new HttpsError(
        'failed-precondition',
        `Há uma pendência de R$ ${debt.toFixed(2)} por reembolso. Novas vendas cobrem esse valor antes do próximo saque.`,
      );
    }
    if (wallet.hasChargebackPending === true) {
      throw new HttpsError('failed-precondition', 'Saque bloqueado por chargeback pendente.');
    }
    if (value > available) {
      throw new HttpsError('failed-precondition', `Seu saldo disponível é R$ ${available.toFixed(2)}.`);
    }

    t.set(withdrawalRef, {
      userId:           uid,
      amount:           value,
      balanceAtRequest: available,
      pixKey:           key.pixKey,
      pixType:          key.pixKeyType,
      status:           'pending',
      source:           'requestWithdrawal',
      createdAt:        FieldValue.serverTimestamp(),
    });
  });

  return { success: true, withdrawalId: withdrawalRef.id };
});