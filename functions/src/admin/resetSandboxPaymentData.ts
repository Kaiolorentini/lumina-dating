// ============================================
// LUMINA — ZERAR DADOS DE PAGAMENTO DO SANDBOX
// functions/src/admin/resetSandboxPaymentData.ts
//
// USO ÚNICO, antes de ligar o Asaas de produção (decisão de Kaio,
// 09/10/2026: o app só tem contas de teste — "limpar tudo").
//
// Por que existe: o sandbox do Asaas "pagou" compras de mentira, e
// elas creditaram saldo REAL no Firestore. Depois da troca:
//   • um criador de teste pediria saque desse saldo — e o saque é
//     pago com Pix de verdade (CRÍTICO);
//   • cobranças "pending" do sandbox nunca vencem (o aviso do
//     sandbox não chega mais) e bloqueiam a compra daquele produto.
//
// O que faz (só com conta superadmin):
//   1. Vendas com asaasPaymentId (cobradas pelo Asaas, ou seja,
//      sandbox): pendente/vencida → 'cancelled'; paga/reembolso
//      pedido → 'cancelled' e a compra do produto é revogada.
//      Venda grátis (sem Asaas) não é tocada.
//      Os gatilhos existentes recalculam o Painel do Criador e tiram
//      as avaliações das compras revogadas.
//   2. creatorWallets: todo campo *Balance, totalEarned e
//      totalWithdrawn → 0.
//   3. Saques pendente/aprovado → 'rejected' (não há dinheiro real).
//   4. wallets (cristais): coinsPremium → 0; bônus de primeira compra
//      liberado de novo; bloqueio e dívida de estorno removidos.
//      Cristais grátis (coinsGratuitos) ficam.
//   5. galaxiaPlus: assinaturas pagas no sandbox apagadas.
//
// Travas:
//   • só superadmin;
//   • RECUSA se ASAAS_ENVIRONMENT já for 'production' — depois da
//     troca, estes dados são de clientes reais;
//   • { dryRun: true } só conta e não grava nada;
//   • para gravar exige confirm === 'ZERAR-SANDBOX'.
// Idempotente: rodar de novo não acha mais nada para mudar.
// Registros imutáveis (economyLedger, auditLogs, creatorWalletLogs)
// ficam como histórico; esta execução fica registrada em auditLogs.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  DocumentData, FieldValue, Query, QueryDocumentSnapshot, QuerySnapshot, WriteBatch,
} from 'firebase-admin/firestore';
import { assertAuthenticated, assertSuperAdmin } from '../utils/adminGuard';

const db = admin.firestore();

const CONFIRM_PHRASE = 'ZERAR-SANDBOX';
const PAGE_SIZE      = 200;
const BATCH_LIMIT    = 400;

const OPEN_SALE      = new Set(['pending', 'overdue']);
const CREDITED_SALE  = new Set(['paid', 'refund_requested']);
const OPEN_WITHDRAW  = new Set(['pending', 'approved']);

interface ResetReport {
  dryRun: boolean;
  pendingSalesCancelled: number;
  paidSalesCancelled: number;
  purchasesRevoked: number;
  creatorWalletsZeroed: number;
  creatorBalanceTotal: number;
  withdrawalsRejected: number;
  crystalWalletsReset: number;
  crystalsRemoved: number;
  galaxiaPlusRemoved: number;
}

/** Junta gravações e confirma em lotes de até 400. */
class BatchQueue {
  private batch: WriteBatch = db.batch();
  private size = 0;
  constructor(private readonly dryRun: boolean) {}

  add(write: (batch: WriteBatch) => void): void {
    if (this.dryRun) return;
    write(this.batch);
    this.size++;
  }

  async flushIfFull(): Promise<void> {
    if (this.size >= BATCH_LIMIT - 2) await this.flush();
  }

  async flush(): Promise<void> {
    if (this.dryRun || this.size === 0) return;
    await this.batch.commit();
    this.batch = db.batch();
    this.size = 0;
  }
}

async function forEachPage(query: Query, fn: (docs: QueryDocumentSnapshot[]) => Promise<void>): Promise<void> {
  let last: QueryDocumentSnapshot | null = null;
  for (;;) {
    const page: QuerySnapshot = await (last ? query.startAfter(last) : query).limit(PAGE_SIZE).get();
    if (page.empty) return;
    await fn(page.docs);
    if (page.size < PAGE_SIZE) return;
    last = page.docs[page.docs.length - 1];
  }
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export const resetSandboxPaymentData = onCall(
  { secrets: ['ASAAS_ENVIRONMENT'], timeoutSeconds: 540, memory: '512MiB' },
  async (request): Promise<ResetReport> => {
    assertAuthenticated(request.auth?.uid);
    const uid = request.auth!.uid;
    await assertSuperAdmin(uid);

    const environment = (process.env.ASAAS_ENVIRONMENT ?? '').trim().toLowerCase();
    if (environment === 'production') {
      throw new HttpsError(
        'failed-precondition',
        'O Asaas já está em produção: estes dados agora são de clientes reais e não podem ser zerados.',
      );
    }

    const data    = (request.data ?? {}) as { dryRun?: unknown; confirm?: unknown };
    const dryRun  = data.dryRun !== false;
    if (!dryRun && data.confirm !== CONFIRM_PHRASE) {
      throw new HttpsError('invalid-argument', 'Confirmação ausente.');
    }

    const report: ResetReport = {
      dryRun,
      pendingSalesCancelled: 0,
      paidSalesCancelled: 0,
      purchasesRevoked: 0,
      creatorWalletsZeroed: 0,
      creatorBalanceTotal: 0,
      withdrawalsRejected: 0,
      crystalWalletsReset: 0,
      crystalsRemoved: 0,
      galaxiaPlusRemoved: 0,
    };
    const queue = new BatchQueue(dryRun);
    const marker = {
      sandboxReset:   true,
      sandboxResetAt: FieldValue.serverTimestamp(),
      updatedAt:      FieldValue.serverTimestamp(),
    };

    // ── 1. Vendas cobradas pelo Asaas (sandbox) ──
    await forEachPage(db.collection('sales').orderBy('__name__'), async (docs) => {
      for (const d of docs) {
        const sale: DocumentData = d.data();
        if (typeof sale.asaasPaymentId !== 'string' || !sale.asaasPaymentId) continue;
        const status = String(sale.status);

        if (OPEN_SALE.has(status)) {
          report.pendingSalesCancelled++;
          queue.add(b => b.update(d.ref, { status: 'cancelled', ...marker }));
        } else if (CREDITED_SALE.has(status)) {
          report.paidSalesCancelled++;
          queue.add(b => b.update(d.ref, { status: 'cancelled', ...marker }));

          const isProductSale = sale.type !== 'coins_purchase' &&
            typeof sale.buyerId === 'string' && typeof sale.productId === 'string';
          if (isProductSale) {
            const purchaseRef = db.collection('purchases').doc(`${sale.buyerId}_${sale.productId}`);
            const purchase = await purchaseRef.get();
            // Compra desta venda (ou antiga, sem saleId, de valor pago).
            const fromThisSale = purchase.get('saleId') === d.id ||
              (!purchase.get('saleId') && num(purchase.get('amount')) > 0);
            if (purchase.exists && fromThisSale && purchase.get('isRevoked') !== true) {
              report.purchasesRevoked++;
              queue.add(b => b.update(purchaseRef, { status: 'refunded', isRevoked: true, ...marker }));
            }
          }
        }
        await queue.flushIfFull();
      }
    });

    // ── 2. Saldos dos criadores ──
    await forEachPage(db.collection('creatorWallets').orderBy('__name__'), async (docs) => {
      for (const d of docs) {
        const wallet = d.data();
        const patch: Record<string, unknown> = {};
        let balance = 0;
        Object.keys(wallet).forEach(key => {
          const isMoney = key.endsWith('Balance') || key === 'totalEarned' || key === 'totalWithdrawn';
          if (isMoney && num(wallet[key]) !== 0) {
            patch[key] = 0;
            if (key.endsWith('Balance') && key !== 'debtBalance') balance += Math.max(0, num(wallet[key]));
          }
        });
        if (Object.keys(patch).length === 0) continue;
        report.creatorWalletsZeroed++;
        report.creatorBalanceTotal = round2(report.creatorBalanceTotal + balance);
        queue.add(b => b.update(d.ref, { ...patch, ...marker }));
        await queue.flushIfFull();
      }
    });

    // ── 3. Saques em aberto ──
    await forEachPage(db.collection('withdrawals').orderBy('__name__'), async (docs) => {
      for (const d of docs) {
        if (!OPEN_WITHDRAW.has(String(d.get('status')))) continue;
        report.withdrawalsRejected++;
        queue.add(b => b.update(d.ref, {
          status: 'rejected',
          rejectionReason: 'Dados de teste zerados antes do lançamento.',
          ...marker,
        }));
        await queue.flushIfFull();
      }
    });

    // ── 4. Cristais comprados ──
    await forEachPage(db.collection('wallets').orderBy('__name__'), async (docs) => {
      for (const d of docs) {
        const wallet = d.data();
        const premium = num(wallet.coinsPremium);
        const needs = premium !== 0 || wallet.firstPurchaseUsed === true ||
          num(wallet.totalPurchases) !== 0 || wallet.purchasesBlocked === true ||
          num(wallet.chargebackDebt) !== 0;
        if (!needs) continue;
        report.crystalWalletsReset++;
        report.crystalsRemoved += Math.max(0, premium);
        queue.add(b => b.update(d.ref, {
          coinsPremium:      0,
          totalPurchases:    0,
          firstPurchaseUsed: FieldValue.delete(),
          purchasesBlocked:  FieldValue.delete(),
          chargebackDebt:    FieldValue.delete(),
          ...marker,
        }));
        await queue.flushIfFull();
      }
    });

    // ── 5. Galáxia Plus pagas no sandbox ──
    await forEachPage(db.collection('galaxiaPlus').orderBy('__name__'), async (docs) => {
      for (const d of docs) {
        report.galaxiaPlusRemoved++;
        queue.add(b => b.delete(d.ref));
        await queue.flushIfFull();
      }
    });

    await queue.flush();

    if (!dryRun) {
      await db.collection('auditLogs').add({
        action:      'sandbox_payment_data_reset',
        performedBy: uid,
        report,
        timestamp:   FieldValue.serverTimestamp(),
        imutavel:    true,
      });
    }

    console.log('[resetSandboxPaymentData]', JSON.stringify({ by: uid, ...report }));
    return report;
  },
);
