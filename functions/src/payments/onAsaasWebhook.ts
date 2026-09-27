// ============================================
// LUMINA — ASAAS WEBHOOK v5.4
// functions/src/payments/onAsaasWebhook.ts
//
// v5.4 — SEGURANÇA E IDEMPOTÊNCIA.
//
// 1. AUTENTICAÇÃO. O Asaas envia o token configurado no painel
//    no cabeçalho `asaas-access-token`. Sem conferir, qualquer
//    pessoa com o id de um pagamento pendente mandava
//    PAYMENT_CONFIRMED e recebia cristais, produto ou Galáxia
//    Plus sem pagar. Sem o secret configurado, nega TUDO —
//    falha fechada.
//
// 2. EFEITOS SÓ QUANDO CREDITA. A transação já barrava crédito
//    duplo, mas notificação, métricas, FIRST_PURCHASE e a
//    ATIVAÇÃO DA GALÁXIA PLUS rodavam de novo a cada reenvio
//    (e o Asaas manda PAYMENT_CONFIRMED e PAYMENT_RECEIVED para
//    o mesmo pagamento). Agora a transação devolve se creditou.
//
// 3. IDEMPOTÊNCIA POR EVENTO. A chave era só o payment.id:
//    depois do pagamento, o estorno do MESMO pagamento caía em
//    "Already processed" e o chargeback nunca rodava. Agora a
//    chave é payment.id + evento.
//
// 4. ESTORNO SÓ DO QUE FOI PAGO. PAYMENT_DELETED de um Pix
//    expirado chamava handleCoinsChargeback e tirava cristais
//    que nunca foram creditados.
//
// 5. VALOR CONFERIDO. payment.value diferente de sale.amount
//    gera alerta ao admin. NÃO bloqueia: o efeito dos cupons
//    sobre `amount` ainda não foi auditado.
//
// v5.3: suporte a coins_purchase.
// ============================================

import * as functions  from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin       from 'firebase-admin';
import { FieldValue }   from 'firebase-admin/firestore';
import { timingSafeEqual } from 'crypto';
import { notifyUser }   from '../utils/notifyUser';
import { notifyAdmins } from '../utils/notifyAdmins';
import { auditLogFinanceiro } from '../utils/auditLogFinanceiro';
import { handleCoinsChargeback } from './handleCoinsChargeback';
import { activateGalaxiaPlus }   from './activateGalaxiaPlus';
import { incrementMetrics }      from '../utils/incrementMetric';

const db = admin.firestore();

// Mesmo valor do campo "Token de autenticação" do webhook no
// painel do Asaas. Configurar com:
//   firebase functions:secrets:set ASAAS_WEBHOOK_TOKEN
const ASAAS_WEBHOOK_TOKEN = defineSecret('ASAAS_WEBHOOK_TOKEN');

// ids do Asaas são alfanuméricos com _ e -. Qualquer outra
// coisa (como "/") quebraria o caminho do documento e faria o
// Asaas reenviar para sempre.
const PAYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

/** Comparação em tempo constante: não vaza, pelo tempo de
 *  resposta, quantos caracteres do token estão certos. */
function isValidToken(received: string | undefined, expected: string): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Alerta, sem bloquear, quando o valor pago diverge do da venda. */
function checkPaidAmount(paymentValue: unknown, saleAmount: unknown, saleId: string, paymentId: string): void {
  const paid     = Number(paymentValue);
  const expected = Number(saleAmount);
  if (!Number.isFinite(paid) || !Number.isFinite(expected)) return;
  if (Math.abs(paid - expected) <= 0.01) return;

  console.warn('[onAsaasWebhook] Valor divergente:', { saleId, paymentId, paid, expected });
  notifyAdmins({
    title: '⚠️ Valor pago divergente',
    body:  `sale ${saleId} — pago R$ ${paid.toFixed(2)}, esperado R$ ${expected.toFixed(2)}`,
    type:  'promocao',
  }).catch(() => {});
}

export const onAsaasWebhook = functions.onRequest(
  { region: 'us-central1', secrets: [ASAAS_WEBHOOK_TOKEN] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // ── Autenticação ───────────────────────────────────────
    if (!isValidToken(req.get('asaas-access-token'), ASAAS_WEBHOOK_TOKEN.value())) {
      console.warn('[onAsaasWebhook] Token inválido ou ausente. IP:', req.ip);
      res.status(401).send('Unauthorized');
      return;
    }

    const event = req.body;
    if (!event || !event.payment) {
      res.status(400).send('Invalid payload');
      return;
    }

    const payment   = event.payment;
    const eventType = event.event;

    if (typeof eventType !== 'string' ||
        typeof payment.id !== 'string' ||
        !PAYMENT_ID_PATTERN.test(payment.id)) {
      res.status(400).send('Invalid payload');
      return;
    }

    console.log('[onAsaasWebhook] Payload:', JSON.stringify({ eventType, paymentId: payment.id, externalRef: payment.externalReference, value: payment.value }));

    // ── Idempotência POR EVENTO ────────────────────────────
    // payment.id sozinho descartava o estorno de um pagamento
    // já processado.
    const idempotencyRef  = db.collection('processedWebhooks').doc(`${payment.id}_${eventType}`);
    const idempotencySnap = await idempotencyRef.get();
    if (idempotencySnap.exists) {
      console.log('[onAsaasWebhook] Already processed:', payment.id, eventType);
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

      checkPaidAmount(payment.value, sale.amount, saleId, payment.id);

      // ── v5.3: CRISTAIS PREMIUM ─────────────────────────────
      if (sale.type === 'coins_purchase') {
        const uid            = sale.uid ?? buyerId;
        const isSubscription = sale.isSubscription === true;
        // Galáxia Plus: os cristais são creditados SÓ pelo
        // activateGalaxiaPlus, que cobre ativação e renovação.
        // Creditar aqui também dava 600 em vez de 300. Esta
        // transação continua marcando a venda como paga e
        // registrando o pagamento — com zero cristais.
        const totalCoins = isSubscription ? 0 : (sale.totalCoins ?? 0);

        // true só quando ESTA execução creditou. Tudo o que vem
        // depois da transação depende disso.
        const credited = await db.runTransaction(async (t) => {
          const freshSale = await t.get(saleDoc.ref);
          if (freshSale.data()?.status === 'paid') return false; // idempotência

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
            tipo:         isSubscription ? 'GALAXIA_PLUS_PAGAMENTO' : 'COINS_PURCHASE',
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

          return true;
        });

        // Segunda confirmação do mesmo pagamento (CONFIRMED depois
        // de RECEIVED, ou reenvio): nada a fazer além de registrar.
        if (!credited) {
          await idempotencyRef.set({
            processedAt: FieldValue.serverTimestamp(),
            saleId,
            type:        'coins_purchase_duplicate',
          });
          res.status(200).send('Already credited');
          return;
        }

        // Métricas — compra de cristais é receita direta da
        // plataforma, sem comissão de criador.
        incrementMetrics({
          totalSales:     1,
          todaySales:     1,
          todayRevenue:   sale.amount ?? 0,
          monthlyRevenue: sale.amount ?? 0,
        }).catch(() => {});

        // Notificações — fire-and-forget
        // Assinatura tem notificação própria, mais abaixo — esta
        // diria "+0 Cristais".
        if (!isSubscription) {
          notifyUser({
            userId: uid,
            type:   'coins_purchased',
            title:  '✨ Cristais recebidos!',
            body:   `+${totalCoins} Cristais Premium foram adicionados à sua carteira.`,
          }).catch(() => {});
        }

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

        // ── GALÁXIA PLUS ──
        //
        // Roda DEPOIS de a venda ser marcada como paga. É ESTA
        // chamada que credita os cristais da assinatura, além de
        // ativar os 30 dias, os Turbos e o badge — a transação
        // acima registra o pagamento com zero cristais.
        //
        // Só roda quando `credited` é true: um reenvio do Asaas
        // não pode estender o acesso nem dar Turbos em dobro.
        //
        // Com await, e não fire-and-forget: se a ativação falhar,
        // a pessoa pagou e não recebeu o acesso. O erro precisa
        // aparecer no log com o saleId para tratamento manual.
        if (sale.isSubscription === true) {
          try {
            const activation = await activateGalaxiaPlus(uid, saleId);

            if (activation) {
              const dias = Math.ceil(
                (activation.expiresAt.getTime() - Date.now()) / (24 * 3600 * 1000),
              );

              notifyUser({
                userId: uid,
                type:   'galaxia_plus_activated',
                title:  activation.isFirstTime
                  ? '💜 Galáxia Plus ativada!'
                  : '💜 Galáxia Plus renovada!',
                body:   activation.isFirstTime
                  ? `${activation.crystals} cristais, ${activation.turbos} Turbos e o badge Constelação Guia são seus. Acesso até daqui a ${dias} dias.`
                  : `${activation.crystals} cristais, ${activation.turbos} Turbos e ${activation.fragments} fragmentos. Seu acesso agora vai até daqui a ${dias} dias.`,
              }).catch(() => {});
            }
          } catch (error) {
            console.error('[onAsaasWebhook] Ativação da Galáxia Plus FALHOU:', {
              uid, saleId, error,
            });
            notifyAdmins({
              title: '🚨 Galáxia Plus não ativou',
              body:  `Pagamento confirmado mas a ativação falhou — uid ${uid}, sale ${saleId}`,
              type:  'promocao',
            }).catch(() => {});
          }
        }

        // Marca como processado
        await idempotencyRef.set({
          processedAt: FieldValue.serverTimestamp(),
          saleId,
          type:        sale.isSubscription === true ? 'galaxia_plus' : 'coins_purchase',
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
        await idempotencyRef.set({
          processedAt: FieldValue.serverTimestamp(),
          saleId,
          type:        'product_purchase_duplicate',
        });
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

      // Transaction principal — true só quando ESTA execução pagou.
      const credited = await db.runTransaction(async (t) => {
        const freshSale = await t.get(saleDoc.ref);
        if (freshSale.data()?.status === 'paid') return false;

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

        return true;
      });

      if (!credited) {
        await idempotencyRef.set({
          processedAt: FieldValue.serverTimestamp(),
          saleId,
          type:        'product_purchase_duplicate',
        });
        res.status(200).send('Already paid');
        return;
      }

      // Métricas do painel admin — fire-and-forget.
      // O webhook processa TODA venda paga e nunca incrementava nada:
      // o dashboard ficou parado nos números das vendas gratuitas.
      incrementMetrics({
        totalSales:        1,
        totalProductsSold: 1,
        totalCommission:   platformFee,
        monthlyCommission: platformFee,
        todaySales:        1,
        todayRevenue:      saleAmount,
        monthlyRevenue:    saleAmount,
      }).catch(() => {});

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
      // Devolve o status ANTERIOR, ou null se já estava encerrada.
      // O estorno de cristais depende dele: só se reverte o que
      // foi pago.
      const previousStatus = await db.runTransaction(async (t) => {
        const freshSale = await t.get(saleDoc.ref);
        const currentStatus = freshSale.data()?.status as string | undefined;
        if (currentStatus === 'refunded' || currentStatus === 'cancelled') return null;

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

        return currentStatus ?? 'unknown';
      });

      // ── Estorno de compra de cristais ──
      // Fora da transaction acima porque handleCoinsChargeback abre
      // a própria (uma transaction não pode conter outra).
      // Cristais não são reembolsáveis, mas o chargeback chega pelo
      // banco de qualquer forma — sem isto, o usuário recebe o
      // dinheiro de volta E fica com os cristais.
      //
      // Só quando a venda ESTAVA paga: um Pix expirado ou
      // cancelado antes do pagamento não creditou nada, e
      // reverter criaria dívida sobre cristais que não existem.
      if (sale.type === 'coins_purchase' && previousStatus === 'paid') {
        const cbUid   = sale.uid ?? buyerId;
        // Galáxia Plus: sale.totalCoins guarda os mesmos 300 que o
        // activateGalaxiaPlus creditou (GALAXIA_PLUS.CRYSTALS_ON_ACTIVATION),
        // então o valor revertido bate. Turbos e dias NÃO são
        // revogados aqui — pendência registrada.
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