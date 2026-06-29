// ============================================
// LUMINA — FAÍSCA DO DESTINO CLOUD FUNCTION v5.1
// functions/src/engagement/dailyFaisca.ts
//
// REGRAS ANTIFRAUDE APLICADAS:
// 1. Nenhum crédito client-side
// 2. runTransaction() obrigatório
// 3. Idempotência: uid + data (YYYY-MM-DD)
// 4. Limite: 1x por dia
// 5. serverTimestamp() — nunca Date.now()
// 20. auditLog para toda movimentação
//
// PROBABILIDADES (doc v5.0):
// 60% → 2 cristais
// 25% → 5 cristais
// 10% → 10 cristais
//  4% → 20 cristais
//  1% → 50 cristais
// Média real: ~4,7 cristais/dia
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

// Tabela de probabilidades acumuladas
const FAISCA_TABLE = [
  { threshold: 0.60, value: 2  },  // 60%
  { threshold: 0.85, value: 5  },  // 25%
  { threshold: 0.95, value: 10 },  // 10%
  { threshold: 0.99, value: 20 },  //  4%
  { threshold: 1.00, value: 50 },  //  1%
];

function rollFaisca(): number {
  const roll = Math.random();
  for (const entry of FAISCA_TABLE) {
    if (roll < entry.threshold) return entry.value;
  }
  return 2; // fallback seguro
}

// ── Resgatar Faísca do Destino ──
export const claimDailyFaisca = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new functions.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const walletRef = db.collection('wallets').doc(uid);
    const faiscaRef = db.collection('dailyFaisca').doc(uid);
    const auditRef  = db.collection('wallets').doc(uid).collection('auditLog');

    const todayStr = new Date().toISOString().slice(0, 10);

    try {
      const result = await db.runTransaction(async (t) => {
        const [faiscaDoc, walletDoc] = await Promise.all([
          t.get(faiscaRef),
          t.get(walletRef),
        ]);

        const faiscaData = faiscaDoc.data() ?? {};
        const walletData = walletDoc.data() ?? {};

        // ── REGRA 3 + 4: Idempotência ──
        if (faiscaData.lastClaimedDate === todayStr) {
          throw new functions.HttpsError(
            'already-exists',
            'Faísca do Destino já resgatada hoje.'
          );
        }

        // Rola o dado — server-side, não manipulável
        const crystals       = rollFaisca();
        const coinsGratuitos = walletData.coinsGratuitos ?? 0;

        // Classificação do prêmio para UI emocional
        let tier: 'common' | 'rare' | 'epic' | 'legendary';
        if      (crystals >= 50) tier = 'legendary';
        else if (crystals >= 20) tier = 'epic';
        else if (crystals >= 10) tier = 'rare';
        else                     tier = 'common';

        // ── REGRA 2: tudo dentro da transaction ──
        t.set(faiscaRef, {
          uid,
          lastClaimedDate: todayStr,
          lastValue:       crystals,
          lastTier:        tier,
          totalClaimed:    FieldValue.increment(crystals),
          claimsCount:     FieldValue.increment(1),
          updatedAt:       FieldValue.serverTimestamp(),
        }, { merge: true });

        // Creditar carteira — sempre Gratuitos (REGRA 18/19)
        t.set(walletRef, {
          coinsGratuitos: FieldValue.increment(crystals),
          updatedAt:      FieldValue.serverTimestamp(),
        }, { merge: true });

        // ── REGRA 20: auditLog ──
        t.set(auditRef.doc(`faisca_${todayStr}`), {
          uid,
          tipo:           'FAISCA_RESGATADA',
          valor:          crystals,
          tier,
          origem:         'dailyFaisca',
          saldoAnterior:  coinsGratuitos,
          saldoPosterior: coinsGratuitos + crystals,
          coinTipo:       'gratuito',
          timestamp:      FieldValue.serverTimestamp(),
        });

        return { crystals, tier };
      });

      return { success: true, ...result };

    } catch (error: unknown) {
      if (error instanceof functions.HttpsError) throw error;
      console.error('[claimDailyFaisca] Erro:', error);
      throw new functions.HttpsError('internal', 'Erro ao processar Faísca.');
    }
  }
);

// ── Status da Faísca (sem modificar) ──
export const getDailyFaiscaStatus = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new functions.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const faiscaRef = db.collection('dailyFaisca').doc(uid);
    const doc       = await faiscaRef.get();

    if (!doc.exists) {
      return {
        alreadyClaimed: false,
        totalClaimed:   0,
        claimsCount:    0,
        lastValue:      null,
        lastTier:       null,
      };
    }

    const data       = doc.data()!;
    const todayStr   = new Date().toISOString().slice(0, 10);

    return {
      alreadyClaimed: data.lastClaimedDate === todayStr,
      totalClaimed:   data.totalClaimed   ?? 0,
      claimsCount:    data.claimsCount    ?? 0,
      lastValue:      data.lastValue      ?? null,
      lastTier:       data.lastTier       ?? null,
    };
  }
);