// ============================================
// LUMINA — TRUST SCORE
// functions/src/security/trustScore.ts
// ============================================

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

const TRUST_CRITERIA = {
  EMAIL_VERIFIED:      15,
  PHONE_VERIFIED:      20,
  PHOTO_UPLOADED:      15,
  PROFILE_COMPLETE:    15,
  ACCOUNT_AGE_7_DAYS:  10,
  ACCOUNT_AGE_30_DAYS: 10,
  ACTIVE_3_DAYS:       10,
  SINTONIA_REAL:        5,
} as const;

export const TRUST_THRESHOLDS = {
  MIN_FOR_XP:          30,
  MIN_FOR_RANKING:     50,
  MIN_FOR_REWARDS:     30,
  MIN_FOR_COINS_SPEND: 20,
} as const;

export interface TrustScoreResult {
  score:          number;
  canEarnXP:      boolean;
  canEarnRewards: boolean;
  canJoinRanking: boolean;
  breakdown:      Partial<Record<keyof typeof TRUST_CRITERIA, boolean>>;
}

export async function calculateAndUpdateTrustScore(
  uid: string,
  t?: admin.firestore.Transaction
): Promise<TrustScoreResult> {
  const db      = admin.firestore();
  const userRef = db.collection('users').doc(uid);

  // Admin SDK: .exists é propriedade booleana, não método
  const userSnap = t ? await t.get(userRef) : await userRef.get();
  if (!userSnap.exists) throw new Error('Usuário não encontrado.');

  const user    = userSnap.data()!;
  const auth    = await admin.auth().getUser(uid);
  const now     = Date.now();
  const created = auth.metadata.creationTime
    ? new Date(auth.metadata.creationTime).getTime()
    : now;
  const ageDays = (now - created) / (1000 * 60 * 60 * 24);

  const breakdown: Partial<Record<keyof typeof TRUST_CRITERIA, boolean>> = {
    EMAIL_VERIFIED:      !!auth.emailVerified,
    PHONE_VERIFIED:      !!auth.phoneNumber,
    PHOTO_UPLOADED:      !!(user.photoURL),
    PROFILE_COMPLETE:    (user.profileCompleteness ?? 0) >= 80,
    ACCOUNT_AGE_7_DAYS:  ageDays >= 7,
    ACCOUNT_AGE_30_DAYS: ageDays >= 30,
    ACTIVE_3_DAYS:       (user.progression?.streakAtual ?? 0) >= 3,
    SINTONIA_REAL:       (user.sintoniaCount ?? 0) >= 1,
  };

  let score = 0;
  for (const [key, met] of Object.entries(breakdown)) {
    if (met) score += TRUST_CRITERIA[key as keyof typeof TRUST_CRITERIA];
  }

  const result: TrustScoreResult = {
    score,
    canEarnXP:       score >= TRUST_THRESHOLDS.MIN_FOR_XP,
    canEarnRewards:  score >= TRUST_THRESHOLDS.MIN_FOR_REWARDS,
    canJoinRanking:  score >= TRUST_THRESHOLDS.MIN_FOR_RANKING,
    breakdown,
  };

  const update = {
    trustScore:           score,
    trustScoreBreakdown:  breakdown,
    trustScoreUpdatedAt:  admin.firestore.FieldValue.serverTimestamp(),
  };

  if (t) {
    t.update(userRef, update);
  } else {
    await userRef.update(update);
  }

  return result;
}

export const updateTrustScore = onCall(
  { maxInstances: 10, region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    try {
      const result = await calculateAndUpdateTrustScore(uid);
      return { success: true, ...result };
    } catch (error: unknown) {
      console.error('[updateTrustScore] Erro:', error);
      throw new HttpsError('internal', 'Erro ao calcular trustScore.');
    }
  }
);