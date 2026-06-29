// ============================================
// LUMINA — EARN FRAGMENTS (FRAGMENTOS DE SINTONIA)
// functions/src/economy/earnFragments.ts
//
// v5.1 — NOVO ARQUIVO
//
// Fragmentos são a moeda secundária abundante.
// Atividades comuns pagam fragmentos, não cristais.
// 100 fragmentos = 1 cristal gratuito (conversão separada).
//
// REGRA 1:  Nenhum crédito client-side.
// REGRA 2:  runTransaction() obrigatório.
// REGRA 3:  Idempotência por uid+data+tipo+target.
// REGRA 12: Cofre — máx 20 fragmentos/dia de visitas.
// ============================================

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FRAGMENTS, DAILY_LIMITS } from '../config/economy';

export type FragmentOrigin =
  | 'MISSAO_COMUM'       // missões diárias comuns
  | 'VISITA_RECEBIDA'    // cofre — alguém visitou seu perfil
  | 'CURTIDA_RECEBIDA'   // cofre — alguém curtiu seu perfil
  | 'NOVA_SINTONIA'      // nova sintonia criada
  | 'RANKING_RECOMPENSA'; // top 10 no ranking semanal

interface EarnFragmentsRequest {
  origin:         FragmentOrigin;
  amount:         number;
  idempotencyKey: string;
  targetUid?:     string; // para visitas/curtidas (anti-farm)
}

export const earnFragments = onCall(
  { maxInstances: 10, region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    const { origin, amount, idempotencyKey, targetUid } = request.data as EarnFragmentsRequest;

    if (!origin || !idempotencyKey || !amount || amount <= 0) {
      throw new HttpsError('invalid-argument', 'Parâmetros inválidos.');
    }

    const db             = admin.firestore();
    const walletRef      = db.collection('wallets').doc(uid);
    const userRef        = db.collection('users').doc(uid);
    const idempotencyRef = db.collection('earnIdempotency').doc(idempotencyKey);

    try {
      const result = await db.runTransaction(async (t) => {
        const [walletSnap, idempotencySnap] = await Promise.all([
          t.get(walletRef),
          t.get(idempotencyRef),
        ]);

        if (idempotencySnap.exists) {
          throw new HttpsError('already-exists', 'Fragmento já registrado.');
        }
        if (!walletSnap.exists) {
          throw new HttpsError('not-found', 'Carteira não encontrada.');
        }

        const wallet = walletSnap.data()!;
        const today  = new Date().toISOString().slice(0, 10);

        // REGRA 12: máx 20 fragmentos/dia de visitas ao Cofre
        if (origin === 'VISITA_RECEBIDA') {
          const walletDay      = wallet.diaAtual ?? '';
          const vaultFragToday = walletDay === today
            ? (wallet.vaultFragmentsFromVisits ?? 0)
            : 0;

          if (vaultFragToday >= DAILY_LIMITS.VAULT_FRAGMENTS_FROM_VISITS) {
            return { skipped: true, reason: 'vault_visits_daily_cap_reached' };
          }

          t.update(walletRef, {
            vaultFragmentsFromVisits: admin.firestore.FieldValue.increment(amount),
            diaAtual: today,
          });
        }

        // Anti-farm: mesmo visitante só gera 1 fragmento/dia no Cofre
        if ((origin === 'VISITA_RECEBIDA' || origin === 'CURTIDA_RECEBIDA') && targetUid) {
          const userSnap = await t.get(userRef);
          if (userSnap.exists) {
            const daily       = userSnap.data()!.daily ?? {};
            const vaultSenders: string[] = daily.vaultFragmentSenders ?? [];
            if (vaultSenders.includes(targetUid)) {
              return { skipped: true, reason: 'already_counted_from_this_user' };
            }
            t.update(userRef, {
              'daily.vaultFragmentSenders': admin.firestore.FieldValue.arrayUnion(targetUid),
            });
          }
        }

        // Verifica expiração parcial de fragmentos (10% a cada 7 dias sem converter)
        const lastConversion    = wallet.lastFragmentConversion?.toDate?.() ?? null;
        const daysSinceConvert  = lastConversion
          ? (Date.now() - lastConversion.getTime()) / (1000 * 60 * 60 * 24)
          : 0;

        let currentFragments = wallet.fragments ?? 0;

        if (daysSinceConvert >= FRAGMENTS.EXPIRY_DAYS_WITHOUT_CONVERT) {
          const expiredAmount  = Math.floor(currentFragments * FRAGMENTS.EXPIRY_PERCENTAGE);
          currentFragments     = Math.max(0, currentFragments - expiredAmount);
          t.update(walletRef, { fragments: currentFragments });
        }

        const newFragments = currentFragments + amount;

        t.update(walletRef, {
          fragments:  newFragments,
          updatedAt:  admin.firestore.FieldValue.serverTimestamp(),
        });

        t.set(idempotencyRef, {
          uid, origin, amount,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, amount, newFragments };
      });

      return result;
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      console.error('[earnFragments] Erro:', error);
      throw new HttpsError('internal', 'Erro ao creditar fragmentos.');
    }
  }
);