// ============================================
// LUMINA — MESSAGE REPLY ORCHESTRATOR v1.0
// functions/src/gamification/orchestrators/MessageReplyOrchestrator.ts
//
// Fluxo MESSAGE_REPLY:
//   1. MessageReplyValidator
//   2. AntiFarmService.register()
//   3. GamificationIntegrationService.handleMessageReply()
// Sem gatilhos emocionais.
// Não dispara: Vault, Tree, Prestige.
// ============================================

import { BaseEventOrchestrator }    from './BaseEventOrchestrator';
import { OrchestratorInput }        from '../IEventOrchestrator';
import { GameEventInput }           from '../GameEventContext';
import { GameEventFactory }         from '../GameEventFactory';
import { MessageReplyValidator }    from '../validation/MessageReplyValidator';
import { AntiFarmService }          from '../antifarm/AntiFarmService';

export class MessageReplyOrchestrator extends BaseEventOrchestrator {
  readonly eventType = 'MESSAGE_REPLY' as const;

  private readonly validator = new MessageReplyValidator();

  async validate(input: OrchestratorInput): Promise<void> {
    await this.validator.validate({
      uid:           input.uid,
      targetUid:     input.targetUid,
      eventType:     'MESSAGE_REPLY',
      correlationId: input.correlationId,
      meta:          input.meta,
    });
  }

  buildEvent(input: OrchestratorInput): GameEventInput {
    return GameEventFactory.messageReply({
      uid:           input.uid,
      targetUid:     input.targetUid!,
      correlationId: input.correlationId,
      meta: {
        messageCount: (input.meta?.messageCount as number) ?? 2,
      },
    });
  }

  protected async afterValidate(input: OrchestratorInput): Promise<void> {
    await AntiFarmService.register({
      eventType: 'MESSAGE_REPLY',
      uid:       input.uid,
      targetUid: input.targetUid,
    });
  }
}