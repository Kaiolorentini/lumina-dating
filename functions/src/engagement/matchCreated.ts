// ============================================
// LUMINA — ON MATCH CREATED v2.2
// functions/src/engagement/matchCreated.ts
//
// v2.2 (13/10/2026, web D5) — "Curtidas hoje x/150":
//   - a resposta traz likesToday e likeLimit. O número sai do MESMO
//     contador que a transação já lê: nenhuma leitura a mais.
//   - getLikeQuota (nova, só leitura): quantas curtidas novas a
//     pessoa já usou hoje. 1 leitura do próprio contador, chamada
//     uma vez ao abrir o site; depois o número vem das curtidas.
//   Clientes antigos ignoram os campos novos: compatível.
//
// v2.1 (12/10/2026) — análise da Sintonia:
//   - targetUid validado (texto, sem '/', não vazio).
//   - BLOQUEIO nos dois sentidos barra a curtida inteira. Antes o
//     bloqueio só impedia o push: a curtida e a sintonia mútua eram
//     criadas mesmo assim.
//   - LIMITE DIÁRIO de curtidas novas por pessoa (DAILY_LIKE_LIMIT).
//     Sem ele, um script curtia a base inteira todo dia e cada
//     curtida mandava um push.
//   - A curtida e o contador do dia entram na MESMA transação.
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
import { MissionService } from '../gamification/services/MissionService';
import { notifyUser }   from '../utils/notifyUser';
import { assertVerified, isVerifiedProfile } from '../utils/assertVerified';

const db = admin.firestore();

/** Curtidas NOVAS por pessoa por dia (horário de Brasília). */
export const DAILY_LIKE_LIMIT = 150;

/** Dias que o contador diário fica guardado (para a política de TTL). */
const LIKE_COUNTER_TTL_DAYS = 3;

async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const [ab, ba] = await Promise.all([
    db.collection('blocks').where('blockerId', '==', a).where('blockedId', '==', b).limit(1).get(),
    db.collection('blocks').where('blockerId', '==', b).where('blockedId', '==', a).limit(1).get(),
  ]);
  return !ab.empty || !ba.empty;
}

export const onCreateMatch = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const { targetUid } = (request.data ?? {}) as { targetUid?: unknown };

    if (typeof targetUid !== 'string' || !targetUid || targetUid.includes('/') || targetUid.length > 128) {
      throw new functions.HttpsError('invalid-argument', 'targetUid obrigatório.');
    }

    if (uid === targetUid) {
      throw new functions.HttpsError('invalid-argument', 'Auto-match não permitido.');
    }

    // Quem curte e quem é curtido precisam ser contas verificadas e
    // não banidas: sem isto dava para curtir (e mandar push para)
    // um perfil pendente ou encerrado por menoridade.
    assertVerified(request.auth);
    const targetSnap = await db.collection('users').doc(targetUid).get();
    if (!isVerifiedProfile(targetSnap.data())) {
      throw new functions.HttpsError('failed-precondition', 'Este perfil não está disponível.');
    }

    // Bloqueio em qualquer sentido: nada de curtida, sintonia ou push.
    // Mesma mensagem do perfil indisponível — não revela o bloqueio.
    if (await isBlockedEitherWay(uid, targetUid)) {
      throw new functions.HttpsError('failed-precondition', 'Este perfil não está disponível.');
    }

    // Curtida do dia — mesmo id que o cliente usava, para não
    // invalidar os registros já existentes.
    const todayStr = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Sao_Paulo',
    });
    const likeRef = db.collection('likes').doc(`${uid}_${targetUid}_${todayStr}`);
    const counterRef = db.collection('dailyLikeCounts').doc(`${uid}_${todayStr}`);

    // Curtida + contador do dia na MESMA transação: a repetição do
    // dia é detectada pelo documento da curtida (o mesmo id de
    // antes), e a curtida nova só entra se ainda houver cota.
    // A transação também fecha a janela de duas chamadas simultâneas
    // (antes resolvida pelo create()).
    const { alreadyLiked, likesToday } = await db.runTransaction(async (t) => {
      const [likeSnap, counterSnap] = await Promise.all([t.get(likeRef), t.get(counterRef)]);
      const used = (counterSnap.data()?.count as number | undefined) ?? 0;
      if (likeSnap.exists) return { alreadyLiked: true, likesToday: used };

      if (used >= DAILY_LIKE_LIMIT) {
        throw new functions.HttpsError(
          'resource-exhausted',
          `Você chegou ao limite de ${DAILY_LIKE_LIMIT} curtidas de hoje. Amanhã tem mais!`,
        );
      }

      t.create(likeRef, {
        fromUid:   uid,
        toUid:     targetUid,
        date:      todayStr,
        createdAt: FieldValue.serverTimestamp(),
      });
      t.set(counterRef, {
        uid,
        date:      todayStr,
        count:     used + 1,
        // Para a política de TTL do Firestore (campo expiresAt).
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + LIKE_COUNTER_TTL_DAYS * 86_400_000),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { alreadyLiked: false, likesToday: used + 1 };
    });

    // MatchService decide se é match mútuo e emite MATCH_CREATED
    // (ADR-001). Ele já cuida do earnXP CREATE_SINTONIA e do
    // trigger de conquista via GamificationIntegrationService.
    const result = await MatchService.createMatch(uid, targetUid);

    // Missões: "Curtir 3 perfis" (quem curtiu) e "Receber uma
    // curtida" (quem recebeu). Só curtida NOVA — a repetição do
    // dia já foi barrada pelo create() acima.
    if (!alreadyLiked) {
      await Promise.all([
        MissionService.recordEvent(uid, 'like_profiles', targetUid)
          .catch(error => console.warn('[onCreateMatch] missão like falhou:', error)),
        MissionService.recordEvent(targetUid, 'receive_like')
          .catch(error => console.warn('[onCreateMatch] missão receive_like falhou:', error)),
      ]);
    }

    // GIVE_LIKE continua sendo emitido pelo cliente (o earnXP é
    // onCall e não há função interna reutilizável — extrair uma
    // exigiria refatorar as ~250 linhas do xp.ts, que lidam com
    // nível, árvore, idempotência e Shadow).
    //
    // RECEIVE_LIKE fica pendente pelo mesmo motivo: não dá para
    // conceder XP a OUTRO usuário a partir daqui sem essa função.
    // Registrado no roadmap.

    // Sintonia nova: avisa QUEM NÃO ESTAVA AGINDO. Quem acabou
    // de curtir vê o modal na resposta desta chamada; o outro
    // lado pode estar com o app fechado, e sem push só
    // descobriria ao abrir o app por acaso.
    //
    // notifyUser cria a notificação in-app E manda o push, e o
    // dado `sintoniaWith` leva o AppNavigator ao perfil da
    // pessoa.
    //
    // AGUARDADO. Solto, o push ficava parado com a CPU da
    // instância cortada depois da resposta, e só saía quando
    // outra requisição acordava a instância (no log, 3s depois,
    // junto da chamada seguinte). O catch continua: falha no
    // aviso nunca derruba a curtida, a sintonia já está gravada.
    if (result.isNew) {
      try {
        const likerSnap = await db.collection('users').doc(uid).get();
        const likerName = (likerSnap.data()?.name as string | undefined) ?? 'Alguém';

        await notifyUser({
          userId: targetUid,
          title:  '✦ Sintonia!',
          body:   `Você e ${likerName} se curtiram. Que tal começar a conversa?`,
          type:   'sintonia_criada',
          data:   { sintoniaWith: uid },
        });
      } catch (error) {
        console.warn('[onCreateMatch] Falha ao notificar sintonia:', error);
      }
    }

    // Curtida NOVA que não virou sintonia: avisa o alvo.
    //
    // Texto ANÔNIMO — o push aparece na tela bloqueada. O toque
    // abre o perfil de quem curtiu (data.likedBy), então a pessoa
    // conhece todos que a curtiram. Sem teto diário, por decisão
    // de produto; a repetição já é barrada pelo create() acima
    // (uma curtida por par por dia).
    //
    // Sintonia nova já recebeu o push "✦ Sintonia!" — este não sai.
    //
    // Quem BLOQUEOU o autor da curtida não é avisado: sem isso, o
    // push seria um canal de contato de quem já foi bloqueado.
    if (!alreadyLiked && !result.isNew) {
      try {
        const blockedByTarget = await db.collection('blocks')
          .where('blockerId', '==', targetUid)
          .where('blockedId', '==', uid)
          .limit(1)
          .get();

        if (blockedByTarget.empty) {
          await notifyUser({
            userId: targetUid,
            title:  '✦ Alguém sintonizou com você',
            body:   'Toque para descobrir quem é.',
            type:   'like_received',
            data:   { likedBy: uid },
          });
        }
      } catch (error) {
        console.warn('[onCreateMatch] Falha ao notificar curtida:', error);
      }
    }

    return {
      success:  true,
      matchId:  result.matchId,
      isNew:    result.isNew,
      isMutual: result.isNew,
      alreadyLiked,
      likesToday,
      likeLimit: DAILY_LIKE_LIMIT,
    };
  }
);

/**
 * Curtidas novas usadas hoje (horário de Brasília) por quem chama.
 * Só leitura do próprio contador — nada de outra pessoa.
 */
export const getLikeQuota = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const snap = await db.collection('dailyLikeCounts').doc(`${uid}_${todayStr}`).get();
    const used = (snap.data()?.count as number | undefined) ?? 0;

    return { used, limit: DAILY_LIKE_LIMIT, date: todayStr };
  }
);

