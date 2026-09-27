// ============================================
// LUMINA — FRAGMENTS STATUS v6.0
// functions/src/engagement/fragments.ts
//
// v6.0 — SEM EXPIRAÇÃO E SEM ESPERA.
//
// expireFragments REMOVIDA (decisão de produto): com a conversão
// livre, expirar só punia. Ela também só olhava as primeiras 500
// carteiras, sempre as mesmas — acima disso ninguém expirava.
//
// A conversão fica no convertFragments (economy/).
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FRAGMENTS }  from '../config/economy';

const db = admin.firestore();

// ── Status de fragmentos ──
export const getFragmentsStatus = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const walletDoc  = await db.collection('wallets').doc(uid).get();
    const wallet     = walletDoc.data() ?? {};
    const perCrystal = FRAGMENTS.FRAGMENTS_PER_CRYSTAL;

    const fragments  = (wallet.fragments as number) ?? 0;
    const lastConvAt = wallet.lastFragmentConversion?.toDate?.() ?? null;

    return {
      fragments,
      coinsGratuitos:      (wallet.coinsGratuitos as number) ?? 0,
      coinsPremium:        (wallet.coinsPremium   as number) ?? 0,
      canConvert:          fragments >= perCrystal,
      crystalsAvailable:   Math.floor(fragments / perCrystal),
      fragmentsPerCrystal: perCrystal,
      // Mantido para versões antigas do app.
      fragmentsNeeded:     perCrystal,
      lastConversionAt:    lastConvAt?.toISOString() ?? null,
    };
  }
);