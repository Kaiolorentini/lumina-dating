// ============================================
// LUMINA — ASAAS WEBHOOK v5.3
// functions/src/payments/onAsaasWebhook.ts
//
// v5.3: adiciona suporte a coins_purchase.
// Todo o resto é idêntico ao original v5.2.
// ============================================

import * as functions  from 'firebase-functions/v2/https';
import * as admin       from 'firebase-admin';
import { FieldValue }   from 'firebase-admin/firestore';
import { notifyUser }   from '../utils/notifyUser';
import { notifyAdmins } from '../utils/notifyAdmins';
import { auditLogFinanceiro } from '../utils/auditLogFinanceiro';
import { handleCoinsChargeback } from './handleCoinsChargeback';

const db = admin.firestore();

export const onAsaasWebhook = functions.onRequest(
  { region: 'us-central1' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const event = req.body;
    if (!event || !event.payment) {
      res.status(400).send('Invalid payload');
      return;
    }

    const payment   = event.payment;
    const eventType = event.event;

    console.log('[onAsaasWebhook] Full payload:', JSON.stringify({ eventType, paymentId: payment?.id, externalRef: payment?.externalReference, value: payment?.value }));

    // ── Idempotência: verifica se já processamos este payment ──
    const idempotencyRef  = db.collection('processedWebhooks').doc(payment.id);
    const idempotencySnap = await idempotencyRef.get();
    if (idempotencySnap.exists) {
      console.log('[onAsaasWebhook] Already processed:', payment.id);
      res.status(200).send('Already processed');
      return;
    }

    // ── Busca a sale pelo asaasPaymentId ──
    const salesQuery = await db
      .collection('sales')
      .where('asaasPaymentId', '==', payment.id)
      .limit(1)
      .get();

    if (salesQuery.empty) {
      console.warn('[onAsaasWebhook] Sale not found for payment:', payment.id);
      res.status(200).send('Sale not found');
      return;
    }

    const saleDoc  = salesQuery.docs[0];
    const sale     = saleDoc.data();
    const saleId   = saleDoc.id;
    const buyerId  = sale.buyerId;
    const sellerId = sale.sellerId;

    // ── PAYMENT_RECEIVED ou PAYMENT_CONFIRMED ──────────────────
    if (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED') {

      // ── v5.3: CRISTAIS PREMIUM ─────────────────────────────
      if (sale.type === 'coins_purchase') {
        const uid        = sale.uid ?? buyerId;
        const totalCoins = sale.totalCoins ?? 0;

        await db.runTransaction(async (t) => {
          const freshSale = await t.get(saleDoc.ref);
          if (freshSale.data()?.status === 'paid') return; // idempotência

          const walletRef  = db.collection('wallets').doc(uid);
          const walletSnap = await t.get(walletRef);
          const wallet     = walletSnap.data() ?? {};

          const saldoAntes  = wallet.coinsPremium ?? 0;
          const saldoDepois = saldoAntes + totalCoins;

          // Credita coinsPremium
          t.set(walletRef, {
            coinsPremium:   FieldValue.increment(totalCoins),
            totalPurchases: FieldValue.increment(1),
            // Trava o bônus de primeira compra: 1x por conta, para
            // sempre. Não é revertido nem em chargeback — o bônus
            // foi consumido.
            ...(sale.isFirstPurchaseBonus === true && { firstPurchaseUsed: true }),
            updatedAt:      FieldValue.serverTimestamp(),
          }, { merge: true });

          // Atualiza status da venda
          t.update(saleDoc.ref, {
            status: 'paid',
            paidAt: FieldValue.serverTimestamp(),
          });

          // Registro em coinsPurchases
          t.set(db.collection('coinsPurchases').doc(`${uid}_${saleId}`), {
            uid,
            saleId,
            packageId:    sale.packageId,
            packageLabel: sale.packageLabel,
            coinsPremium: sale.coinsPremium,
            bonus:        sale.bonus,
            totalCoins,
            amount:       sale.amount,
            status:       'completed',
            createdAt:    FieldValue.serverTimestamp(),
          });

          // economyLedger
          t.set(db.collection('economyLedger').doc(), {
            uid,
            tipo:         'COINS_PURCHASE',
            saleId,
            packageId:    sale.packageId,
            coinsPremium: totalCoins,
            saldoAntes,
            saldoDepois,
            timestamp:    FieldValue.serverTimestamp(),
            imutavel:     true,
          });

          // auditLog
          t.set(db.collection('auditLogs').doc(), {
            uid,
            action:    'coins_purchased',
            saleId,
            packageId: sale.packageId,
            totalCoins,
            amount:    sale.amount,
            timestamp: FieldValue.serverTimestamp(),
            imutavel:  true,
          });

          // R20: audit financeiro — este é o ponto onde dinheiro
          // real vira cristais. Sem ele, uma disputa de pagamento
          // não tem como ser reconstruída.
          auditLogFinanceiro({
            uid,
            tipo:                   'COMPRA_ASAAS',
            coinTipo:               'premium',
            valor:                  totalCoins,
            origem:                 'onAsaasWebhook',
            saldoAnteriorGratuito:  wallet.coinsGratuitos ?? 0,
            saldoAnteriorPremium:   saldoAntes,
            saldoPosteriorGratuito: wallet.coinsGratuitos ?? 0,
            saldoPosteriorPremium:  saldoDepois,
            metadata: {
              saleId,
              packageId:    sale.packageId,
              packageLabel: sale.packageLabel,
              amountBRL:    sale.amount,
              bonus:        sale.bonus ?? 0,
              asaasPaymentId: payment.id,
            },
          }, t);
        });

        // Notificações — fire-and-forget
        notifyUser({
          userId: uid,
          type:   'promocao',
          title:  '✨ Cristais recebidos!',
          body:   `+${totalCoins} Cristais Premium foram adicionados à sua carteira.`,
        }).catch(() => {});

        notifyAdmins({
          title: '💎 Nova compra de cristais',
          body:  `${sale.packageLabel} — R$ ${sale.amount?.toFixed(2)} — uid: ${uid}`,
          type:  'promocao',
        }).catch(() => {});

        // Conquista FIRST_PURCHASE — fire-and-forget
        db.collection('achievementTriggers').add({
          uid,
          action:       'FIRST_PURCHASE',
          currentValue: 1,
          processedAt:  null,
          timestamp:    FieldValue.serverTimestamp(),
        }).catch(() => {});

        // Marca como processado
        await idempotencyRef.set({
          processedAt: FieldValue.serverTimestamp(),
          saleId,
          type:        'coins_purchase',
        });

        res.status(200).send('Coins credited');
        return;
      }

      // ── PRODUTO DO MARKETPLACE ─────────────────────────────
      if (!buyerId || !sellerId) {
        console.warn('[onAsaasWebhook] Missing buyerId or sellerId');
        res.status(200).send('Missing buyer/seller');
        return;
      }

      // Idempotência: verifica se sale já está paga
      if (sale.status === 'paid') {
        console.log('[onAsaasWebhook] Sale already paid:', saleId);
        res.status(200).send('Already paid');
        return;
      }

      // Busca produto
      const productRef  = db.collection('products').doc(sale.productId);
      const productSnap = await productRef.get();
      if (!productSnap.exists) {
        console.warn('[onAsaasWebhook] Product not found:', sale.productId);
        res.status(200).send('Product not found');
        return;
      }
      const product = productSnap.data()!;

      // Calcula split
      const saleAmount       = sale.amount ?? 0;
      const platformFeeRate  = 0.20;
      const platformFee      = parseFloat((saleAmount * platformFeeRate).toFixed(2));
      const sellerAmount     = parseFloat((saleAmount - platformFee).toFixed(2));

      // Transaction principal
      await db.runTransaction(async (t) => {
        const freshSale = await t.get(saleDoc.ref);
        if (freshSale.data()?.status === 'paid') return;

        // Busca wallet do seller
        const sellerWalletRef  = db.collection('creatorWallets').doc(sellerId);
        const sellerWalletSnap = await t.get(sellerWalletRef);
        const sellerWallet     = sellerWalletSnap.data() ?? {};

        // Credita seller — direto em availableBalance (sem pendingBalance)
        t.set(sellerWalletRef, {
          availableBalance: FieldValue.increment(sellerAmount),
          totalEarned:      FieldValue.increment(sellerAmount),
          updatedAt:        FieldValue.serverTimestamp(),
        }, { merge: true });

        // Cria purchase para o buyer
        const purchaseId  = `${buyerId}_${sale.productId}`;
        const purchaseRef = db.collection('purchases').doc(purchaseId);
        t.set(purchaseRef, {
          buyerId,
          productId:   sale.productId,
          sellerId,
          saleId,
          amount:      saleAmount,
          status:      'active',
          isRevoked:   false,
          createdAt:   FieldValue.serverTimestamp(),
          updatedAt:   FieldValue.serverTimestamp(),
        }, { merge: true });

        // Atualiza sale
        t.update(saleDoc.ref, {
          status:        'paid',
          sellerAmount,
          platformFee,
          paidAt:        FieldValue.serverTimestamp(),
          updatedAt:     FieldValue.serverTimestamp(),
        });

        // walletAuditLog
        t.set(db.collection('walletAuditLogs').doc(), {
          uid:           sellerId,
          type:          'sale_credit',
          amount:        sellerAmount,
          saleId,
          productId:     sale.productId,
          balanceBefore: sellerWallet.availableBalance ?? 0,
          balanceAfter:  (sellerWallet.availableBalance ?? 0) + sellerAmount,
          timestamp:     FieldValue.serverTimestamp(),
          imutavel:      true,
        });

        // auditLog
        t.set(db.collection('auditLogs').doc(), {
          action:       'sale_completed',
          saleId,
          buyerId,
          sellerId,
          productId:    sale.productId,
          amount:       saleAmount,
          sellerAmount,
          platformFee,
          timestamp:    FieldValue.serverTimestamp(),
          imutavel:     true,
        });
      });

      // Notificações — fire-and-forget
      notifyUser({
        userId: sellerId,
        type:   'promocao',
        title:  '🎉 Você fez uma venda!',
        body:   `${product.title ?? 'Seu produto'} foi vendido! +R$ ${sellerAmount.toFixed(2)} disponível.`,
      }).catch(() => {});

      notifyUser({
        userId: buyerId,
        type:   'promocao',
        title:  '✅ Compra confirmada',
        body:   `${product.title ?? 'Produto'} está disponível na sua biblioteca.`,
      }).catch(() => {});

      notifyAdmins({
        title: '💰 Nova venda realizada',
        body:  `${product.title ?? 'Produto'} — R$ ${saleAmount.toFixed(2)} — seller: ${sellerId}`,
        type:  'promocao',
      }).catch(() => {});

      // Screenshot protection trigger
      db.collection('triggerControl').doc(`screenshot_${sale.productId}_${buyerId}`).set({
        productId: sale.productId,
        buyerId,
        sellerId,
        activatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => {});

      // Marca como processado
      await idempotencyRef.set({
        processedAt: FieldValue.serverTimestamp(),
        saleId,
        type:        'product_purchase',
      });

      res.status(200).send('OK');
      return;
    }

    // ── PAYMENT_OVERDUE ────────────────────────────────────────
    if (eventType === 'PAYMENT_OVERDUE') {
      await db.runTransaction(async (t) => {
        const freshSale = await t.get(saleDoc.ref);
        if (freshSale.data()?.status !== 'pending') return;
        t.update(saleDoc.ref, {
          status:    'overdue',
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      await idempotencyRef.set({
        processedAt: FieldValue.serverTimestamp(),
        saleId,
        type:        'overdue',
      });

      res.status(200).send('Marked overdue');
      return;
    }

    // ── PAYMENT_DELETED / PAYMENT_REFUNDED ─────────────────────
    if (eventType === 'PAYMENT_DELETED' || eventType === 'PAYMENT_REFUNDED') {
      await db.runTransaction(async (t) => {
        const freshSale = await t.get(saleDoc.ref);
        const currentStatus = freshSale.data()?.status;
        if (currentStatus === 'refunded' || currentStatus === 'cancelled') return;

        t.update(saleDoc.ref, {
          status:    eventType === 'PAYMENT_REFUNDED' ? 'refunded' : 'cancelled',
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Se era produto e estava pago, revoga purchase
        if (currentStatus === 'paid' && sale.type !== 'coins_purchase') {
          const purchaseId  = `${buyerId}_${sale.productId}`;
          const purchaseRef = db.collection('purchases').doc(purchaseId);
          t.update(purchaseRef, {
            status:    'refunded',
            isRevoked: true,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });

      // ── Estorno de compra de cristais ──
      // Fora da transaction acima porque handleCoinsChargeback abre
      // a própria (uma transaction não pode conter outra).
      // Cristais não são reembolsáveis, mas o chargeback chega pelo
      // banco de qualquer forma — sem isto, o usuário recebe o
      // dinheiro de volta E fica com os cristais.
      if (sale.type === 'coins_purchase') {
        const cbUid   = sale.uid ?? buyerId;
        const cbCoins = sale.totalCoins ?? 0;

        try {
          const cb = await handleCoinsChargeback(
            cbUid, saleId, cbCoins, sale.amount ?? 0,
          );

          if (cb.reverted) {
            notifyUser({
              userId: cbUid,
              type:   'promocao',
              title:  cb.debtCreated > 0
                ? '⚠️ Compra estornada — pendência na sua conta'
                : 'Compra estornada',
              body:   cb.debtCreated > 0
                ? `O pagamento de ${cbCoins} cristais foi estornado. Como ${cb.debtCreated} já haviam sido usados, sua conta ficou com pendência e novas compras estão bloqueadas até a revisão. O caso foi enviado para nossa equipe de moderação.`
                : `O pagamento de ${cbCoins} cristais foi estornado e os cristais foram removidos da sua carteira.`,
            }).catch(() => {});

            notifyAdmins({
              title: cb.debtCreated > 0 ? '🚨 Estorno com dívida' : '↩️ Estorno de cristais',
              body:  `uid ${cbUid} — R$ ${(sale.amount ?? 0).toFixed(2)} — revertidos ${cb.coinsReverted}, dívida ${cb.debtCreated}`,
              type:  'promocao',
            }).catch(() => {});
          }
        } catch (error) {
          // Falha aqui NÃO pode impedir o 200 ao Asaas — senão ele
          // reenvia o webhook e a venda nunca fecha como estornada.
          // O fraudFlag pendente é o rastro para tratamento manual.
          console.error('[onAsaasWebhook] handleCoinsChargeback falhou:', {
            uid: cbUid, saleId, error,
          });
        }
      }

      await idempotencyRef.set({
        processedAt: FieldValue.serverTimestamp(),
        saleId,
        type:        eventType.toLowerCase(),
      });

      res.status(200).send('Processed');
      return;
    }

    // ── Outros eventos — ignora ────────────────────────────────
    console.log('[onAsaasWebhook] Ignored event:', eventType);
    res.status(200).send('Event ignored');
  }
);