// ============================================
// LUMINA — MATCH CREATED ORCHESTRATOR v1.0
// functions/src/gamification/orchestrators/MatchCreatedOrchestrator.ts
//
// Fluxo MATCH_CREATED:
//   1. MatchCreatedValidator
//   2. AntiFarmService.register()
//   3. GamificationIntegrationService.handleMatchCreated()
// Dispara: Vault + XP + Tree + Prestige + Achievement + Ranking.
// Evento mais complexo — nunca criado pelo cliente.
// ============================================

import { BaseEventOrchestrator }   from './BaseEventOrchestrator';
import { OrchestratorInput }       from '../IEventOrchestrator';
import { GameEventInput }          from '../GameEventContext';
import { GameEventFactory }        from '../GameEventFactory';
import { MatchCreatedValidator }   from '../validation/MatchCreatedValidator';
import { AntiFarmService }         from '../antifarm/AntiFarmService';

export class MatchCreatedOrchestrator extends BaseEventOrchestrator {
  readonly eventType = 'MATCH_CREATED' as const;

  private readonly validator = new MatchCreatedValidator();

  async validate(input: OrchestratorInput): Promise<void> {
    await this.validator.validate({
      uid:           input.uid,
      targetUid:     input.targetUid,
      eventType:     'MATCH_CREATED',
      correlationId: input.correlationId,
    });
  }

  buildEvent(input: OrchestratorInput): GameEventInput {
    return GameEventFactory.matchCreated({
      uid:           input.uid,
      targetUid:     input.targetUid!,
      correlationId: input.correlationId,
    });
  }

  protected async afterValidate(input: OrchestratorInput): Promise<void> {
    await AntiFarmService.register({
      eventType: 'MATCH_CREATED',
      uid:       input.uid,
      targetUid: input.targetUid,
    });
  }
}