// ============================================
// LUMINA — GAMIFICATION INTEGRATION SERVICE v1.2
// functions/src/gamification/GamificationIntegrationService.ts
//
// BLOCO 4 — Serviço burro: Factory + Processor + Logger.
// Não conhece XP, Cofre ou Missões.
// Sem Firestore direto — usa AnalyticsRepository.
// ============================================

import { GameEventFactory }           from './GameEventFactory';
import { GameEventProcessor, ProcessorOptions } from './GameEventProcessor';
import { AnalyticsRepository }        from './repositories/AnalyticsRepository';
import { GameLogger }                 from './GameLogger';

function newCorrelationId(): string {
  return `corr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export interface ProfileVisitParams {
  visitorUid: string;
  targetUid:  string;
  platform?:  'ios' | 'android' | 'web';
  sessionId?: string;
}

export const GamificationIntegrationService = {

  handleProfileVisit(params: ProfileVisitParams): void {
    const correlationId = newCorrelationId();
    const opts: ProcessorOptions = {
      correlationId, originCF: 'onProfileVisit', triggerName: 'profile_visits/{visitId}',
    };

    (async () => {
      await AnalyticsRepository.record({
        eventType: 'PROFILE_VISIT', uid: params.visitorUid,
        correlationId, status: 'started', meta: { targetUid: params.targetUid },
      });

      const event     = GameEventFactory.profileVisit({ uid: params.visitorUid, targetUid: params.targetUid, platform: params.platform, sessionId: params.sessionId });
      const processor = new GameEventProcessor(opts);
      const result    = await processor.process(event);

      const status = result.status === 'COMPLETED' ? 'completed' : 'failed';
      await AnalyticsRepository.record({
        eventType: 'PROFILE_VISIT', uid: params.visitorUid,
        correlationId, status,
        meta: { targetUid: params.targetUid, dispatchersExecuted: result.dispatchersExecuted, totalDurationMs: result.totalDurationMs, errors: result.errors },
      });

      GameLogger.info({ dispatcher: 'ANALYTICS', eventId: event.eventId, uid: params.visitorUid, message: `PROFILE_VISIT ${result.status}`, meta: { correlationId } });
    })().catch(err => {
      AnalyticsRepository.record({ eventType: 'PROFILE_VISIT', uid: params.visitorUid, correlationId, status: 'failed', meta: { error: String(err) } });
      GameLogger.error({ dispatcher: 'ANALYTICS', eventId: 'unknown', uid: params.visitorUid, message: 'IntegrationService falhou', error: String(err), meta: { correlationId } });
    });
  },

  // Stubs para Bloco 5 (REGRA 7)
  handleProfileLike(_p: { likerUid: string; targetUid: string }): void { /* TODO Bloco 5 */ },
  handleMatchCreated(_p: { uid: string; targetUid: string }): void { /* TODO Bloco 5 */ },
  handleMessageReply(_p: { uid: string; targetUid: string; messageCount: number }): void { /* TODO Bloco 5 */ },
  handleMissionCompleted(_p: { uid: string; missionId: string; missionCategory: string }): void { /* TODO Bloco 5 */ },
};