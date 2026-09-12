// ============================================
// LUMINA — CREATE COINS PURCHASE v1.2
// functions/src/payments/createCoinsPurchase.ts
//
// v1.2: corrige assinaturas do asaasClient.
// findOrCreateCustomer retorna AsaasCustomer (objeto),
// então usamos .id para pegar o customerId.
// getPixQrCode não existe — usamos pixQrCode da response
// de createPixPayment diretamente.
// ============================================

import { onCall, HttpsError }  from 'firebase-functions/v2/https';
import * as admin               from 'firebase-admin';
import { FieldValue }           from 'firebase-admin/firestore';
import {
  findOrCreateCustomer,
  createPixPayment,
  formatDueDate,
}                               from '../utils/asaasClient';

const db = admin.firestore();

// Catálogo de pacotes — fonte da verdade no backend
const PACKAGES: Record<string, {
  label:        string;
  coinsPremium: number;
  bonus:        number;
  total:        number;
  priceValue:   number;
  isFirstPkg:   boolean;
}> = {
  starter: {
    label:        'Iniciante',
    coinsPremium: 100,
    bonus:        0,
    total:        100,
    priceValue:   5.00,
    isFirstPkg:   true,
  },
  popular: {
    label:        'Popular',
    coinsPremium: 500,
    bonus:        100,
    total:        600,
    priceValue:   19.99,
    isFirstPkg:   false,
  },
  supremo: {
    label:        'Supremo',
    coinsPremium: 1000,
    bonus:        500,
    total:        1500,
    priceValue:   39.99,
    isFirstPkg:   false,
  },
  galaxia: {
    label:        'Galáxia',
    coinsPremium: 4000,
    bonus:        2000,
    total:        6000,
    priceValue:   99.99,
    isFirstPkg:   false,
  },
  galaxia_plus: {
    label:        'Galáxia Plus',
    coinsPremium: 300,
    bonus:        0,
    total:        300,
    priceValue:   19.90,
    isFirstPkg:   false,
  },
};

export const createCoinsPurchase = onCall(
  {
    region:  'us-central1',
    secrets: ['ASAAS_API_KEY', 'ASAAS_ENVIRONMENT'],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    const { packageId } = request.data as { packageId: string };
    if (!packageId || !PACKAGES[packageId]) {
      throw new HttpsError('invalid-argument', 'Pacote inválido.');
    }

    const pkg = PACKAGES[packageId];

    // Busca dados do usuário
    const userDoc  = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    if (!userData) throw new HttpsError('not-found', 'Usuário não encontrado.');

    // Verifica primeira compra (bônus extra no starter)
    const walletDoc  = await db.collection('wallets').doc(uid).get();
    const walletData = walletDoc.data() ?? {};

    // Conta com pendência de estorno não compra até a moderação
    // revisar. Sem este guard, o purchasesBlocked gravado pelo
    // handleCoinsChargeback não teria efeito nenhum.
    if (walletData.purchasesBlocked === true) {
      const debt = walletData.chargebackDebt ?? 0;
      throw new HttpsError(
        'permission-denied',
        `Sua conta tem uma pendência de ${debt} cristais referente a um pagamento estornado. ` +
        'Novas compras estão bloqueadas até a análise da nossa equipe.',
      );
    }

    // firstPurchaseUsed é gravado pelo webhook no momento em que o
    // bônus é concedido. totalPurchases não servia: várias cobranças
    // pendentes criadas ao mesmo tempo passavam todas por
    // "totalPurchases === 0" e cada pagamento dobrava de novo.
    const isFirstPurchase = walletData.firstPurchaseUsed !== true;

    let totalCoins = pkg.total;
    let bonus      = pkg.bonus;
    if (pkg.isFirstPkg && isFirstPurchase) {
      totalCoins = pkg.coinsPremium * 2;
      bonus      = pkg.coinsPremium;
    }

    // Busca ou cria customer no Asaas
    // findOrCreateCustomer retorna AsaasCustomer (objeto com .id)
    if (!userData.email) {
      throw new HttpsError('invalid-argument', 'Email do usuário não encontrado.');
    }

    let customer;
    try {
      customer = await findOrCreateCustomer({
        name:              userData.name  ?? 'Usuário Lumina',
        email:             userData.email ?? '',
        cpfCnpj:           userData.cpf   ?? undefined,
        externalReference: uid,
      });
    } catch (err: any) {
      console.error('[createCoinsPurchase] findOrCreateCustomer erro:', JSON.stringify(err?.message ?? err));
      throw new HttpsError('internal', `Asaas customer error: ${err?.message ?? 'unknown'}`);
    }

    // Cria cobrança Pix
    const dueDate     = formatDueDate(30);
    const description = `Lumina — ${pkg.label} (${totalCoins} Cristais)`;

    const payment = await createPixPayment({
      customerId:        customer.id,
      value:             pkg.priceValue,
      dueDate,
      description,
      externalReference: uid,
    });

    // pixQrCode e pixCopyPaste vêm da response do payment
    const pixQrCode    = typeof payment.pixQrCode === 'string' ? payment.pixQrCode : '';
    const pixCopyPaste = payment.pixCopyPaste ?? '';
    const checkoutUrl  = payment.invoiceUrl   ?? '';

    // Grava a venda no Firestore (status pending)
    const saleRef = db.collection('sales').doc();
    await saleRef.set({
      uid,
      buyerId:        uid,
      sellerId:       'lumina_platform',
      type:           'coins_purchase',
      packageId,
      packageLabel:   pkg.label,
      coinsPremium:   pkg.coinsPremium,
      bonus,
      totalCoins,
      // Marca a venda que carrega o bônus de primeira compra.
      // O webhook usa isso para travar a flag na wallet.
      isFirstPurchaseBonus: pkg.isFirstPkg && isFirstPurchase,
      amount:         pkg.priceValue,
      asaasPaymentId: payment.id,
      checkoutUrl,
      pixQrCode,
      pixCopyPaste,
      status:         'pending',
      createdAt:      FieldValue.serverTimestamp(),
    });

    return {
      saleId: saleRef.id,
      checkoutUrl,
      pixQrCode,
      pixCopyPaste,
    };
  }
);