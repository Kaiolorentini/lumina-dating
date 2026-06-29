// ============================================
// LUMINA — MESSAGE REPLY VALIDATOR v1.0
// functions/src/gamification/validation/MessageReplyValidator.ts
//
// Regras específicas de MESSAGE_REPLY.
// Condições: duas pessoas diferentes, resposta mútua,
// mínimo de 2 mensagens trocadas, conversa válida.
// ============================================

import * as admin from 'firebase-admin';
import { BaseGameEventValidator } from './BaseGameEventValidator';
import { ValidatorContext }       from '../IGameEventValidator';
import { GameEventType }          from '../GameEventTypes';
import { ValidationError }        from '../ErrorBoundary';
import { AntiFarmService }        from '../antifarm/AntiFarmService';

const db = admin.firestore();

const MIN_MESSAGES = 2; // mínimo de mensagens trocadas para gerar XP

export class MessageReplyValidator extends BaseGameEventValidator {

  canHandle(eventType: GameEventType): boolean {
    return eventType === 'MESSAGE_REPLY';
  }

  async validate(ctx: ValidatorContext): Promise<void> {
    // 1. Validações comuns
    await this.validateCommon(ctx);

    const messageCount = ctx.meta?.messageCount as number | undefined;

    // 2. Mínimo de mensagens trocadas (anti-spam de "ok" para farmar XP)
    if (!messageCount || messageCount < MIN_MESSAGES) {
      throw new ValidationError(
        'INSUFFICIENT_MESSAGES',
        `Mínimo de ${MIN_MESSAGES} mensagens trocadas para gerar XP`,
        false
      );
    }

    // 3. Verifica se a conversa existe e é entre dois usuários distintos
    if (!ctx.targetUid) {
      throw new ValidationError('MISSING_TARGET', 'targetUid obrigatório para MESSAGE_REPLY', true);
    }

    const chatId   = [ctx.uid, ctx.targetUid].sort().join('_');
    const chatDoc  = await db.collection('chats').doc(chatId).get();

    if (!chatDoc.exists) {
      throw new ValidationError('CHAT_NOT_FOUND', 'Conversa não encontrada', false);
    }

    // 4. Verifica se houve resposta real do outro usuário
    const chatData      = chatDoc.data() ?? {};
    const lastSenderId  = chatData.lastSenderId as string | undefined;

    // Se o último sender é o próprio usuário, o outro ainda não respondeu
    if (lastSenderId === ctx.uid) {
      throw new ValidationError(
        'NO_REPLY_YET',
        'Aguardando resposta do outro usuário',
        false
      );
    }

    // 5. Anti-spam: limita por conversa/dia
    await AntiFarmService.check({
      eventType: 'MESSAGE_REPLY',
      uid:       ctx.uid,
      targetUid: ctx.targetUid,
    });
  }
}