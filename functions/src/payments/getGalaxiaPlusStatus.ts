// ============================================
// LUMINA — STATUS DA GALÁXIA PLUS
// functions/src/payments/getGalaxiaPlusStatus.ts
//
// Tudo que a tela precisa numa chamada: se está ativa, quanto
// falta, o que já rendeu e quanto ainda há para usar.
//
// ── POR QUE MOSTRAR O CONSUMO ──
//
// "Você tem 20% de bônus na Faísca" é uma promessa. "Esse bônus
// já te deu 34 cristais" é um fato. A renovação se decide
// olhando o que a assinatura já entregou, não o que ela promete.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { GALAXIA_PLUS, COSTS } from '../config/economy';
import { todayBr } from '../utils/dateBr';

const db = admin.firestore();

export const getGalaxiaPlusStatus = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    const [subSnap, cardSnap] = await Promise.all([
      db.collection('galaxiaPlus').doc(uid).get(),
      db.collection('destinyCards').doc(uid).get(),
    ]);

    const sub = subSnap.data() ?? {};

    const expiresAtDate = (sub.expiresAt as admin.firestore.Timestamp | undefined)
      ?.toDate?.() ?? null;
    const now    = Date.now();
    const active = expiresAtDate ? expiresAtDate.getTime() > now : false;

    // Dias restantes, arredondado para cima: faltando 30
    // minutos, a tela diz "1 dia" e não "0".
    const daysLeft = active && expiresAtDate
      ? Math.ceil((expiresAtDate.getTime() - now) / (24 * 3600 * 1000))
      : 0;

    // Cartas de hoje. O documento guarda a data, então um
    // contador de ontem não vale.
    const cardData  = cardSnap.data() ?? {};
    const cardsToday = cardData.date === todayBr()
      ? (cardData.drawsUsed as number) ?? 0
      : 0;

    const turbosGranted = (sub.turbosGranted as number) ?? 0;
    const turbosUsed    = (sub.turbosUsed    as number) ?? 0;

    return {
      active,
      expiresAt: expiresAtDate?.toISOString() ?? null,
      daysLeft,

      // Nunca assinou, ou já assinou e expirou. A tela muda o
      // texto: quem já teve sabe o que está perdendo.
      everSubscribed: !!sub.activatedAt,
      totalRenewals:  (sub.totalRenewals as number) ?? 0,

      price:    GALAXIA_PLUS.PRICE,
      duration: GALAXIA_PLUS.DURATION_DAYS,

      // O que a ativação entrega
      grants: {
        crystals: GALAXIA_PLUS.CRYSTALS_ON_ACTIVATION,
        turbos:   GALAXIA_PLUS.TURBOS_ON_ACTIVATION,
        badge:    GALAXIA_PLUS.BADGE_ID,
        renewalFragments: GALAXIA_PLUS.RENEWAL_FRAGMENTS,
      },

      // O que está valendo agora, com o consumo de cada um
      benefits: {
        destinyCards: {
          perDay:    GALAXIA_PLUS.DESTINY_CARDS_PER_DAY,
          usedToday: cardsToday,
          left:      Math.max(0, GALAXIA_PLUS.DESTINY_CARDS_PER_DAY - cardsToday),
          totalDrawn: (sub.cardsDrawnTotal as number) ?? 0,
        },
        turbos: {
          granted:   turbosGranted,
          used:      turbosUsed,
          available: Math.max(0, turbosGranted - turbosUsed),
        },
        faisca: {
          bonusPercent: Math.round(GALAXIA_PLUS.FAISCA_BONUS * 100),
          crystalsEarned: (sub.faiscaBonusTotal as number) ?? 0,
        },
        visitors: {
          normalCost:     COSTS.REVEAL_VISITORS,
          timesRevealed:  (sub.visitorsRevealed as number) ?? 0,
          crystalsSaved:  (sub.crystalsSavedTotal as number) ?? 0,
        },
        vault: {
          instantWithdraws:    (sub.instantWithdraws as number) ?? 0,
          crystalsFromInstant: (sub.crystalsFromInstant as number) ?? 0,
        },
      },
    };
  },
);