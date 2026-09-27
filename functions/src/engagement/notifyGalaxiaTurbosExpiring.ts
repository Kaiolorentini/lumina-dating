// ============================================
// LUMINA — AVISO: TURBOS DA GALÁXIA PLUS EXPIRANDO
// functions/src/engagement/notifyGalaxiaTurbosExpiring.ts
//
// Decisão de 27/09: os Turbos da Galáxia Plus só valem com o
// acesso ativo, e a pessoa é AVISADA antes de perdê-los — 3 dias
// e 1 dia antes do fim, se ainda houver Turbos sem usar.
//
// Roda uma vez por dia, às 10h de Brasília. Lê só os acessos que
// expiram nos próximos 3 dias (poucos documentos).
//
// Idempotência: cada aviso grava a chave "<expiresAt>_<dias>" em
// turbosExpiryWarned. Renovar muda o expiresAt, então o próximo
// ciclo avisa de novo — e o mesmo ciclo nunca avisa duas vezes.
// ============================================

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { notifyUser } from '../utils/notifyUser';

const db = admin.firestore();

const DAY_MS       = 24 * 60 * 60 * 1000;
const WARN_AT_DAYS = [3, 1];

export const notifyGalaxiaTurbosExpiring = onSchedule(
  { schedule: '0 10 * * *', timeZone: 'America/Sao_Paulo', region: 'us-central1' },
  async () => {
    const now     = Date.now();
    const horizon = now + Math.max(...WARN_AT_DAYS) * DAY_MS;

    const snap = await db.collection('galaxiaPlus')
      .where('expiresAt', '>',  admin.firestore.Timestamp.fromMillis(now))
      .where('expiresAt', '<=', admin.firestore.Timestamp.fromMillis(horizon))
      .get();

    let sent = 0;

    for (const doc of snap.docs) {
      const data      = doc.data();
      const expiresAt = (data.expiresAt as admin.firestore.Timestamp).toDate();
      const available = Math.max(0, ((data.turbosGranted as number) ?? 0) - ((data.turbosUsed as number) ?? 0));
      if (available <= 0) continue;

      const daysLeft = Math.ceil((expiresAt.getTime() - now) / DAY_MS);
      if (!WARN_AT_DAYS.includes(daysLeft)) continue;

      const key    = `${expiresAt.toISOString()}_${daysLeft}`;
      const warned = (data.turbosExpiryWarned as string[] | undefined) ?? [];
      if (warned.includes(key)) continue;

      const turbos = available === 1 ? '1 Turbo' : `${available} Turbos`;
      const prazo  = daysLeft === 1 ? 'amanhã' : `em ${daysLeft} dias`;

      try {
        await notifyUser({
          userId: doc.id, // galaxiaPlus/{uid}
          title:  '⚡ Seus Turbos expiram em breve',
          body:   `Você tem ${turbos} da Galáxia Plus. Seu acesso acaba ${prazo} — use antes.`,
          type:   'galaxia_turbos_expiring',
        });
        await doc.ref.set({ turbosExpiryWarned: FieldValue.arrayUnion(key) }, { merge: true });
        sent++;
      } catch (error) {
        console.warn('[notifyGalaxiaTurbosExpiring] falhou para', doc.id, error);
      }
    }

    console.log(`[notifyGalaxiaTurbosExpiring] Avisos: ${sent} | Analisados: ${snap.size}`);
  },
);