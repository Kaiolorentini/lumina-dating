// ============================================
// LUMINA — FRAGMENTS STATUS + EXPIRY v5.2
// functions/src/engagement/fragments.ts
//
// NÃO contém convertFragments — já existe em
// functions/src/economy/convertFragments.ts
//
// Este arquivo adiciona:
// - getFragmentsStatus: status atual do usuário
// - expireFragments: scheduled — 10%/7dias
// ============================================

import * as functions  from 'firebase-functions/v2/https';
import * as scheduler  from 'firebase-functions/v2/scheduler';
import * as admin      from 'firebase-admin';
import { FieldValue }  from 'firebase-admin/firestore';
import { FRAGMENTS }   from '../config/economy';

const db = admin.firestore();

// ── Status de fragmentos ──
export const getFragmentsStatus = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const walletDoc = await db.collection('wallets').doc(uid).get();

    if (!walletDoc.exists) {
      return {
        fragments:           0,
        coinsGratuitos:      0,
        coinsPremium:        0,
        canConvert:          false,
        crystalsAvailable:   0,
        fragmentsNeeded:     FRAGMENTS.FRAGMENTS_PER_CRYSTAL,
        cooldownActive:      false,
        cooldownRemainingMs: 0,
        lastConversionAt:    null,
      };
    }

    const wallet     = walletDoc.data()!;
    const fragments  = wallet.fragments ?? 0;
    const lastConvAt = wallet.lastFragmentConversion?.toDate?.() ?? null;

    const cooldownMs     = FRAGMENTS.CONVERSION_COOLDOWN_HOURS * 60 * 60 * 1000;
    const cooldownActive = lastConvAt
      ? (Date.now() - lastConvAt.getTime()) < cooldownMs
      : false;
    const cooldownRemaining = cooldownActive
      ? cooldownMs - (Date.now() - lastConvAt!.getTime())
      : 0;

    const crystalsAvailable = Math.min(
      Math.floor(fragments / FRAGMENTS.FRAGMENTS_PER_CRYSTAL),
      FRAGMENTS.MAX_CRYSTALS_PER_CONVERSION
    );

    return {
      fragments,
      coinsGratuitos:      wallet.coinsGratuitos  ?? 0,
      coinsPremium:        wallet.coinsPremium     ?? 0,
      canConvert:          fragments >= FRAGMENTS.FRAGMENTS_PER_CRYSTAL && !cooldownActive,
      crystalsAvailable,
      fragmentsNeeded:     FRAGMENTS.FRAGMENTS_PER_CRYSTAL,
      cooldownActive,
      cooldownRemainingMs: Math.max(0, cooldownRemaining),
      lastConversionAt:    lastConvAt?.toISOString() ?? null,
    };
  }
);

// ── Expiração parcial de fragmentos (10% a cada 7 dias sem converter) ──
//
// CORREÇÕES v5.3:
// A) Query com filtro único — duas desigualdades exigiam índice
//    e ainda assim excluiriam documentos sem o campo.
// B) Carteiras que NUNCA converteram não têm lastFragmentConversion
//    e ficavam invisíveis. Agora o filtro de data é feito no código,
//    com fallback para lastFragmentExpiry e createdAt.
// C) lastFragmentExpiry agora é gravado — sem ele a expiração
//    reincidia TODO DIA em vez de a cada 7 dias.
export const expireFragments = scheduler.onSchedule(
  { schedule: 'every 24 hours', region: 'us-central1' },
  async () => {
    const cutoff = new Date(
      Date.now() - FRAGMENTS.EXPIRY_DAYS_WITHOUT_CONVERT * 24 * 60 * 60 * 1000
    );

    // Filtro único: sem índice composto e sem excluir documentos
    const snap = await db.collection('wallets')
      .where('fragments', '>', 0)
      .limit(500)
      .get();

    const batch = db.batch();
    let   processed = 0;
    let   skipped   = 0;

    for (const doc of snap.docs) {
      const wallet    = doc.data();
      const fragments = wallet.fragments ?? 0;
      if (fragments <= 0) continue;

      // Referência = evento mais recente entre conversão, expiração e criação
      const lastConv   = wallet.lastFragmentConversion?.toDate?.() ?? null;
      const lastExpiry = wallet.lastFragmentExpiry?.toDate?.()     ?? null;
      const createdAt  = wallet.createdAt?.toDate?.()              ?? null;

      const candidates = [lastConv, lastExpiry, createdAt].filter(Boolean) as Date[];
      if (candidates.length === 0) { skipped++; continue; }

      const reference = new Date(Math.max(...candidates.map(d => d.getTime())));

      // Ainda dentro da janela de 7 dias
      if (reference > cutoff) { skipped++; continue; }

      const expiry    = Math.floor(fragments * FRAGMENTS.EXPIRY_PERCENTAGE);
      if (expiry <= 0) { skipped++; continue; }

      const remaining = Math.max(0, fragments - expiry);

      batch.update(doc.ref, {
        fragments:           remaining,
        lastFragmentExpiry:  FieldValue.serverTimestamp(),
        updatedAt:           FieldValue.serverTimestamp(),
      });

      // Ledger da expiração
      batch.set(db.collection('economyLedger').doc(), {
        uid:                 doc.id,
        tipo:                'EXPIRACAO_FRAGMENTOS',
        origem:              'expireFragments',
        fragmentosExpirados: expiry,
        saldoAntes:          fragments,
        saldoDepois:         remaining,
        referenceDate:       reference.toISOString(),
        timestamp:           FieldValue.serverTimestamp(),
        imutavel:            true,
      });

      processed++;
    }

    if (processed > 0) await batch.commit();
    console.log(`[expireFragments] Expirados: ${processed} | Ignorados: ${skipped} | Analisados: ${snap.size}`);
  }
);