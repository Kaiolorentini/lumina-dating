// ============================================
// LUMINA — MISSION COMPLETED ORCHESTRATOR v2.0
// functions/src/gamification/orchestrators/MissionCompletedOrchestrator.ts
//
// SPRINT 1B: simplificado.
// MissionService.completeMission() (chamado por progressMission)
// já entrega fragmentos E dispara o Engine internamente.
//
// Este Orchestrator não é mais o caminho principal de disparo —
// mantido apenas para chamadas diretas eventuais via onMissionCompleted CF,
// caso algum fluxo futuro precise notificar o Engine sem passar por
// progressMission (ex: missão concluída por evento externo/automático).
//
// Nunca entrega fragmentos — isso é responsabilidade exclusiva
// do MissionService.completeMission().
// ============================================

import { BaseEventOrchestrator }       from './BaseEventOrchestrator';
import { OrchestratorInput }           from '../IEventOrchestrator';
import { GameEventInput }              from '../GameEventContext';
import { GameEventFactory }            from '../GameEventFactory';
import { MissionCompletedValidator }   from '../validation/MissionCompletedValidator';

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

  // Usa o fluxo padrão do BaseEventOrchestrator:
  // validate → afterValidate (no-op) → runEmotionalTriggers (no-op) → dispatchGamification
  // Não entrega fragmentos. Isso é feito por MissionService.completeMission().
}