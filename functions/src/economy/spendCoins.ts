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
import { COSMETICS_CATALOG, COST_KEY_TO_COSMETIC } from '../config/cosmeticsCatalog';
import { BADGES_CATALOG, COST_KEY_TO_BADGE }       from '../config/badgesCatalog';
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
  grantedCosmeticId?:   string;  // FASE 5
  rentalExpiresAt?:     string;  // ISO, quando for aluguel
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

    // FASE 5: features cosméticas concedem um item além de debitar.
    // A concessão acontece DENTRO da transação do débito — se ela
    // falhar, o débito não acontece. Nunca cobrar sem entregar.
    // Molduras e badges compartilham o mesmo mecanismo: um item
    // com id, dias de aluguel e raridade. Normalizo os dois num
    // formato só para não duplicar o bloco de concessão.
    const cosmeticId = COST_KEY_TO_COSMETIC[feature] ?? null;
    const badgeId    = COST_KEY_TO_BADGE[feature]    ?? null;

    const cosmetic = cosmeticId
      ? { id: cosmeticId, rentalDays: COSMETICS_CATALOG[cosmeticId].rentalDays,
          rarity: COSMETICS_CATALOG[cosmeticId].rarity, kind: 'FRAME' as const }
      : badgeId
        ? { id: badgeId, rentalDays: BADGES_CATALOG[badgeId].rentalDays,
            rarity: BADGES_CATALOG[badgeId].rarity, kind: 'BADGE' as const }
        : null;

    // Molduras e badges vivem em campos separados: o usuário pode
    // ter uma de cada equipada ao mesmo tempo.
    const rentalField = cosmetic?.kind === 'BADGE' ? 'badgeRentals' : 'frameRentals';
    const userRef     = cosmetic ? db.collection('users').doc(uid) : null;

    try {
      const result = await db.runTransaction(async (t) => {
        // Firestore exige TODAS as leituras antes de qualquer
        // escrita na transação — por isso o usuário entra aqui.
        const snaps = await Promise.all([
          t.get(walletRef),
          idempotencyRef ? t.get(idempotencyRef) : Promise.resolve(null),
          userRef        ? t.get(userRef)        : Promise.resolve(null),
        ]);

        const walletSnap      = snaps[0];
        const idempotencySnap = snaps[1];
        const userSnap        = snaps[2];

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
        let grantedExpiry: string | undefined;

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

        // ── FASE 5: concessão do cosmético ──
        if (cosmetic && userRef) {
          if (cosmetic.rentalDays > 0) {
            // Aluguel. Se o usuário já tem a moldura e ela ainda
            // não expirou, SOMA os dias em vez de reiniciar — quem
            // recompra cedo não perde o tempo que pagou.
            const rentals  = userSnap?.data()?.progression?.[rentalField] ?? {};
            const current  = rentals[cosmetic.id]?.toDate?.() ?? null;
            const base     = current && current.getTime() > Date.now()
              ? current.getTime()
              : Date.now();
            const expiresAt = new Date(base + cosmetic.rentalDays * 24 * 3600000);
            grantedExpiry = expiresAt.toISOString();

            t.set(userRef, {
              progression: {
                [rentalField]: {
                  [cosmetic.id]: admin.firestore.Timestamp.fromDate(expiresAt),
                },
              },
            }, { merge: true });
          } else {
            // Permanente — só frames de conquista chegam aqui, e
            // eles não têm costKey, então na prática este ramo não
            // roda hoje. Fica pelo contrato do catálogo.
            t.set(userRef, {
              progression: { unlockedItems: { [cosmetic.id]: true } },
            }, { merge: true });
          }

          t.set(db.collection('economyLedger').doc(), {
            uid,
            tipo:        'COSMETIC_PURCHASE',
            origem:      'spendCoins',
            feature,
            cosmeticId:  cosmetic.id,
            cosmeticKind: cosmetic.kind,
            rarity:      cosmetic.rarity,
            rentalDays:  cosmetic.rentalDays,
            cristaisGastos: cost,
            timestamp:   now,
            imutavel:    true,
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
          ...(cosmetic ? { grantedCosmeticId: cosmetic.id } : {}),
          ...(cosmetic && cosmetic.rentalDays > 0
            ? { rentalExpiresAt: grantedExpiry }
            : {}),
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