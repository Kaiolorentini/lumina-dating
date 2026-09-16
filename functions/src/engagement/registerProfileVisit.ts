// ============================================
// LUMINA — REGISTRAR VISITA DE PERFIL v1.0
// functions/src/engagement/registerProfileVisit.ts
//
// POR QUE EXISTE:
// A escrita em profile_visits era client-side (visitsService.ts).
// Isso permitia forjar visitas: inflar o próprio contador, ocupar
// a aba "Em Alta" sem pagar (canibalizando Turbo/Impulso/Destaque)
// e disparar gatilhos emocionais falsos no onProfileVisit.
//
// Com esta CF, o cliente apenas PEDE o registro. O Admin SDK grava
// — e as Rules podem travar profile_visits e profile_visit_counts
// com write: if false.
//
// O trigger onProfileVisit (emotionalTriggers.ts) continua
// funcionando: ele escuta onDocumentCreated em profile_visits e
// não distingue quem criou o documento.
//
// REGRAS APLICADAS:
// R1  — Nada de escrita client-side em dados que valem dinheiro
// R6  — serverTimestamp() sempre; nunca Date.now() do cliente
// R13 — Contador considera visitantes ÚNICOS por janela, não cliques
//
// VALIDAÇÕES QUE O CLIENTE NÃO FAZIA:
// - visitorId vem de request.auth, não do payload (antes o app
//   enviava os dois IDs e nada impedia forjar o visitante)
// - auto-visita ignorada
// - perfil de destino precisa existir
// - bloqueio mútuo respeitado
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { todayBr }   from '../utils/dateBr';
const db = admin.firestore();

// Janela de deduplicação: revisitas dentro deste intervalo não
// geram novo registro. Mesmo valor que o cliente usava.
const DUPLICATE_WINDOW_MINUTES = 5;

interface RegisterVisitRequest {
  profileId?: string;
}

export const registerProfileVisit = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const visitorId = request.auth?.uid;
    if (!visitorId) {
      throw new functions.HttpsError('unauthenticated', 'Não autenticado.');
    }

    const profileId = (request.data as RegisterVisitRequest)?.profileId;
    if (!profileId || typeof profileId !== 'string') {
      throw new functions.HttpsError('invalid-argument', 'profileId é obrigatório.');
    }

    // Auto-visita não conta. Retorno silencioso: não é erro do
    // usuário, e lançar aqui poluiria o log do app.
    if (profileId === visitorId) {
      return { registered: false, reason: 'self_visit' };
    }

    // ── Perfil de destino precisa existir ──
    const targetDoc = await db.collection('users').doc(profileId).get();
    if (!targetDoc.exists) {
      throw new functions.HttpsError('not-found', 'Perfil não encontrado.');
    }

    // ── Bloqueio mútuo: visita não é registrada em nenhuma direção ──
    const [blockedByTarget, blockedByVisitor] = await Promise.all([
      db.collection('blocks')
        .where('blockerId', '==', profileId)
        .where('blockedId', '==', visitorId)
        .limit(1).get(),
      db.collection('blocks')
        .where('blockerId', '==', visitorId)
        .where('blockedId', '==', profileId)
        .limit(1).get(),
    ]);

    if (!blockedByTarget.empty || !blockedByVisitor.empty) {
      return { registered: false, reason: 'blocked' };
    }

    // ── Deduplicação por janela ──
    // Fora de transaction de propósito: um registro duplicado em
    // corrida é inofensivo (o contador incrementa 1 a mais numa
    // janela de 5 min), e travar aqui custaria caro num caminho
    // que roda a cada abertura de perfil.
    const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60000);

    const recent = await db.collection('profile_visits')
      .where('visitorId', '==', visitorId)
      .where('profileId', '==', profileId)
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(windowStart))
      .limit(1)
      .get();

    if (!recent.empty) {
      return { registered: false, reason: 'duplicate' };
    }

    // ── Registro ──
    const visitRef = db.collection('profile_visits').doc();
    const countRef = db.collection('profile_visit_counts').doc(profileId);

    // Data local do perfil visitado, para o corte de "hoje".
    // A subtração fixa de 3h anterior quebraria se o Brasil
    // voltasse ao horário de verão (offset -2).
    const todayKey = todayBr();

    const batch = db.batch();

    batch.set(visitRef, {
      visitorId,
      profileId,
      timestamp: FieldValue.serverTimestamp(),
    });

    const countSnap = await countRef.get();
    const lastKey   = countSnap.data()?.todayKey ?? null;
    const isNewDay  = lastKey !== todayKey;

    if (countSnap.exists) {
      batch.update(countRef, {
        totalVisits: FieldValue.increment(1),
        todayVisits: isNewDay ? 1 : FieldValue.increment(1),
        todayKey,
        lastVisit:   FieldValue.serverTimestamp(),
      });
    } else {
      batch.set(countRef, {
        profileId,
        totalVisits: 1,
        todayVisits: 1,
        todayKey,
        lastVisit:   FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    // onProfileVisit (emotionalTriggers.ts) dispara a partir da
    // criação em profile_visits — nada a fazer aqui.

    return { registered: true };
  },
);