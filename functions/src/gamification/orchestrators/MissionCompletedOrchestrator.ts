// ============================================
// LUMINA — MISSION COMPLETED ORCHESTRATOR v1.0
// functions/src/gamification/orchestrators/MissionCompletedOrchestrator.ts
//
// Fluxo MISSION_COMPLETED:
//   1. MissionCompletedValidator (server-side)
//   2. MissionService.claimReward() — fragmentos ANTES do Engine
//   3. GamificationIntegrationService.handleMissionCompleted()
// Nunca gera Cristais Premium.
// ============================================

import { BaseEventOrchestrator }       from './BaseEventOrchestrator';
import { OrchestratorInput }           from '../IEventOrchestrator';
import { GameEventInput }              from '../GameEventContext';
import { GameEventFactory }            from '../GameEventFactory';
import { MissionCompletedValidator }   from '../validation/MissionCompletedValidator';
import { MissionService }              from '../services/MissionService';
import { GamificationIntegrationService } from '../GamificationIntegrationService';
import { handleError }                 from '../ErrorBoundary';
import { GameLogger }                  from '../GameLogger';

export class MissionCompletedOrchestrator extends BaseEventOrchestrator {
  readonly eventType = 'MISSION_COMPLETED' as const;

  private readonly validator = new MissionCompletedValidator();

  async validate(input: OrchestratorInput): Promise<void> {
    await this.validator.validate({
      uid:           input.uid,
      eventType:     'MISSION_COMPLETED',
      correlationId: input.correlationId,
      meta:          input.meta,
    });
  }

  buildEvent(input: OrchestratorInput): GameEventInput {
    return GameEventFactory.missionCompleted({
      uid:           input.uid,
      correlationId: input.correlationId,
      meta: {
        missionId:       (input.meta?.missionId as string)       ?? '',
        missionCategory: (input.meta?.missionCategory as string) ?? 'MISSION',
      },
    });
  }

  // Override execute — fragmentos entregues ANTES do Engine
  async execute(input: OrchestratorInput): Promise<void> {
    const errorCtx = {
      uid:           input.uid,
      eventId:       `MISSION_COMPLETED_${input.uid}`,
      correlationId: input.correlationId,
    };

    // ETAPA 1: Validação server-side
    try {
      await this.validate(input);
    } catch (error) {
      const boundary = handleError(error, errorCtx);
      GameLogger.warn({
        dispatcher: 'ANALYTICS',
        eventId:    errorCtx.eventId,
        uid:        input.uid,
        message:    `MISSION_COMPLETED ignorado: ${boundary.message}`,
        warning:    boundary.code,
        meta:       { correlationId: input.correlationId },
      });
      return;
    }

    // ETAPA 2: Entrega fragmentos ANTES do Engine (transaction)
    let missionCategory = 'MISSION';
    try {
      const reward = await MissionService.claimReward(
        input.uid,
        (input.meta?.missionId as string) ?? ''
      );
      missionCategory = reward.missionCategory;
      GameLogger.info({
        dispatcher: 'ANALYTICS',
        eventId:    errorCtx.eventId,
        uid:        input.uid,
        message:    `Fragmentos entregues: ${reward.fragmentsEarned}`,
        meta:       { missionId: reward.missionId, correlationId: input.correlationId },
      });
    } catch (error) {
      handleError(error, errorCtx);
      return; // Não dispara Engine se fragmentos falharem
    }

    // ETAPA 3: Engine — fire-and-forget (XP + Achievement + Ranking)
    GamificationIntegrationService.handleMissionCompleted({
      uid:             input.uid,
      missionId:       (input.meta?.missionId as string) ?? '',
      missionCategory,
    });
  }

  // buildEvent não é chamado diretamente — execute foi sobrescrito
  protected async afterValidate(_input: OrchestratorInput): Promise<void> {}
}