// ============================================
// LUMINA — CONVERT FRAGMENTS → CRYSTALS v6.0
// functions/src/economy/convertFragments.ts
//
// v6.0 — A PESSOA ESCOLHE QUANTO CONVERTE. SEM TETO, SEM ESPERA.
//
// Decisão de produto: teto frustra. O limite natural é o saldo:
// 100 fragmentos = 1 cristal gratuito.
//
// `crystals` é quantos cristais a pessoa quer. Sem o parâmetro
// (versões antigas do app), converte tudo o que der — nada
// quebra antes da atualização chegar.
//
// Saíram: o teto de 5 por conversão, a espera de 24h e o
// `conversionLock`, que nunca era ligado (só desligado). A
// transação já impede conversão dupla.
// ============================================

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FRAGMENTS } from '../config/economy';
import { auditLogFinanceiro } from '../utils/auditLogFinanceiro';

export const convertFragments = onCall(
  { maxInstances: 10, region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    const { crystals } = (request.data ?? {}) as { crystals?: unknown };

    if (crystals !== undefined) {
      if (typeof crystals !== 'number' || !Number.isInteger(crystals) || crystals < 1) {
        throw new HttpsError('invalid-argument', 'Quantidade inválida.');
      }
    }

    const db        = admin.firestore();
    const walletRef = db.collection('wallets').doc(uid);
    const perCrystal = FRAGMENTS.FRAGMENTS_PER_CRYSTAL;

    try {
      return await db.runTransaction(async (t) => {
        const walletSnap = await t.get(walletRef);
        if (!walletSnap.exists) {
          throw new HttpsError('not-found', 'Carteira não encontrada.');
        }

        const wallet           = walletSnap.data()!;
        const currentFragments = (wallet.fragments as number) ?? 0;
        const available        = Math.floor(currentFragments / perCrystal);

        if (available < 1) {
          throw new HttpsError(
            'failed-precondition',
            `Fragmentos insuficientes. Necessário: ${perCrystal}. Disponível: ${currentFragments}.`
          );
        }

        const toConvert = (crystals as number | undefined) ?? available;
        if (toConvert > available) {
          throw new HttpsError(
            'failed-precondition',
            `Você pode converter até ${available} ${available === 1 ? 'cristal' : 'cristais'}.`
          );
        }

        const fragmentsUsed = toConvert * perCrystal;
        const newFragments  = currentFragments - fragmentsUsed;
        const prevGratuitos = (wallet.coinsGratuitos as number) ?? 0;
        const prevPremium   = (wallet.coinsPremium   as number) ?? 0;
        const newGratuitos  = prevGratuitos + toConvert;
        const now           = admin.firestore.FieldValue.serverTimestamp();

        t.update(walletRef, {
          fragments:              newFragments,
          coinsGratuitos:         newGratuitos,
          totalEarned:            admin.firestore.FieldValue.increment(toConvert),
          lastFragmentConversion: now,
          updatedAt:              now,
        });

        auditLogFinanceiro({
          uid,
          tipo:                   'FRAGMENTOS_CONVERSAO',
          coinTipo:               'gratuito',
          valor:                  toConvert,
          origem:                 'convertFragments',
          saldoAnteriorGratuito:  prevGratuitos,
          saldoAnteriorPremium:   prevPremium,
          saldoPosteriorGratuito: newGratuitos,
          saldoPosteriorPremium:  prevPremium,
          metadata: {
            fragmentsUsed,
            crystalsGained:     toConvert,
            fragmentsRemaining: newFragments,
          },
        }, t);

        return {
          success:             true,
          crystalsGained:      toConvert,
          fragmentsUsed,
          fragmentsRemaining:  newFragments,
          newBalanceGratuitos: newGratuitos,
        };
      });
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      console.error('[convertFragments] Erro:', error);
      throw new HttpsError('internal', 'Erro ao converter fragmentos.');
    }
  }
);