// ============================================
// LUMINA — RELATÓRIO DO IMPULSO
// functions/src/premium/reportBoostResults.ts
//
// Quando um Impulso, Turbo ou Destaque termina, conta o que ele
// trouxe — visitas e curtidas recebidas NA JANELA do impulso — e
// avisa por push e sino. É o que transforma gasto em resultado
// visível, e dá motivo para comprar de novo.
//
// Fonte: premiumUsageLog (as três CFs de ativação gravam uid,
// featureType, activatedAt, expiresAt e status ACTIVE — inclusive
// o Turbo grátis da Galáxia Plus).
//
// Contagem com count(): cobrado como leitura de índice, sem baixar
// documentos. Índices: profile_visits (profileId, timestamp) já
// existe; likes (toUid, createdAt) e premiumUsageLog (status,
// expiresAt) entram no firestore.indexes.json.
//
// Idempotência: o registro vira REPORTED com precondição de versão
// ANTES do aviso — execução repetida não avisa duas vezes.
// ============================================

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin     from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { notifyUser } from '../utils/notifyUser';

const db = admin.firestore();

const BATCH_SIZE = 200;

const BOOSTS: Record<string, { label: string; icon: string }> = {
  TURBO:             { label: 'Turbo',             icon: '⚡' },
  IMPULSO_PERFIL:    { label: 'Impulso',           icon: '🚀' },
  DESTAQUE_REGIONAL: { label: 'Destaque Regional', icon: '📍' },
};

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

export const reportBoostResults = onSchedule(
  { schedule: 'every 15 minutes', region: 'us-central1' },
  async () => {
    const snap = await db.collection('premiumUsageLog')
      .where('status', '==', 'ACTIVE')
      .where('expiresAt', '<=', Timestamp.now())
      .limit(BATCH_SIZE)
      .get();

    let reported = 0;
    let closed   = 0;

    for (const doc of snap.docs) {
      const data  = doc.data();
      const boost = BOOSTS[data.featureType as string];
      const start = data.activatedAt as Timestamp | undefined;
      const end   = data.expiresAt   as Timestamp;

      // Fertilizante e registros sem início: só encerram.
      if (!boost || !start) {
        await doc.ref.update({ status: 'EXPIRED' }).catch(() => {});
        closed++;
        continue;
      }

      const uid = data.uid as string;

      const [visitsAgg, likesAgg] = await Promise.all([
        db.collection('profile_visits')
          .where('profileId', '==', uid)
          .where('timestamp', '>=', start)
          .where('timestamp', '<=', end)
          .count().get(),
        db.collection('likes')
          .where('toUid', '==', uid)
          .where('createdAt', '>=', start)
          .where('createdAt', '<=', end)
          .count().get(),
      ]);

      const visits = visitsAgg.data().count;
      const likes  = likesAgg.data().count;

      // Marca ANTES de avisar, com precondição: se outra execução já
      // tratou este registro, a atualização falha e o aviso não sai.
      try {
        await doc.ref.update(
          { status: 'REPORTED', report: { visits, likes, reportedAt: FieldValue.serverTimestamp() } },
          { lastUpdateTime: doc.updateTime },
        );
      } catch {
        continue;
      }

      const body = visits + likes > 0
        ? `Ele trouxe ${plural(visits, 'visita', 'visitas')} e ${plural(likes, 'curtida', 'curtidas')}. Impulsione de novo para continuar em destaque.`
        : 'Desta vez o período foi calmo e ninguém passou pelo seu perfil. Vale tentar num horário de mais movimento.';

      await notifyUser({
        userId: uid,
        title:  `${boost.icon} Seu ${boost.label} terminou`,
        body,
        type:   'boost_report',
        // notifyUser aceita só texto nos dados (vão no push).
        data:   { featureType: String(data.featureType), visits: String(visits), likes: String(likes) },
      }).catch(error => console.warn('[reportBoostResults] aviso falhou para', uid, error));

      reported++;
    }

    console.log(`[reportBoostResults] Relatórios: ${reported} | Encerrados: ${closed} | Analisados: ${snap.size}`);
  },
);