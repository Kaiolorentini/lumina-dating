// ============================================
// LUMINA — PROFILE LIKE ORCHESTRATOR v1.0
// functions/src/gamification/orchestrators/ProfileLikeOrchestrator.ts
//
// Fluxo PROFILE_LIKE:
//   1. ProfileLikeValidator
//   2. AntiFarmService.register()
//   3. GamificationIntegrationService.handleProfileLike()
// Sem gatilhos emocionais.
// ============================================

import { BaseEventOrchestrator }  from './BaseEventOrchestrator';
import { OrchestratorInput }      from '../IEventOrchestrator';
import { GameEventInput }         from '../GameEventContext';
import { GameEventFactory }       from '../GameEventFactory';
import { ProfileLikeValidator }   from '../validation/ProfileLikeValidator';
import { AntiFarmService }        from '../antifarm/AntiFarmService';

export class ProfileLikeOrchestrator extends BaseEventOrchestrator {
  readonly eventType = 'PROFILE_LIKE' as const;

  private readonly validator = new ProfileLikeValidator();

  async validate(input: OrchestratorInput): Promise<void> {
    await this.validator.validate({
      uid:           input.uid,
      targetUid:     input.targetUid,
      eventType:     'PROFILE_LIKE',
      correlationId: input.correlationId,
    });
  }

  buildEvent(input: OrchestratorInput): GameEventInput {
    return GameEventFactory.profileLike({
      uid:           input.uid,
      targetUid:     input.targetUid!,
      platform:      input.platform,
      sessionId:     input.sessionId,
      correlationId: input.correlationId,
    });
  }

  // Override: registra anti-farm após validação bem-sucedida
  protected async afterValidate(input: OrchestratorInput): Promise<void> {
    await AntiFarmService.register({
      eventType: 'PROFILE_LIKE',
      uid:       input.uid,
      targetUid: input.targetUid,
    });
  }
}