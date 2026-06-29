// ============================================
// LUMINA — TURBO SINTONIA v5.1
// functions/src/premium/turboService.ts
//
// REGRA GLOBAL PREMIUM:
// ✗ Nunca garante aparecer — apenas aumenta chance
// ✗ Nunca afeta Ranking, Prestígio, Conquistas
// ✓ boostScore: baseBoostScore × turboMultiplier
// ✓ 30 minutos reais server-side
// ✓ Cooldown 5 min entre ativações
// ✓ Apenas 1 Turbo ativo por vez
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  PREMIUM_FLAGS, PREMIUM_COSTS,
  PREMIUM_DURATIONS, PREMIUM_VERSIONS,
  TURBO_SCORE,
} from './config/premiumFlags';

const db = admin.firestore();

// ── Ativar Turbo Sintonia ──
export const activateTurbo = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    if (!PREMIUM_FLAGS.PREMIUM_TURBO_ENABLED) {
      throw new functions.HttpsError('unavailable', 'Turbo Sintonia temporariamente indisponível.');
    }

    const walletRef = db.collection('wallets').doc(uid);
    const userRef   = db.collection('users').doc(uid);
    const logRef    = db.collection('premiumUsageLog');
    const ledgerRef = db.collection('economyLedger');

    const result = await db.runTransaction(async (t) => {
      const [walletDoc, userDoc] = await Promise.all([
        t.get(walletRef),
        t.get(userRef),
      ]);

      const wallet = walletDoc.data() ?? {};
      const user   = userDoc.data()   ?? {};

      // Verifica saldo
      const coinsPremium = wallet.coinsPremium ?? 0;
      if (coinsPremium < PREMIUM_COSTS.TURBO) {
        throw new functions.HttpsError(
          'failed-precondition',
          `Cristais Premium insuficientes. Necessário: ${PREMIUM_COSTS.TURBO}. Disponível: ${coinsPremium}.`
        );
      }

      // Verifica se já existe Turbo ativo
      const turboExpiry = user.turbo?.expiresAt?.toDate?.() ?? null;
      if (turboExpiry && turboExpiry > new Date()) {
        const remainingMin = Math.ceil((turboExpiry.getTime() - Date.now()) / 60000);
        throw new functions.HttpsError(
          'already-exists',
          `Turbo já ativo. Restam ${remainingMin} minutos.`
        );
      }

      // Cooldown de 5 minutos entre ativações
      const lastTurboAt = user.turbo?.lastActivatedAt?.toDate?.() ?? null;
      if (lastTurboAt) {
        const elapsed = Date.now() - lastTurboAt.getTime();
        if (elapsed < PREMIUM_DURATIONS.TURBO_COOLDOWN_SECS * 1000) {
          const cooldownLeft = Math.ceil((PREMIUM_DURATIONS.TURBO_COOLDOWN_SECS * 1000 - elapsed) / 1000);
          throw new functions.HttpsError(
            'resource-exhausted',
            `Aguarde ${cooldownLeft}s antes de ativar novamente.`
          );
        }
      }

      const expiresAt   = new Date(Date.now() + PREMIUM_DURATIONS.TURBO_MINUTES * 60000);
      const prevPremium = coinsPremium;

      // REGRA 4: boostScore = base × multiplier (não hardcoded)
      const boostFinal = TURBO_SCORE.BASE * TURBO_SCORE.MULTIPLIER;

      // REGRA 9: Transaction única
      // 1. Debita Premium
      t.set(walletRef, {
        coinsPremium: FieldValue.increment(-PREMIUM_COSTS.TURBO),
        updatedAt:    FieldValue.serverTimestamp(),
      }, { merge: true });

      // 2. Ativa Turbo no perfil
      t.set(userRef, {
        turbo: {
          active:          true,
          expiresAt:       admin.firestore.Timestamp.fromDate(expiresAt),
          boostScore:      boostFinal,
          baseBoostScore:  TURBO_SCORE.BASE,
          turboMultiplier: TURBO_SCORE.MULTIPLIER,
          lastActivatedAt: FieldValue.serverTimestamp(),
          version:         PREMIUM_VERSIONS.TURBO,
        },
      }, { merge: true });

      // 3. Economy Ledger
      t.set(ledgerRef.doc(), {
        uid,
        tipo:            'PREMIUM_PURCHASE',
        feature:         'TURBO',
        cristaisPremium: -PREMIUM_COSTS.TURBO,
        saldoAntes:      prevPremium,
        saldoDepois:     prevPremium - PREMIUM_COSTS.TURBO,
        boostScore:      boostFinal,
        expiresAt:       admin.firestore.Timestamp.fromDate(expiresAt),
        timestamp:       FieldValue.serverTimestamp(),
        imutavel:        true,
      });

      // 4. PremiumUsageLog (REGRA 1)
      const usageId = `turbo_${uid}_${Date.now()}`;
      t.set(logRef.doc(usageId), {
        usageId,
        uid,
        featureType:  'TURBO',
        purchaseId:   usageId,
        activatedAt:  FieldValue.serverTimestamp(),
        expiresAt:    admin.firestore.Timestamp.fromDate(expiresAt),
        status:       'ACTIVE',
        version:      PREMIUM_VERSIONS.TURBO,
        cost:         PREMIUM_COSTS.TURBO,
        boostScore:   boostFinal,
      });

      // 5. Analytics
      t.set(db.collection('premiumAnalytics').doc(usageId), {
        uid,
        feature:     'TURBO',
        activatedAt: FieldValue.serverTimestamp(),
        expiresAt:   admin.firestore.Timestamp.fromDate(expiresAt),
        cost:        PREMIUM_COSTS.TURBO,
        boostScore:  boostFinal,
        version:     PREMIUM_VERSIONS.TURBO,
      });

      return {
        activated:         true,
        expiresAt:         expiresAt.toISOString(),
        remainingMs:       expiresAt.getTime() - Date.now(),
        boostScore:        boostFinal,
        baseBoostScore:    TURBO_SCORE.BASE,
        turboMultiplier:   TURBO_SCORE.MULTIPLIER,
        crystalsSpent:     PREMIUM_COSTS.TURBO,
        newBalancePremium: prevPremium - PREMIUM_COSTS.TURBO,
      };
    });

    return { success: true, ...result };
  }
);

// ── Status do Turbo ──
export const getTurboStatus = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const userDoc  = await db.collection('users').doc(uid).get();
    const userData = userDoc.data() ?? {};
    const turbo    = userData.turbo ?? {};

    const turboExpiry   = turbo.expiresAt?.toDate?.()       ?? null;
    const lastActive    = turbo.lastActivatedAt?.toDate?.() ?? null;
    const isActive      = turboExpiry ? turboExpiry > new Date() : false;
    const remainingMs   = isActive ? turboExpiry!.getTime() - Date.now() : 0;

    // Cooldown check
    const cooldownMs    = lastActive
      ? PREMIUM_DURATIONS.TURBO_COOLDOWN_SECS * 1000 - (Date.now() - lastActive.getTime())
      : 0;
    const inCooldown    = !isActive && cooldownMs > 0;

    const walletDoc     = await db.collection('wallets').doc(uid).get();
    const premium       = walletDoc.data()?.coinsPremium ?? 0;

    // REGRA 10: status padronizado
    let status: string = 'READY';
    if (isActive)                             status = 'ACTIVE';
    else if (inCooldown)                      status = 'COOLDOWN';
    else if (premium < PREMIUM_COSTS.TURBO)   status = 'LOCKED';

    return {
      status,
      isActive,
      expiresAt:       turboExpiry?.toISOString() ?? null,
      remainingMs:     Math.max(0, remainingMs),
      remainingMin:    Math.ceil(remainingMs / 60000),
      boostScore:      isActive ? (turbo.boostScore ?? TURBO_SCORE.BASE * TURBO_SCORE.MULTIPLIER) : TURBO_SCORE.BASE,
      cooldownMs:      Math.max(0, cooldownMs),
      inCooldown,
      cost:            PREMIUM_COSTS.TURBO,
      coinsPremium:    premium,
      enabled:         PREMIUM_FLAGS.PREMIUM_TURBO_ENABLED,
    };
  }
);