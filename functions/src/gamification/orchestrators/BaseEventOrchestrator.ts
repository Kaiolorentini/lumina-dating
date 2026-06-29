// ============================================
// LUMINA — BASE EVENT ORCHESTRATOR v1.1
// functions/src/gamification/orchestrators/BaseEventOrchestrator.ts
//
// v1.1: hook afterValidate() para registro pós-validação
// (ex: AntiFarmService.register após validação bem-sucedida)
// ============================================

import { IEventOrchestrator, OrchestratorInput } from '../IEventOrchestrator';
import { GameEventInput }    from '../GameEventContext';
import { GameEventType }     from '../GameEventTypes';
import { handleError }       from '../ErrorBoundary';
import { GameLogger }        from '../GameLogger';
import { GamificationIntegrationService } from '../GamificationIntegrationService';

export abstract class BaseEventOrchestrator implements IEventOrchestrator {
  abstract readonly eventType: GameEventType;

  abstract validate(input: OrchestratorInput): Promise<void>;
  abstract buildEvent(input: OrchestratorInput): GameEventInput;

  // Hook: chamado após validação bem-sucedida (ex: registrar anti-farm)
  protected async afterValidate(_input: OrchestratorInput): Promise<void> {}

  // Hook: gatilhos emocionais opcionais
  protected async runEmotionalTriggers(_input: OrchestratorInput): Promise<void> {}

  async execute(input: OrchestratorInput): Promise<void> {
    const errorCtx = {
      uid:           input.uid,
      eventId:       `${this.eventType}_${input.uid}_${input.targetUid ?? ''}`,
      correlationId: input.correlationId,
    };

    // ETAPA 1: Validação
    try {
      await this.validate(input);
    } catch (error) {
      const boundary = handleError(error, errorCtx);
      GameLogger.warn({
        dispatcher: 'ANALYTICS',
        eventId:    errorCtx.eventId,
        uid:        input.uid,
        message:    `${this.eventType} ignorado: ${boundary.message}`,
        warning:    boundary.code,
        meta:       { correlationId: input.correlationId },
      });
      return;
    }

    // ETAPA 2: Pós-validação (registro anti-farm, etc.)
    try {
      await this.afterValidate(input);
    } catch (error) {
      handleError(error, errorCtx);
      // Falha no registro não cancela o fluxo
    }

    // ETAPA 3: Gatilhos emocionais (onde aplicável)
    try {
      await this.runEmotionalTriggers(input);
    } catch (error) {
      handleError(error, errorCtx);
    }

    // ETAPA 4: Gamification — fire-and-forget
    this.dispatchGamification(input);
  }

  private dispatchGamification(input: OrchestratorInput): void {
    switch (this.eventType) {
      case 'PROFILE_LIKE':
        GamificationIntegrationService.handleProfileLike({
          likerUid:  input.uid,
          targetUid: input.targetUid!,
        });
        break;
      case 'MESSAGE_REPLY':
        GamificationIntegrationService.handleMessageReply({
          uid:          input.uid,
          targetUid:    input.targetUid!,
          messageCount: (input.meta?.messageCount as number) ?? 2,
        });
        break;
      case 'MATCH_CREATED':
        GamificationIntegrationService.handleMatchCreated({
          uid:       input.uid,
          targetUid: input.targetUid!,
        });
        break;
      case 'MISSION_COMPLETED':
        GamificationIntegrationService.handleMissionCompleted({
          uid:             input.uid,
          missionId:       (input.meta?.missionId as string)       ?? '',
          missionCategory: (input.meta?.missionCategory as string) ?? '',
        });
        break;
      default:
        GameLogger.warn({
          dispatcher: 'ANALYTICS',
          eventId:    errorCtx(input).eventId,
          uid:        input.uid,
          message:    `Nenhum handler para ${this.eventType}`,
          warning:    'UNHANDLED_EVENT_TYPE',
        });
    }
  }
}

function errorCtx(input: OrchestratorInput) {
  return { uid: input.uid, eventId: `dispatch_${input.uid}`, correlationId: input.correlationId };
}