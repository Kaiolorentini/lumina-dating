// ============================================
// LUMINA — OFFER ENGINE v5.1
// functions/src/premium/offerEngine.ts
//
// REGRA 11: Condição positiva — aparece quando
//   usuário tentou usar Premium sem saldo
// REGRA 7: OfferEligibilityService separado
// REGRA 6: Prioridade HIGH / NORMAL / LOW
// Máx 1 oferta/24h — nunca popup agressivo
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { PREMIUM_FLAGS, PREMIUM_VERSIONS } from './config/premiumFlags';

const db = admin.firestore();

// Catálogo de ofertas
const OFFERS_CATALOG = [
  {
    id:          'turbo_discount',
    label:       '⚡ Turbo com 20% off',
    description: 'Ative o Turbo Sintonia com desconto especial',
    originalCost: 120,
    discountedCost: 96,
    feature:     'TURBO',
    priority:    'HIGH' as const,
    trigger:     'TURBO_ATTEMPT',
  },
  {
    id:          'fertilizer_discount',
    label:       '🌱 Fertilizante com 15% off',
    description: 'Acelere sua evolução com desconto especial',
    originalCost: 80,
    discountedCost: 68,
    feature:     'FERTILIZER',
    priority:    'HIGH' as const,
    trigger:     'FERTILIZER_ATTEMPT',
  },
  {
    id:          'starter_pack',
    label:       '✨ Pack Iniciante',
    description: '120 Cristais Premium + 1 Turbo grátis',
    originalCost: 500,
    discountedCost: 400,
    feature:     'PACK',
    priority:    'NORMAL' as const,
    trigger:     'NO_PREMIUM_7_DAYS',
  },
];

// ── ELIGIBILITY SERVICE (REGRA 7) ──
async function checkEligibility(uid: string): Promise<{
  eligible:    boolean;
  reason:      string;
  offer:       typeof OFFERS_CATALOG[number] | null;
}> {
  const offerRef  = db.collection('offerLog').doc(uid);
  const offerDoc  = await offerRef.get();
  const offerData = offerDoc.data() ?? {};

  // Máx 1 oferta/24h
  const lastOfferAt = offerData.lastOfferAt?.toDate?.() ?? null;
  if (lastOfferAt) {
    const elapsed = Date.now() - lastOfferAt.getTime();
    if (elapsed < 24 * 3600000) {
      return { eligible: false, reason: 'cooldown_24h', offer: null };
    }
  }

  // Verifica trigger mais recente
  const lastTrigger = offerData.lastTrigger ?? '';
  const offer = OFFERS_CATALOG.find(o => o.trigger === lastTrigger)
    ?? OFFERS_CATALOG.find(o => o.priority === 'NORMAL')
    ?? null;

  return { eligible: true, reason: lastTrigger, offer };
}

// ── Registrar tentativa Premium sem saldo (REGRA 11) ──
export const registerPremiumAttempt = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    if (!PREMIUM_FLAGS.PREMIUM_OFFERS_ENABLED) {
      return { offerAvailable: false };
    }

    const { feature } = request.data as { feature: 'TURBO' | 'FERTILIZER' };
    const trigger     = `${feature}_ATTEMPT`;

    // Registra a tentativa
    await db.collection('offerLog').doc(uid).set({
      lastTrigger: trigger,
      updatedAt:   FieldValue.serverTimestamp(),
    }, { merge: true });

    // Verifica elegibilidade
    const { eligible, offer } = await checkEligibility(uid);

    if (!eligible || !offer) {
      return { offerAvailable: false };
    }

    // Cria oferta válida por 1h
    const expiresAt = new Date(Date.now() + 60 * 60000);
    const offerId   = `offer_${uid}_${Date.now()}`;

    await db.collection('activeOffers').doc(uid).set({
      offerId,
      uid,
      offer,
      trigger,
      expiresAt:   admin.firestore.Timestamp.fromDate(expiresAt),
      seen:        false,
      accepted:    false,
      priority:    offer.priority,
      version:     PREMIUM_VERSIONS.OFFER,
      createdAt:   FieldValue.serverTimestamp(),
    });

    await db.collection('offerLog').doc(uid).set({
      lastOfferAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      offerAvailable: true,
      offerId,
      offer,
      expiresAt: expiresAt.toISOString(),
    };
  }
);

// ── Buscar oferta ativa ──
export const getActiveOffer = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const offerDoc = await db.collection('activeOffers').doc(uid).get();
    if (!offerDoc.exists) return { hasOffer: false };

    const data      = offerDoc.data()!;
    const expiresAt = data.expiresAt?.toDate?.() ?? null;

    if (!expiresAt || expiresAt < new Date()) {
      return { hasOffer: false };
    }

    // Marca como vista
    if (!data.seen) {
      await offerDoc.ref.update({ seen: true });
    }

    return {
      hasOffer:   true,
      offerId:    data.offerId,
      offer:      data.offer,
      expiresAt:  expiresAt.toISOString(),
      remainingMs: expiresAt.getTime() - Date.now(),
      priority:   data.priority,
    };
  }
);