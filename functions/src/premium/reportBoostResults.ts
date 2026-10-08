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
//
// LIMPEZA DO PERFIL (06/10): as CFs de ativação gravam
// boostType/boostActiveUntil e {turbo|impulso|destaqueRegional}.active
// no users, e nada os apagava. Toda leitura confere o prazo, então
// não havia bug visível — mas o dado mentia. Ao encerrar o registro,
// os campos vencidos são limpos numa transação que confere o prazo
// DE NOVO: se a pessoa já ativou outro boost, nada é apagado.
// Ficam intactos: lastActivatedAt (cooldown) e os expiresAt dos
// sub-objetos (assertSingleBoost e o feed dependem deles).
// ============================================

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin     from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { notifyUser } from '../utils/notifyUser';

const db = admin.firestore();

const BATCH_SIZE = 200;

const BOOSTS: Record<string, { label: string; icon: string; userField: string }> = {
  TURBO:             { label: 'Turbo',             icon: '⚡', userField: 'turbo' },
  IMPULSO_PERFIL:    { label: 'Impulso',           icon: '🚀', userField: 'impulso' },
  DESTAQUE_REGIONAL: { label: 'Destaque Regional', icon: '📍', userField: 'destaqueRegional' },
};

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

function toMillis(value: unknown): number | null {
  return (value as Timestamp | undefined)?.toMillis?.() ?? null;
}

/**
 * Limpa do users os campos de boost que JÁ venceram. Lê e grava na
 * mesma transação: se um boost novo foi ativado depois do fim deste,
 * o prazo no documento está no futuro e nada é tocado.
 * Nunca lança — limpeza é higiene, não pode impedir o relatório.
 */
async function clearExpiredBoostFields(uid: string, userField: string): Promise<void> {
  const ref = db.collection('users').doc(uid);
  try {
    await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) return;

      const data = snap.data() ?? {};
      const now  = Date.now();
      const updates: Record<string, unknown> = {};

      const activeUntil = toMillis(data.boostActiveUntil);
      if (activeUntil !== null && activeUntil <= now) {
        updates.boostActiveUntil = FieldValue.delete();
        updates.boostType        = FieldValue.delete();
      }

      const sub = data[userField] as { active?: unknown; expiresAt?: unknown } | undefined;
      const subUntil = toMillis(sub?.expiresAt);
      if (sub?.active === true && subUntil !== null && subUntil <= now) {
        updates[`${userField}.active`] = false;
      }

      if (Object.keys(updates).length > 0) t.update(ref, updates);
    });
  } catch (error) {
    console.warn('[reportBoostResults] limpeza do perfil falhou para', uid, error);
  }
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
      const uid   = data.uid as string | undefined;

      // Fertilizante e registros sem início: só encerram.
      if (!boost || !start) {
        await doc.ref.update({ status: 'EXPIRED' }).catch(() => {});
        if (boost && uid) await clearExpiredBoostFields(uid, boost.userField);
        closed++;
        continue;
      }

      if (!uid) {
        await doc.ref.update({ status: 'EXPIRED' }).catch(() => {});
        closed++;
        continue;
      }

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

      await clearExpiredBoostFields(uid, boost.userField);

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