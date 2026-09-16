// ============================================
// LUMINA — ON MATCH CREATED v2.0
// functions/src/engagement/matchCreated.ts
//
// v2.0 — a CF agora é o ÚNICO caminho da curtida.
//
// Antes o cliente gravava likes/{id} direto e chamava earnXP
// sozinho, e esta CF nunca era invocada. Consequências:
//   - MatchService nunca rodava → CREATE_SINTONIA nunca disparava
//   - a coleção Conector inteira era inalcançável
//   - a árvore não evoluía (sintonia é sua principal fonte)
//   - RECEIVE_LIKE nunca era concedido ao alvo
//   - XP de curtida era emitido pelo cliente, farmável
//
// ADR-001: regra de negócio no MatchService, não no trigger.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { MatchService } from '../gamification/services/MatchService';

const db = admin.firestore();

export const onCreateMatch = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const { targetUid } = request.data as { targetUid: string };

    if (!targetUid) {
      throw new functions.HttpsError('invalid-argument', 'targetUid obrigatório.');
    }

    if (uid === targetUid) {
      throw new functions.HttpsError('invalid-argument', 'Auto-match não permitido.');
    }

    // Curtida do dia — mesmo id que o cliente usava, para não
    // invalidar os registros já existentes.
    const todayStr = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Sao_Paulo',
    });
    const likeRef = db.collection('likes').doc(`${uid}_${targetUid}_${todayStr}`);

    // create() é atômico: falha com ALREADY_EXISTS se o documento
    // já existe. O par get()+set() anterior deixava uma janela em
    // que duas invocações simultâneas liam `exists: false` as duas
    // e ambas retornavam alreadyLiked: false — o cliente emitia
    // GIVE_LIKE em dobro, com actionId distintos que a idempotência
    // do earnXP não cruza.
    let alreadyLiked = false;
    try {
      await likeRef.create({
        fromUid:   uid,
        toUid:     targetUid,
        date:      todayStr,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err: unknown) {
      const code = (err as { code?: number | string })?.code;
      // 6 = ALREADY_EXISTS no gRPC; o Admin SDK pode devolver o
      // número ou a string, dependendo da versão.
      if (code === 6 || code === 'already-exists') {
        alreadyLiked = true;
      } else {
        throw err;
      }
    }

    // MatchService decide se é match mútuo e emite MATCH_CREATED
    // (ADR-001). Ele já cuida do earnXP CREATE_SINTONIA e do
    // trigger de conquista via GamificationIntegrationService.
    const result = await MatchService.createMatch(uid, targetUid);

    // GIVE_LIKE continua sendo emitido pelo cliente (o earnXP é
    // onCall e não há função interna reutilizável — extrair uma
    // exigiria refatorar as ~250 linhas do xp.ts, que lidam com
    // nível, árvore, idempotência e Shadow).
    //
    // RECEIVE_LIKE fica pendente pelo mesmo motivo: não dá para
    // conceder XP a OUTRO usuário a partir daqui sem essa função.
    // Registrado no roadmap.

    return {
      success:  true,
      matchId:  result.matchId,
      isNew:    result.isNew,
      isMutual: result.isNew,
      alreadyLiked,
    };
  }
);