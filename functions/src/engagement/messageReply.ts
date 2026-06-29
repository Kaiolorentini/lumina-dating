// ============================================
// LUMINA — ON MESSAGE REPLY v1.0
// functions/src/engagement/messageReply.ts
//
// CF chamada após mensagem enviada com resposta mútua.
// Delega tudo ao MessageReplyOrchestrator.
// Nunca contém lógica de negócio.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import { MessageReplyOrchestrator } from '../gamification/orchestrators/MessageReplyOrchestrator';

function newCorrelationId(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const onMessageReply = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const { senderUid, targetUid, messageCount } = request.data as {
      senderUid:    string;
      targetUid:    string;
      messageCount: number;
    };

    if (senderUid !== uid) {
      throw new functions.HttpsError('permission-denied', 'senderUid não corresponde ao token.');
    }

    const orchestrator = new MessageReplyOrchestrator();
    await orchestrator.execute({
      uid:           senderUid,
      targetUid,
      correlationId: newCorrelationId(),
      meta:          { messageCount },
    });

    return { success: true };
  }
);