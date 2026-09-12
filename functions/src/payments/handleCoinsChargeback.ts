// ============================================
// LUMINA — ESTORNO DE CRISTAIS v1.0
// functions/src/payments/handleCoinsChargeback.ts
//
// POLÍTICA: cristais não são reembolsáveis. Mas o estorno pode
// chegar mesmo assim — chargeback de cartão, contestação de Pix,
// decisão do banco. Nesses casos o dinheiro sai da conta da
// plataforma e, sem este tratamento, os cristais ficariam com o
// usuário. Farm com dinheiro real, repetível.
//
// O QUE FAZ:
// 1. Debita os cristais creditados naquela compra
// 2. Se o saldo não cobre, debita o que houver e registra a
//    diferença como dívida (chargebackDebt)
// 3. Com dívida > 0, bloqueia novas compras (purchasesBlocked)
// 4. Abre um fraudFlag para revisão humana — SEMPRE, mesmo
//    quando o saldo cobre tudo
// 5. Notifica o usuário de forma factual
//
// POR QUE NÃO ACUSA DE FRAUDE:
// Saldo insuficiente tem causas legítimas — compra antiga já
// consumida, ou fraude no cartão do próprio usuário (vítima, não
// autor). A acusação automática expõe a plataforma. O sistema
// bloqueia e escala para humano; a conclusão é da moderação.
//
// REGRAS:
// R2  — runTransaction() em toda movimentação
// R6  — serverTimestamp() sempre
// R18 — Gratuitos e Premium sempre separados
// R20 — auditLog com saldo anterior e posterior
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { auditLogFinanceiro } from '../utils/auditLogFinanceiro';

const db = admin.firestore();

export interface ChargebackResult {
  reverted:        boolean;
  coinsReverted:   number;
  debtCreated:     number;
  purchasesBlocked: boolean;
  alreadyHandled:  boolean;
}

/**
 * Reverte uma compra de cristais estornada.
 * Idempotente: o campo chargebackHandledAt em coinsPurchases é o lock.
 *
 * @param uid        dono da carteira
 * @param saleId     venda estornada
 * @param totalCoins cristais creditados na compra
 * @param amountBRL  valor em reais, para o registro de moderação
 */
export async function handleCoinsChargeback(
  uid: string,
  saleId: string,
  totalCoins: number,
  amountBRL: number,
): Promise<ChargebackResult> {
  const walletRef   = db.collection('wallets').doc(uid);
  const purchaseRef = db.collection('coinsPurchases').doc(`${uid}_${saleId}`);
  const userRef     = db.collection('users').doc(uid);

  const result = await db.runTransaction(async (t) => {
    const [walletSnap, purchaseSnap] = await Promise.all([
      t.get(walletRef),
      t.get(purchaseRef),
    ]);

    // ── Idempotência (R3): webhooks são reenviados ──
    if (purchaseSnap.data()?.chargebackHandledAt) {
      return {
        reverted: false, coinsReverted: 0, debtCreated: 0,
        purchasesBlocked: false, alreadyHandled: true,
      } as ChargebackResult;
    }

    const wallet = walletSnap.data() ?? {};
    const premiumAntes   = wallet.coinsPremium   ?? 0;
    const gratuitosAntes = wallet.coinsGratuitos ?? 0;
    const debtAntes      = wallet.chargebackDebt ?? 0;

    // Cristais comprados são sempre Premium (R18) — a reversão
    // nunca toca em Gratuitos, que foram ganhos por engajamento
    // e não têm relação com o pagamento estornado.
    const coinsReverted = Math.min(totalCoins, premiumAntes);
    const debtCreated   = totalCoins - coinsReverted;

    const premiumDepois = premiumAntes - coinsReverted;
    const debtDepois    = debtAntes + debtCreated;
    const blocked       = debtDepois > 0;

    // 1. Debita o que existe e registra a dívida
    t.set(walletRef, {
      coinsPremium:     premiumDepois,
      chargebackDebt:   debtDepois,
      purchasesBlocked: blocked,
      updatedAt:        FieldValue.serverTimestamp(),
    }, { merge: true });

    // 2. Marca a compra como estornada (este campo é o lock)
    t.set(purchaseRef, {
      status:              'chargeback',
      chargebackHandledAt: FieldValue.serverTimestamp(),
      coinsReverted,
      debtCreated,
    }, { merge: true });

    // 3. Ledger imutável
    t.set(db.collection('economyLedger').doc(), {
      uid,
      tipo:            'CHARGEBACK_REVERSAL',
      feature:         'COINS_PURCHASE',
      saleId,
      cristaisPremium: -coinsReverted,
      saldoAntesPremium:  premiumAntes,
      saldoDepoisPremium: premiumDepois,
      debtCreated,
      amountBRL,
      timestamp:       FieldValue.serverTimestamp(),
      imutavel:        true,
    });

    // 4. R20: audit financeiro
    auditLogFinanceiro({
      uid,
      tipo:                   'ESTORNO',
      coinTipo:               'premium',
      valor:                  -coinsReverted,
      origem:                 'handleCoinsChargeback',
      saldoAnteriorGratuito:  gratuitosAntes,
      saldoAnteriorPremium:   premiumAntes,
      saldoPosteriorGratuito: gratuitosAntes,
      saldoPosteriorPremium:  premiumDepois,
      metadata: {
        saleId, totalCoins, coinsReverted, debtCreated, amountBRL,
      },
    }, t);

    // 5. Moderação — SEMPRE, mesmo com saldo suficiente.
    // Um usuário que estorna repetidamente é um padrão que só
    // aparece com histórico; o flag existe para tornar isso visível.
    t.set(db.collection('fraudFlags').doc(), {
      uid,
      type:      debtCreated > 0 ? 'CHARGEBACK_WITH_DEBT' : 'CHARGEBACK',
      severity:  debtCreated > 0 ? 'high' : 'medium',
      status:    'pending',
      saleId,
      amountBRL,
      totalCoins,
      coinsReverted,
      debtCreated,
      // Descrição factual: a conclusão sobre intenção é da
      // moderação, não do código.
      description: debtCreated > 0
        ? `Estorno de R$ ${amountBRL.toFixed(2)}. Saldo insuficiente para reverter ${totalCoins} cristais — ${debtCreated} ficaram como dívida.`
        : `Estorno de R$ ${amountBRL.toFixed(2)}. ${coinsReverted} cristais revertidos integralmente.`,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 6. Marca o usuário para o painel admin
    if (blocked) {
      t.set(userRef, {
        adminFlags: {
          purchasesBlocked:   true,
          chargebackDebt:     debtDepois,
          lastChargebackAt:   FieldValue.serverTimestamp(),
        },
      }, { merge: true });
    }

    return {
      reverted: true,
      coinsReverted,
      debtCreated,
      purchasesBlocked: blocked,
      alreadyHandled: false,
    } as ChargebackResult;
  });

  return result;
}