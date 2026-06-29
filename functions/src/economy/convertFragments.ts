// ============================================
// LUMINA — CONVERT FRAGMENTS → CRYSTALS
// functions/src/economy/convertFragments.ts
//
// v5.1
//
// CRÍTICO 11: runTransaction() + conversionLock
// Cooldown 24h. Máx 5 cristais por conversão.
// 100 fragmentos = 1 cristal gratuito.
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

    const db        = admin.firestore();
    const walletRef = db.collection('wallets').doc(uid);

    try {
      const result = await db.runTransaction(async (t) => {
        const walletSnap = await t.get(walletRef);
        if (!walletSnap.exists) {
          throw new HttpsError('not-found', 'Carteira não encontrada.');
        }

        const wallet = walletSnap.data()!;

        // CRÍTICO 11: conversionLock — evita dupla conversão simultânea
        if (wallet.conversionLock === true) {
          throw new HttpsError('failed-precondition', 'Conversão já em andamento.');
        }

        // Cooldown 24h
        const lastConversion = wallet.lastFragmentConversion?.toDate?.() ?? null;
        if (lastConversion) {
          const hoursSince = (Date.now() - lastConversion.getTime()) / (1000 * 60 * 60);
          if (hoursSince < FRAGMENTS.CONVERSION_COOLDOWN_HOURS) {
            const hoursLeft = Math.ceil(FRAGMENTS.CONVERSION_COOLDOWN_HOURS - hoursSince);
            throw new HttpsError(
              'resource-exhausted',
              `Próxima conversão disponível em ${hoursLeft}h.`
            );
          }
        }

        const currentFragments = wallet.fragments ?? 0;
        if (currentFragments < FRAGMENTS.FRAGMENTS_PER_CRYSTAL) {
          throw new HttpsError(
            'failed-precondition',
            `Fragmentos insuficientes. Necessário: ${FRAGMENTS.FRAGMENTS_PER_CRYSTAL}. Disponível: ${currentFragments}.`
          );
        }

        // Calcula cristais obtidos (máx 5 por conversão)
        const maxCrystals     = Math.min(
          Math.floor(currentFragments / FRAGMENTS.FRAGMENTS_PER_CRYSTAL),
          FRAGMENTS.MAX_CRYSTALS_PER_CONVERSION
        );
        const fragmentsUsed   = maxCrystals * FRAGMENTS.FRAGMENTS_PER_CRYSTAL;
        const newFragments     = currentFragments - fragmentsUsed;

        const prevGratuitos   = wallet.coinsGratuitos ?? 0;
        const prevPremium     = wallet.coinsPremium   ?? 0;
        const newGratuitos    = prevGratuitos + maxCrystals;
        const now             = admin.firestore.FieldValue.serverTimestamp();

        t.update(walletRef, {
          fragments:              newFragments,
          coinsGratuitos:         newGratuitos,
          totalEarned:            admin.firestore.FieldValue.increment(maxCrystals),
          lastFragmentConversion: now,
          conversionLock:         false,
          updatedAt:              now,
        });

        auditLogFinanceiro({
          uid,
          tipo:                   'FRAGMENTOS_CONVERSAO',
          coinTipo:               'gratuito',
          valor:                  maxCrystals,
          origem:                 'convertFragments',
          saldoAnteriorGratuito:  prevGratuitos,
          saldoAnteriorPremium:   prevPremium,
          saldoPosteriorGratuito: newGratuitos,
          saldoPosteriorPremium:  prevPremium,
          metadata: {
            fragmentsUsed,
            crystalsGained: maxCrystals,
            fragmentsRemaining: newFragments,
          },
        }, t);

        return {
          success:           true,
          crystalsGained:    maxCrystals,
          fragmentsUsed,
          fragmentsRemaining: newFragments,
          newBalanceGratuitos: newGratuitos,
        };
      });

      return result;
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      console.error('[convertFragments] Erro:', error);
      throw new HttpsError('internal', 'Erro ao converter fragmentos.');
    }
  }
);