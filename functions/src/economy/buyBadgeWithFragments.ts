// ============================================
// LUMINA — COMPRA DE BADGE COM FRAGMENTOS
// functions/src/economy/buyBadgeWithFragments.ts
//
// FASE 6 — badges de entrada, pagos em fragmentos.
//
// CF separada do spendCoins de propósito: aquele debita cristais
// (coinsGratuitos/coinsPremium) e este debita wallets.fragments.
// Misturar as duas moedas num arquivo que já é crítico seria
// convite a erro de saldo.
//
// REGRA 1:  Nenhum débito client-side.
// REGRA 2:  runTransaction() obrigatório.
// REGRA 3B: Cliente envia o badgeId, nunca o preço.
// REGRA 15: economyLedger em toda movimentação.
// ============================================

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { BADGES_CATALOG } from '../config/badgesCatalog';

interface BuyBadgeRequest {
  badgeId: string;
}

export const buyBadgeWithFragments = onCall(
  { maxInstances: 10, region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    const { badgeId } = request.data as BuyBadgeRequest;

    const badge = BADGES_CATALOG[badgeId];
    if (!badge) {
      throw new HttpsError('invalid-argument', 'Badge inválido.');
    }
    if (badge.currency !== 'FRAGMENTS') {
      throw new HttpsError(
        'failed-precondition',
        'Este badge é adquirido com Cristais, não com Fragmentos.'
      );
    }

    // REGRA 3B: o preço vem do catálogo do servidor
    const cost = badge.price;

    const db        = admin.firestore();
    const walletRef = db.collection('wallets').doc(uid);
    const userRef   = db.collection('users').doc(uid);

    try {
      return await db.runTransaction(async (t) => {
        const [walletSnap, userSnap] = await Promise.all([
          t.get(walletRef),
          t.get(userRef),
        ]);

        if (!walletSnap.exists) {
          throw new HttpsError('not-found', 'Carteira não encontrada.');
        }

        const wallet    = walletSnap.data()!;
        const fragments = wallet.fragments ?? 0;

        if (fragments < cost) {
          throw new HttpsError(
            'failed-precondition',
            `Fragmentos insuficientes. Necessário: ${cost}. Disponível: ${fragments}.`
          );
        }

        const newFragments = fragments - cost;
        if (newFragments < 0) {
          throw new HttpsError('failed-precondition', 'Saldo insuficiente.');
        }

        // FASE 8: badges de fragmentos são PERMANENTES e gravam em
        // unlockedItems, o mesmo campo dos de conquista. Comprar
        // de novo o que já se tem é desperdício silencioso — o
        // guard abaixo devolve sem debitar.
        const unlocked = userSnap.data()?.progression?.unlockedItems ?? {};
        if (unlocked[badge.id] === true) {
          return {
            success:      true,
            badgeId:      badge.id,
            spent:        0,
            newFragments: fragments,
            alreadyOwned: true,
          };
        }

        const now = admin.firestore.FieldValue.serverTimestamp();

        t.update(walletRef, {
          fragments:  newFragments,
          updatedAt:  now,
        });

        t.set(userRef, {
          progression: {
            unlockedItems: { [badge.id]: true },
          },
        }, { merge: true });

        t.set(db.collection('economyLedger').doc(), {
          uid,
          tipo:         'BADGE_PURCHASE',
          origem:       'buyBadgeWithFragments',
          badgeId:      badge.id,
          rarity:       badge.rarity,
          permanent:    true,
          fragmentos:   -cost,
          saldoAntes:   fragments,
          saldoDepois:  newFragments,
          timestamp:    now,
          imutavel:     true,
        });

        return {
          success:      true,
          badgeId:      badge.id,
          spent:        cost,
          newFragments,
          alreadyOwned: false,
        };
      });
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      console.error('[buyBadgeWithFragments] Erro:', error);
      throw new HttpsError('internal', 'Erro ao adquirir badge.');
    }
  }
);