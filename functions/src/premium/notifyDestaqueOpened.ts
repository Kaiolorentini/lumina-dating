// ============================================
// LUMINA — AVISO: DESTAQUE REGIONAL ABRIU
// functions/src/premium/notifyDestaqueOpened.ts
//
// Uma vez por dia, às 10h de Brasília. Lê só a lista de espera
// (poucas cidades), conta os usuários de cada uma e, quando uma
// chega ao mínimo, avisa quem esperava e limpa a lista dela.
// ============================================

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin     from 'firebase-admin';
import { notifyUser } from '../utils/notifyUser';
import { DESTAQUE_MIN_USERS_IN_REGION } from './config/premiumFlags';

const db = admin.firestore();

const MAX_WAITLIST_READ = 2000;
const DELETE_BATCH      = 400;

export const notifyDestaqueOpened = onSchedule(
  { schedule: '0 10 * * *', timeZone: 'America/Sao_Paulo', region: 'us-central1' },
  async () => {
    const snap = await db.collection('destaqueWaitlist').limit(MAX_WAITLIST_READ).get();

    const byRegion = new Map<string, admin.firestore.QueryDocumentSnapshot[]>();
    for (const doc of snap.docs) {
      const regiaoId = doc.data().regiaoId as string | undefined;
      if (!regiaoId) continue;
      const list = byRegion.get(regiaoId) ?? [];
      list.push(doc);
      byRegion.set(regiaoId, list);
    }

    let opened   = 0;
    let notified = 0;

    for (const [regiaoId, docs] of byRegion) {
      const count = (await db.collection('users').where('regiaoId', '==', regiaoId).count().get())
        .data().count;
      if (count < DESTAQUE_MIN_USERS_IN_REGION) continue;

      const city = (docs[0].data().city as string) || 'sua cidade';

      for (const doc of docs) {
        await notifyUser({
          userId: doc.data().uid as string,
          title:  `📍 O Destaque Regional abriu em ${city}`,
          body:   `${city} já tem ${count} pessoas no Lumina. Seu perfil pode aparecer em destaque para todas elas.`,
          type:   'destaque_aberto',
        }).then(() => { notified++; })
          .catch(error => console.warn('[notifyDestaqueOpened] aviso falhou:', error));
      }

      for (let i = 0; i < docs.length; i += DELETE_BATCH) {
        const batch = db.batch();
        docs.slice(i, i + DELETE_BATCH).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      opened++;
    }

    console.log(`[notifyDestaqueOpened] Cidades abertas: ${opened} | Avisos: ${notified} | Na lista: ${snap.size}`);
  },
);