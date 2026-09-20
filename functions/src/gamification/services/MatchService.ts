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