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
// REGRA 3:  Idempotência por uid+data+tipo.
// REGRA 12 (cofre, máx 20 fragmentos/dia de visitas) vive no
// VaultService desde a FASE 2F — este arquivo não alimenta o Cofre.
// ============================================

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FRAGMENTS } from '../config/economy';
// VISITA_RECEBIDA, CURTIDA_RECEBIDA e NOVA_SINTONIA saíram na
// FASE 2F: essas origens creditavam em `wallets.fragments`, que é
// a carteira — o Cofre é `wallets.vaultFragments`, campo distinto.
// Quem alimenta o Cofre é o VaultService.
export type FragmentOrigin =
  | 'MISSAO_COMUM'       // missões diárias comuns
  | 'RANKING_RECOMPENSA'; // top 10 no ranking semanal

interface EarnFragmentsRequest {
  origin:         FragmentOrigin;
  amount:         number;
  idempotencyKey: string;
}

export const earnFragments = onCall(
  { maxInstances: 10, region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    const { origin, amount, idempotencyKey } = request.data as EarnFragmentsRequest;

    if (!origin || !idempotencyKey || !amount || amount <= 0) {
      throw new HttpsError('invalid-argument', 'Parâmetros inválidos.');
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

        if (idempotencySnap.exists) {
          throw new HttpsError('already-exists', 'Fragmento já registrado.');
        }
        if (!walletSnap.exists) {
          throw new HttpsError('not-found', 'Carteira não encontrada.');
        }

        const wallet = walletSnap.data()!;

        // O teto diário e o anti-farm por visitante viviam aqui e
        // migraram para o VaultService na FASE 2F, onde o Cofre é
        // de fato alimentado (fragmentsFromVisitsToday em wallets).

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