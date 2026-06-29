// ============================================
// LUMINA — EARN COINS (CRISTAIS GRATUITOS)
// functions/src/economy/earnCoins.ts
//
// REGRA 1: Nenhum crédito client-side.
// REGRA 2: runTransaction() obrigatório.
// REGRA 3: Idempotência por uid+data+tipo.
// REGRA 4: Limite diário e mensal server-side.
// REGRA 6: Timestamps sempre server-side.
// REGRA 15: auditLog em toda movimentação.
// ============================================

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { DAILY_LIMITS } from '../config/economy';
import { auditLogFinanceiro, AuditTipo } from '../utils/auditLogFinanceiro';

export type EarnCoinsOrigin =
  | 'LOGIN_DIARIO'
  | 'FAISCA_DESTINO'
  | 'MISSAO_COMPLETA'
  | 'CONQUISTA'
  | 'COFRE_SAQUE'
  | 'FRAGMENTOS_CONVERSAO'
  | 'PRESTIGIO_BONUS';

interface EarnCoinsRequest {
  origin:         EarnCoinsOrigin;
  amount:         number;
  idempotencyKey: string; // uid+YYYY-MM-DD+origin
}

export const earnCoins = onCall(
  { maxInstances: 10, region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    const { origin, amount, idempotencyKey } = request.data as EarnCoinsRequest;

    if (!origin || !idempotencyKey) {
      throw new HttpsError('invalid-argument', 'Parâmetros inválidos.');
    }
    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      throw new HttpsError('invalid-argument', 'Valor inválido.');
    }

    const db             = admin.firestore();
    const walletRef      = db.collection('wallets').doc(uid);
    const idempotencyRef = db.collection('earnIdempotency').doc(idempotencyKey);

    try {
      const result = await db.runTransaction(async (t) => {
        const [walletSnap, idempotencySnap] = await Promise.all([
          t.get(walletRef),
          t.get(idempotencyRef),
        ]);

        // Admin SDK: .exists é propriedade booleana (sem parênteses)
        if (idempotencySnap.exists) {
          throw new HttpsError('already-exists', 'Recompensa já resgatada.');
        }

        if (!walletSnap.exists) {
          throw new HttpsError('not-found', 'Carteira não encontrada. Execute initWallet primeiro.');
        }

        const wallet = walletSnap.data()!;

        // Teto diário
        const currentDailyTotal = wallet.dailyCristaisGratuitos ?? 0;
        if (currentDailyTotal >= DAILY_LIMITS.CRYSTALS_GRATUITOS_MAX) {
          throw new HttpsError('resource-exhausted', 'Limite diário atingido.');
        }

        // Teto mensal
        const currentMonth      = new Date().toISOString().slice(0, 7);
        const walletMonth       = wallet.mesAtual ?? '';
        const currentMonthly    = walletMonth === currentMonth
          ? (wallet.cristaisGratuitosMensais ?? 0)
          : 0;

        if (currentMonthly >= DAILY_LIMITS.CRYSTALS_GRATUITOS_MONTHLY_MAX) {
          throw new HttpsError('resource-exhausted', 'Limite mensal atingido.');
        }

        // Garante que não ultrapassa o teto diário
        const safeAmount = Math.min(
          amount,
          DAILY_LIMITS.CRYSTALS_GRATUITOS_MAX - currentDailyTotal
        );

        const prevGratuitos = wallet.coinsGratuitos ?? 0;
        const prevPremium   = wallet.coinsPremium   ?? 0;
        const newGratuitos  = prevGratuitos + safeAmount;
        const newMonthly    = currentMonthly + safeAmount;

        const now = admin.firestore.FieldValue.serverTimestamp();

        t.update(walletRef, {
          coinsGratuitos:           newGratuitos,
          totalEarned:              admin.firestore.FieldValue.increment(safeAmount),
          dailyCristaisGratuitos:   admin.firestore.FieldValue.increment(safeAmount),
          cristaisGratuitosMensais: newMonthly,
          mesAtual:                 currentMonth,
          updatedAt:                now,
        });

        t.set(idempotencyRef, {
          uid,
          origin,
          amount: safeAmount,
          createdAt: now,
        });

        auditLogFinanceiro({
          uid,
          tipo:                    origin as AuditTipo,
          coinTipo:                'gratuito',
          valor:                   safeAmount,
          origem:                  origin,
          saldoAnteriorGratuito:   prevGratuitos,
          saldoAnteriorPremium:    prevPremium,
          saldoPosteriorGratuito:  newGratuitos,
          saldoPosteriorPremium:   prevPremium,
          metadata:                { idempotencyKey },
        }, t);

        return { amount: safeAmount, newBalance: newGratuitos };
      });

      return { success: true, ...result };
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      console.error('[earnCoins] Erro:', error);
      throw new HttpsError('internal', 'Erro ao creditar cristais.');
    }
  }
);