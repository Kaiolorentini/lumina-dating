// ============================================
// LUMINA — MATCH SERVICE v2.0
// functions/src/gamification/services/MatchService.ts
//
// ADR-001: MatchService emite o evento MATCH_CREATED.
// Nunca um trigger Firestore.
// Regra de negócio vive aqui, não na persistência.
//
// v2.0 — A SINTONIA É DOS DOIS.
//
// A v1.1 emitia handleMatchCreated apenas para quem FECHOU o
// par. Quem curtiu primeiro não recebia os 50 de XP nem os 50
// de treeXP — e como CREATE_SINTONIA é de longe o maior valor
// de treeXP da tabela, a Árvore só crescia para metade das
// pessoas. Agora emite para ambos.
//
// v2.0 — REVELAÇÃO DA SINTONIA.
// Cada lado recebe `progression.pendingSintoniaReveal` com o
// uid do outro. O EngagementInitializer lê ao abrir o app e
// mostra o modal; a CF clearSintoniaReveal limpa depois.
//
// Guarda só a MAIS RECENTE, não uma lista: cinco modais em
// sequência para quem voltou depois de um dia é ruim, e uma
// lista cresce sem limite no documento do usuário. O resto
// fica nas notificações, no sino.
//
// v1.1 — gamificationProcessed entra na transação.
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { GamificationIntegrationService } from '../GamificationIntegrationService';
import { PrestigeService } from '../../engagement/prestigeService';

const db = admin.firestore();

export interface MatchResult {
  matchId:   string;
  uid:       string;
  targetUid: string;
  isNew:     boolean;
}

export const MatchService = {

  // Cria Sintonia e emite MATCH_CREATED — nunca via trigger
  async createMatch(uid: string, targetUid: string): Promise<MatchResult> {
    const matchId  = [uid, targetUid].sort().join('_');
    const matchRef = db.collection('sintonias').doc(matchId);

    const result = await db.runTransaction(async (t) => {
      const matchDoc = await t.get(matchRef);
      const data     = matchDoc.exists ? matchDoc.data()! : null;

      // Já processado: nem grava nem reemite.
      if (data?.gamificationProcessed === true) {
        return { matchId, uid, targetUid, isNew: false };
      }

      const likedBy: string[] = data?.likedBy ?? [];

      // Adiciona curtida do uid atual
      if (!likedBy.includes(uid)) {
        likedBy.push(uid);
      }

      const isMutual = likedBy.includes(uid) && likedBy.includes(targetUid);

      // A flag entra na MESMA transação. Fora dela, duas chamadas
      // concorrentes no instante do match liam `false` as duas e
      // emitiam MATCH_CREATED em dobro — 100 XP e 100 treeXP por
      // uma sintonia só. E o `false` fixo aqui ainda podia
      // sobrescrever o `true` gravado logo depois.
      t.set(matchRef, {
        matchId,
        users:     [uid, targetUid],
        likedBy,
        isMutual,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        gamificationProcessed: isMutual,
      }, { merge: true });

      return { matchId, uid, targetUid, isNew: isMutual };
    });

    // Sintonia nova: gamificação e revelação para OS DOIS.
    // A exclusividade já foi garantida dentro da transação.
    if (result.isNew) {
      GamificationIntegrationService.handleMatchCreated({ uid, targetUid });
      GamificationIntegrationService.handleMatchCreated({
        uid:       targetUid,
        targetUid: uid,
      });

      // Fire-and-forget: a sintonia já está gravada, e falha na
      // revelação não pode desfazê-la nem travar a resposta ao
      // cliente, que está esperando na tela.
      markSintoniaReveal(uid, targetUid).catch((error) => {
        console.warn('[MatchService] Falha ao marcar revelação:', error);
      });

      // Conquistas FIRST_SINTONIA, SINTONIA_10 e SINTONIA_50.
      // NINGUÉM disparava CREATE_SINTONIA — "Primeira Sintonia",
      // a conquista mais simbólica do app, nunca era desbloqueada.
      //
      // Action INCREMENTAL no AchievementProcessor: currentValue
      // é somado ao progresso, por isso 1.
      markSintoniaAchievement(uid).catch(() => { /* nunca derruba a sintonia */ });
      markSintoniaAchievement(targetUid).catch(() => { /* idem */ });

      // Marcos de prestígio SINTONIA_10/50/100_REAL. O catálogo
      // diz "sintonias reais" (com conversa e resposta mútua),
      // mas essa checagem exigiria varrer as mensagens de cada
      // par — caro e frágil. Contamos sintonias mútuas, que já
      // exigem interesse dos dois lados.
      checkSintoniaMarcos(uid).catch(() => {});
      checkSintoniaMarcos(targetUid).catch(() => {});

      // A sintonia vira CONEXÃO ACEITA.
      //
      // O app tinha dois sistemas que não se falavam: a
      // solicitação (connectionRequests com status accepted) e
      // a sintonia (coleção sintonias). A aba Sintonias, a aba
      // Conversas, o contador do rodapé e o guard do chat leem
      // TODOS do primeiro — então quem se curtia mutuamente
      // ganhava XP, conquista e árvore, mas continuava sem
      // poder conversar.
      //
      // Criar a conexão aqui faz tudo que já existe funcionar,
      // sem tocar em nenhuma tela. A solicitação manual
      // continua valendo para quem quer falar sem depender de
      // ser curtido de volta.
      createConnectionFromMatch(uid, targetUid).catch((error) => {
        console.warn('[MatchService] Falha ao criar conexão:', error);
      });
    }

    return result;
  },
};

/**
 * Grava a flag de revelação nos DOIS usuários, cada um com o
 * uid do outro. Um batch: duas escritas, uma viagem.
 */
async function markSintoniaReveal(uidA: string, uidB: string): Promise<void> {
  const batch = db.batch();

  batch.set(
    db.collection('users').doc(uidA),
    { progression: { pendingSintoniaReveal: uidB } },
    { merge: true },
  );

  batch.set(
    db.collection('users').doc(uidB),
    { progression: { pendingSintoniaReveal: uidA } },
    { merge: true },
  );

  await batch.commit();
}

/**
 * Enfileira a conquista de sintonia. O onAchievementTrigger
 * processa pelo AchievementProcessor, que é quem entrega a
 * recompensa — cristais, badge, frame e título.
 */
async function markSintoniaAchievement(uid: string): Promise<void> {
  await db.collection('achievementTriggers').add({
    uid,
    action:       'CREATE_SINTONIA',
    currentValue: 1,
    processedAt:  null,
    timestamp:    FieldValue.serverTimestamp(),
  });
}

/**
 * Concede o marco de prestígio quando a contagem de sintonias
 * cruza 10, 50 ou 100.
 *
 * A contagem vem de `progression.sintoniaCount`, incrementado
 * aqui: contar documentos da coleção `sintonias` a cada match
 * custaria uma query por sintonia, e o Firestore cobra por
 * documento lido.
 */
async function checkSintoniaMarcos(uid: string): Promise<void> {
  const userRef = db.collection('users').doc(uid);

  const count = await db.runTransaction(async (t) => {
    const snap = await t.get(userRef);
    const current = (snap.data()?.progression?.sintoniaCount as number | undefined) ?? 0;
    const next = current + 1;

    t.set(
      userRef,
      { progression: { sintoniaCount: next } },
      { merge: true },
    );

    return next;
  });

  // Ordem decrescente e break no primeiro: o grantMarco já
  // barra o que foi concedido, mas evitar a transação é melhor
  // que depender do guard.
  const marcos: { id: string; at: number }[] = [
    { id: 'SINTONIA_100_REAL', at: 100 },
    { id: 'SINTONIA_50_REAL',  at: 50  },
    { id: 'SINTONIA_10_REAL',  at: 10  },
  ];

  for (const marco of marcos) {
    if (count === marco.at) {
      await PrestigeService.grantMarco(uid, marco.id);
      break;
    }
  }
}

/**
 * Cria a conexão aceita entre os dois, se ainda não existir.
 *
 * O id é determinístico — os dois uids ordenados — e não
 * gerado pelo Firestore: sem isso, duas sintonias processadas
 * quase ao mesmo tempo criariam conexões duplicadas, e o
 * getConexoesAceitas devolveria a mesma pessoa duas vezes na
 * lista.
 *
 * `fromUserId` é quem fechou o par, por convenção — as telas
 * tratam os dois lados igual, então a escolha é arbitrária.
 */
async function createConnectionFromMatch(
  uid: string,
  targetUid: string,
): Promise<void> {
  const connectionId = `sintonia_${[uid, targetUid].sort().join('_')}`;
  const ref = db.collection('connectionRequests').doc(connectionId);

  const [fromSnap, toSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('users').doc(targetUid).get(),
  ]);

  const fromData = fromSnap.data() ?? {};

  await ref.set(
    {
      fromUserId:    uid,
      toUserId:      targetUid,
      fromUserName:  (fromData.name as string | undefined) ?? '',
      fromUserPhoto: (fromData.photoURL as string | undefined) ?? '',
      status:        'accepted',
      // Marca a origem: conexões que nasceram de sintonia não
      // passaram por pedido e aceite, e um dia isso pode
      // importar para métricas ou para a tela de solicitações.
      origem:        'sintonia',
      timestamp:     FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // O `toSnap` é lido só para garantir que o alvo existe — uma
  // conexão para um documento apagado deixaria a lista com uma
  // entrada morta.
  if (!toSnap.exists) {
    await ref.delete();
  }
}