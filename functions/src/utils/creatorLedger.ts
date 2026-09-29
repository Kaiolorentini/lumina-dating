// ============================================
// LUMINA — SALDO DO CRIADOR (crédito e débito com dívida)
// functions/src/utils/creatorLedger.ts
//
// Débito (reembolso aprovado, estorno do banco): sai primeiro do
// pendente, depois do disponível; o que faltar vira DÍVIDA
// (debtBalance). Antes a diferença simplesmente sumia — o criador
// que já tinha sacado ficava com o dinheiro devolvido ao comprador.
//
// Crédito (venda paga): ABATE A DÍVIDA primeiro, e só o resto vai
// para o disponível. Com dívida > 0 o saque fica bloqueado
// (requestWithdrawal, onApproveWithdrawal, onMarkWithdrawalPaid).
//
// Os dois helpers ESCREVEM numa transação já aberta: quem chama
// precisa ter lido a carteira ANTES de qualquer escrita.
// ============================================

import { FieldValue } from 'firebase-admin/firestore';
import * as admin     from 'firebase-admin';

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export interface DebitResult {
  fromPending:   number;
  fromAvailable: number;
  debtCreated:   number;
}

export function debitCreator(
  t: FirebaseFirestore.Transaction,
  walletRef: FirebaseFirestore.DocumentReference,
  wallet: Record<string, unknown>,
  amount: number,
  entry: { userId: string; type: 'refund' | 'chargeback'; description: string; saleId: string },
): DebitResult {
  const value         = round2(Math.max(0, amount));
  const fromPending   = round2(Math.min(Math.max(0, num(wallet.pendingBalance)), value));
  const rest          = round2(value - fromPending);
  const fromAvailable = round2(Math.min(Math.max(0, num(wallet.availableBalance)), rest));
  const debtCreated   = round2(rest - fromAvailable);

  t.set(walletRef, {
    pendingBalance:   FieldValue.increment(-fromPending),
    availableBalance: FieldValue.increment(-fromAvailable),
    debtBalance:      FieldValue.increment(debtCreated),
    updatedAt:        FieldValue.serverTimestamp(),
  }, { merge: true });

  t.set(admin.firestore().collection('creatorTransactions').doc(), {
    userId:      entry.userId,
    type:        entry.type,
    amount:      -value,
    description: entry.description,
    saleId:      entry.saleId,
    debtCreated,
    createdAt:   FieldValue.serverTimestamp(),
  });

  return { fromPending, fromAvailable, debtCreated };
}

export interface CreditResult {
  toDebt:      number;
  toAvailable: number;
}

export function creditCreator(
  t: FirebaseFirestore.Transaction,
  walletRef: FirebaseFirestore.DocumentReference,
  wallet: Record<string, unknown>,
  amount: number,
): CreditResult {
  const value       = round2(Math.max(0, amount));
  const toDebt      = round2(Math.min(Math.max(0, num(wallet.debtBalance)), value));
  const toAvailable = round2(value - toDebt);

  t.set(walletRef, {
    availableBalance: FieldValue.increment(toAvailable),
    debtBalance:      FieldValue.increment(-toDebt),
    totalEarned:      FieldValue.increment(value),
    updatedAt:        FieldValue.serverTimestamp(),
  }, { merge: true });

  return { toDebt, toAvailable };
}