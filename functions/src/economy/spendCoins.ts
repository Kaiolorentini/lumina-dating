// ============================================
// LUMINA — SPEND COINS
// functions/src/economy/spendCoins.ts
//
// REGRA 1:  Nenhum débito client-side.
// REGRA 2:  runTransaction() obrigatório.
// REGRA 3B: Cliente envia feature, não preço.
// REGRA 14: Gasta Gratuitos primeiro, Premium depois.
// REGRA 15: auditLog em toda movimentação.
// Saldo nunca fica negativo.
// ============================================

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { COSTS, PREMIUM_ONLY_FEATURES } from '../config/economy';
import { auditLogFinanceiro, AuditTipo } from '../utils/auditLogFinanceiro';

export type SpendableFeature = keyof typeof COSTS;

interface SpendCoinsRequest {
  feature:          SpendableFeature;
  idempotencyKey?:  string;
}

interface SpendResult {
  success:              boolean;
  spent:                number;
  spentFromGratuitos:   number;
  spentFromPremium:     number;
  newBalanceGratuitos:  number;
  newBalancePremium:    number;
}

export const spendCoins = onCall(
  { maxInstances: 10, region: 'us-central1' },
  async (request): Promise<SpendResult> => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    const { feature, idempotencyKey } = request.data as SpendCoinsRequest;

    if (!feature || !(feature in COSTS)) {
      throw new HttpsError('invalid-argument', 'Feature inválida.');
    }

    // REGRA 3B: backend decide o preço
    const cost = COSTS[feature];

    const db        = admin.firestore();
    const walletRef = db.collection('wallets').doc(uid);

    const idempotencyRef = idempotencyKey
      ? db.collection('spendIdempotency').doc(idempotencyKey)
      : null;

    try {
      const result = await db.runTransaction(async (t) => {
        const snaps = await Promise.all([
          t.get(walletRef),
          idempotencyRef ? t.get(idempotencyRef) : Promise.resolve(null),
        ]);

        const walletSnap      = snaps[0];
        const idempotencySnap = snaps[1];

        // Admin SDK: .exists é propriedade booleana (sem parênteses)
        if (idempotencySnap?.exists) {
          throw new HttpsError('already-exists', 'Operação já processada.');
        }

        if (!walletSnap.exists) {
          throw new HttpsError('not-found', 'Carteira não encontrada.');
        }

        const wallet    = walletSnap.data()!;
        const gratuitos = wallet.coinsGratuitos ?? 0;
        const premium   = wallet.coinsPremium   ?? 0;

        // Verifica se é feature premium only
        const isPremiumOnly = (PREMIUM_ONLY_FEATURES as readonly string[]).includes(feature);

        if (isPremiumOnly && premium < cost) {
          throw new HttpsError(
            'failed-precondition',
            'Esta feature requer Cristais Premium insuficientes.'
          );
        }

        const totalBalance = gratuitos + premium;
        if (totalBalance < cost) {
          throw new HttpsError(
            'failed-precondition',
            `Saldo insuficiente. Necessário: ${cost}. Disponível: ${totalBalance}.`
          );
        }

        // REGRA 14: Gratuitos primeiro, Premium depois
        let spentFromGratuitos = 0;
        let spentFromPremium   = 0;

        if (isPremiumOnly) {
          spentFromPremium = cost;
        } else {
          spentFromGratuitos = Math.min(cost, gratuitos);
          spentFromPremium   = cost - spentFromGratuitos;
        }

        const newGratuitos = gratuitos - spentFromGratuitos;
        const newPremium   = premium   - spentFromPremium;

        // Saldo nunca negativo — dupla verificação
        if (newGratuitos < 0 || newPremium < 0) {
          throw new HttpsError('failed-precondition', 'Saldo insuficiente.');
        }

        const now = admin.firestore.FieldValue.serverTimestamp();

        t.update(walletRef, {
          coinsGratuitos: newGratuitos,
          coinsPremium:   newPremium,
          totalSpent:     admin.firestore.FieldValue.increment(cost),
          updatedAt:      now,
        });

        if (idempotencyRef) {
          t.set(idempotencyRef, {
            uid, feature, cost,
            createdAt: now,
          });
        }

        const auditTipo = `SPEND_${feature}` as AuditTipo;

        auditLogFinanceiro({
          uid,
          tipo:                    auditTipo,
          coinTipo:                isPremiumOnly ? 'premium' : 'mixed',
          valor:                   -cost,
          origem:                  feature,
          saldoAnteriorGratuito:   gratuitos,
          saldoAnteriorPremium:    premium,
          saldoPosteriorGratuito:  newGratuitos,
          saldoPosteriorPremium:   newPremium,
          metadata: {
            spentFromGratuitos,
            spentFromPremium,
            idempotencyKey,
          },
        }, t);

        return {
          success:             true,
          spent:               cost,
          spentFromGratuitos,
          spentFromPremium,
          newBalanceGratuitos: newGratuitos,
          newBalancePremium:   newPremium,
        };
      });

      return result;
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      console.error('[spendCoins] Erro:', error);
      throw new HttpsError('internal', 'Erro ao debitar cristais.');
    }
  }
);