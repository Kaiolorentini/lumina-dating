// ============================================
// LUMINA — FERTILIZANTE DA SINTONIA v5.1
// functions/src/premium/fertilizerService.ts
//
// REGRA GLOBAL PREMIUM:
// ✗ Nunca gera Cristais/Fragmentos/Prestígio
// ✗ Não afeta Ranking Social, Cofre, Conquistas
// ✓ Apenas XP +50% por 24h reais
// ✓ Transaction única: Wallet → Ativa → Ledger → UsageLog
// ✓ Não acumula: bloqueia compra se já ativo
// ✓ remainingTime calculado server-side
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  PREMIUM_FLAGS, PREMIUM_COSTS,
  PREMIUM_DURATIONS, PREMIUM_VERSIONS,
} from './config/premiumFlags';

const db = admin.firestore();

// ── Ativar Fertilizante ──
export const activateFertilizer = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    if (!PREMIUM_FLAGS.PREMIUM_FERTILIZER_ENABLED) {
      throw new functions.HttpsError('unavailable', 'Fertilizante temporariamente indisponível.');
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

      // Verifica saldo Premium
      const coinsPremium = wallet.coinsPremium ?? 0;
      if (coinsPremium < PREMIUM_COSTS.FERTILIZER) {
        throw new functions.HttpsError(
          'failed-precondition',
          `Cristais Premium insuficientes. Necessário: ${PREMIUM_COSTS.FERTILIZER}. Disponível: ${coinsPremium}.`
        );
      }

      // Verifica se já está ativo (REGRA: bloqueia nova compra)
      const fertExpiry = user.progression?.arvore?.fertilizanteExpiraEm?.toDate?.() ?? null;
      if (fertExpiry && fertExpiry > new Date()) {
        const remainingMs = fertExpiry.getTime() - Date.now();
        const remainingH  = Math.ceil(remainingMs / 3600000);
        throw new functions.HttpsError(
          'already-exists',
          `Fertilizante já ativo. Restam ${remainingH}h.`
        );
      }

      // Calcula expiração: 24h reais
      const expiresAt = new Date(Date.now() + PREMIUM_DURATIONS.FERTILIZER_HOURS * 3600000);
      const prevPremium = coinsPremium;

      // REGRA 9: Transaction única — Wallet → Ativa → Ledger → UsageLog
      // 1. Debita Cristais Premium
      t.set(walletRef, {
        coinsPremium: FieldValue.increment(-PREMIUM_COSTS.FERTILIZER),
        updatedAt:    FieldValue.serverTimestamp(),
      }, { merge: true });

      // 2. Ativa no perfil
      t.set(userRef, {
        'progression.arvore.fertilizanteAtivo':    true,
        'progression.arvore.fertilizanteExpiraEm': admin.firestore.Timestamp.fromDate(expiresAt),
        'progression.arvore.fertilizanteVersion':  PREMIUM_VERSIONS.FERTILIZER,
      }, { merge: true });

      // 3. Economy Ledger
      t.set(ledgerRef.doc(), {
        uid,
        tipo:            'PREMIUM_PURCHASE',
        feature:         'FERTILIZER',
        cristaisPremium: -PREMIUM_COSTS.FERTILIZER,
        saldoAntes:      prevPremium,
        saldoDepois:     prevPremium - PREMIUM_COSTS.FERTILIZER,
        expiresAt:       admin.firestore.Timestamp.fromDate(expiresAt),
        timestamp:       FieldValue.serverTimestamp(),
        imutavel:        true,
      });

      // 4. PremiumUsageLog (REGRA 1)
      const usageId = `fert_${uid}_${Date.now()}`;
      t.set(logRef.doc(usageId), {
        usageId,
        uid,
        featureType:  'FERTILIZER',
        purchaseId:   usageId,
        activatedAt:  FieldValue.serverTimestamp(),
        expiresAt:    admin.firestore.Timestamp.fromDate(expiresAt),
        status:       'ACTIVE',
        version:      PREMIUM_VERSIONS.FERTILIZER,
        cost:         PREMIUM_COSTS.FERTILIZER,
      });

      // 5. Analytics Premium
      t.set(db.collection('premiumAnalytics').doc(usageId), {
        uid,
        feature:     'FERTILIZER',
        activatedAt: FieldValue.serverTimestamp(),
        expiresAt:   admin.firestore.Timestamp.fromDate(expiresAt),
        cost:        PREMIUM_COSTS.FERTILIZER,
        version:     PREMIUM_VERSIONS.FERTILIZER,
      });

      return {
        activated:         true,
        expiresAt:         expiresAt.toISOString(),
        remainingMs:       expiresAt.getTime() - Date.now(),
        xpMultiplier:      1.5,
        crystalsSpent:     PREMIUM_COSTS.FERTILIZER,
        newBalancePremium: prevPremium - PREMIUM_COSTS.FERTILIZER,
      };
    });

    return { success: true, ...result };
  }
);

// ── Status do Fertilizante ──
export const getFertilizerStatus = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const userDoc  = await db.collection('users').doc(uid).get();
    const userData = userDoc.data() ?? {};
    const arvore   = userData.progression?.arvore ?? {};

    const fertExpiry  = arvore.fertilizanteExpiraEm?.toDate?.() ?? null;
    const isActive    = fertExpiry ? fertExpiry > new Date() : false;
    const remainingMs = isActive ? fertExpiry!.getTime() - Date.now() : 0;

    const walletDoc   = await db.collection('wallets').doc(uid).get();
    const premium     = walletDoc.data()?.coinsPremium ?? 0;

    // REGRA 10: status padronizado
    let status: string = 'READY';
    if (isActive) status = 'ACTIVE';
    else if (premium < PREMIUM_COSTS.FERTILIZER) status = 'LOCKED';

    return {
      status,
      isActive,
      expiresAt:        fertExpiry?.toISOString()   ?? null,
      remainingMs:      Math.max(0, remainingMs),   // REGRA 5
      remainingHours:   Math.ceil(remainingMs / 3600000),
      xpMultiplier:     isActive ? 1.5 : 1.0,
      cost:             PREMIUM_COSTS.FERTILIZER,
      coinsPremium:     premium,
      enabled:          PREMIUM_FLAGS.PREMIUM_FERTILIZER_ENABLED,
    };
  }
);