// ============================================
// LUMINA — EARN COINS (CRISTAIS GRATUITOS)
// functions/src/economy/earnCoins.ts
//
// v5.1 — Alinhado com novos parâmetros econômicos
//
// REGRA 1:  Nenhum crédito client-side.
// REGRA 2:  runTransaction() obrigatório.
// REGRA 3:  Idempotência por uid+data+tipo.
// REGRA 4:  Limite diário e mensal server-side.
// REGRA 6:  Timestamps sempre server-side.
// REGRA 15: auditLog em toda movimentação.
//
// NOVO v5.1:
// - Missões comuns pagam FRAGMENTOS, não cristais
// - Apenas missões especiais (raras) pagam cristais
// - Reset diário de dailyCristaisGratuitos verificado server-side
// - Fragmentos com expiração parcial controlada aqui
// ============================================

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { DAILY_LIMITS } from '../config/economy';
import { auditLogFinanceiro, AuditTipo } from '../utils/auditLogFinanceiro';
import { todayBr, monthBr } from '../utils/dateBr';
export type EarnCoinsOrigin =
  | 'LOGIN_DIARIO'
  | 'FAISCA_DESTINO'
  | 'MISSAO_ESPECIAL'      // apenas missões raras (1-2/semana) pagam cristais
  | 'CONQUISTA'
  | 'COFRE_SAQUE'
  | 'FRAGMENTOS_CONVERSAO'
  | 'PRESTIGIO_BONUS'
  | 'GALAXIA_PLUS_MENSAL'; // crédito da assinatura mensal

// Origens que NÃO pagam cristais — pagam fragmentos
// Missões comuns, visitas, curtidas → earnFragments (não earnCoins)
export const GRATUITO_ORIGINS: EarnCoinsOrigin[] = [
  'LOGIN_DIARIO',
  'FAISCA_DESTINO',
  'MISSAO_ESPECIAL',
  'CONQUISTA',
  'COFRE_SAQUE',
  'FRAGMENTOS_CONVERSAO',
  'PRESTIGIO_BONUS',
];

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

    // Galáxia Plus mensal credita Premium, não Gratuito
    const isPremiumCredit = origin === 'GALAXIA_PLUS_MENSAL';

    const db             = admin.firestore();
    const walletRef      = db.collection('wallets').doc(uid);
    const idempotencyRef = db.collection('earnIdempotency').doc(idempotencyKey);

    try {
      const result = await db.runTransaction(async (t) => {
        const [walletSnap, idempotencySnap] = await Promise.all([
          t.get(walletRef),
          t.get(idempotencyRef),
        ]);

        if (idempotencySnap.exists) {
          throw new HttpsError('already-exists', 'Recompensa já resgatada.');
        }

        if (!walletSnap.exists) {
          throw new HttpsError('not-found', 'Carteira não encontrada. Execute initWallet primeiro.');
        }

        const wallet = walletSnap.data()!;

        // Reset diário verificado server-side
        // BRT: em UTC o teto diário de cristais gratuitos zerava
        // às 21h, liberando o dobro no mesmo dia civil.
        const today        = todayBr();
        const walletDay    = wallet.diaAtual ?? '';
        const dailyTotal   = walletDay === today
          ? (wallet.dailyCristaisGratuitos ?? 0)
          : 0; // reset automático se dia mudou

        // Teto diário (apenas para Gratuitos)
        if (!isPremiumCredit && dailyTotal >= DAILY_LIMITS.CRYSTALS_GRATUITOS_MAX) {
          throw new HttpsError('resource-exhausted', 'Limite diário de cristais gratuitos atingido.');
        }

        // Teto mensal (apenas para Gratuitos)
        const currentMonth   = monthBr();
        const walletMonth    = wallet.mesAtual ?? '';
        const monthlyTotal   = walletMonth === currentMonth
          ? (wallet.cristaisGratuitosMensais ?? 0)
          : 0;

        if (!isPremiumCredit && monthlyTotal >= DAILY_LIMITS.CRYSTALS_GRATUITOS_MONTHLY_MAX) {
          throw new HttpsError('resource-exhausted', 'Limite mensal de cristais gratuitos atingido.');
        }

        // Garante que não ultrapassa teto diário
        const safeAmount = isPremiumCredit
          ? amount
          : Math.min(amount, DAILY_LIMITS.CRYSTALS_GRATUITOS_MAX - dailyTotal);

        const prevGratuitos = wallet.coinsGratuitos ?? 0;
        const prevPremium   = wallet.coinsPremium   ?? 0;
        const newGratuitos  = isPremiumCredit ? prevGratuitos : prevGratuitos + safeAmount;
        const newPremium    = isPremiumCredit ? prevPremium + safeAmount : prevPremium;
        const now           = admin.firestore.FieldValue.serverTimestamp();

        const walletUpdate: Record<string, unknown> = {
          totalEarned: admin.firestore.FieldValue.increment(safeAmount),
          mesAtual:    currentMonth,
          diaAtual:    today,
          updatedAt:   now,
        };

        if (isPremiumCredit) {
          walletUpdate.coinsPremium = newPremium;
        } else {
          walletUpdate.coinsGratuitos              = newGratuitos;
          walletUpdate.dailyCristaisGratuitos      = admin.firestore.FieldValue.increment(safeAmount);
          walletUpdate.cristaisGratuitosMensais    = monthlyTotal + safeAmount;
        }

        t.update(walletRef, walletUpdate);

        t.set(idempotencyRef, {
          uid, origin,
          amount: safeAmount,
          createdAt: now,
        });

        auditLogFinanceiro({
          uid,
          tipo:                    origin as AuditTipo,
          coinTipo:                isPremiumCredit ? 'premium' : 'gratuito',
          valor:                   safeAmount,
          origem:                  origin,
          saldoAnteriorGratuito:   prevGratuitos,
          saldoAnteriorPremium:    prevPremium,
          saldoPosteriorGratuito:  newGratuitos,
          saldoPosteriorPremium:   newPremium,
          metadata:                { idempotencyKey, isPremiumCredit },
        }, t);

        return {
          amount:             safeAmount,
          newBalanceGratuitos: newGratuitos,
          newBalancePremium:   newPremium,
        };
      });

      return { success: true, ...result };
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      console.error('[earnCoins] Erro:', error);
      throw new HttpsError('internal', 'Erro ao creditar cristais.');
    }
  }
);