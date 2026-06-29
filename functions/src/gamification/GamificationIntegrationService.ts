// ============================================
// LUMINA — GAMIFICATION INTEGRATION SERVICE v1.3
// functions/src/gamification/GamificationIntegrationService.ts
//
// v1.3: handleProfileLike implementado.
// Serviço burro: Factory + Processor + Logger.
// ============================================

import { GameEventFactory }           from './GameEventFactory';
import { GameEventProcessor, ProcessorOptions } from './GameEventProcessor';
import { AnalyticsRepository }        from './repositories/AnalyticsRepository';
import { GameLogger }                 from './GameLogger';

function newCorrelationId(): string {
  return `corr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function fireAndForget(
  eventType:     string,
  uid:           string,
  correlationId: string,
  opts:          ProcessorOptions,
  eventFn:       () => ReturnType<typeof GameEventFactory.profileVisit>
): Promise<void> {
  await AnalyticsRepository.record({ eventType, uid, correlationId, status: 'started' });
  const event     = eventFn();
  const processor = new GameEventProcessor(opts);
  const result    = await processor.process(event);
  const status    = result.status === 'COMPLETED' ? 'completed' : 'failed';
  await AnalyticsRepository.record({
    eventType, uid, correlationId, status,
    meta: { dispatchersExecuted: result.dispatchersExecuted, errors: result.errors },
  });
  GameLogger.info({
    dispatcher: 'ANALYTICS', eventId: event.eventId, uid,
    message: `${eventType} ${result.status}`, meta: { correlationId },
  });
}

function run(fn: () => Promise<void>, uid: string, correlationId: string, eventType: string): void {
  fn().catch(err => {
    AnalyticsRepository.record({ eventType, uid, correlationId, status: 'failed', meta: { error: String(err) } });
    GameLogger.error({ dispatcher: 'ANALYTICS', eventId: 'unknown', uid, message: `${eventType} falhou`, error: String(err), meta: { correlationId } });
  });
}

export interface ProfileVisitParams { visitorUid: string; targetUid: string; platform?: 'ios'|'android'|'web'; sessionId?: string; }
export interface ProfileLikeParams  { likerUid: string;  targetUid: string; }
export interface MessageReplyParams { uid: string; targetUid: string; messageCount: number; }
export interface MatchCreatedParams { uid: string; targetUid: string; }
export interface MissionCompletedParams { uid: string; missionId: string; missionCategory: string; }

export const GamificationIntegrationService = {

  handleProfileVisit(p: ProfileVisitParams): void {
    const cid  = newCorrelationId();
    const opts: ProcessorOptions = { correlationId: cid, originCF: 'onProfileVisit', triggerName: 'profile_visits/{visitId}' };
    run(() => fireAndForget('PROFILE_VISIT', p.visitorUid, cid, opts,
      () => GameEventFactory.profileVisit({ uid: p.visitorUid, targetUid: p.targetUid, platform: p.platform, sessionId: p.sessionId, correlationId: cid })
    ), p.visitorUid, cid, 'PROFILE_VISIT');
  },

  handleProfileLike(p: ProfileLikeParams): void {
    const cid  = newCorrelationId();
    const opts: ProcessorOptions = { correlationId: cid, originCF: 'onProfileLike', triggerName: 'likes/{likeId}' };
    run(() => fireAndForget('PROFILE_LIKE', p.likerUid, cid, opts,
      () => GameEventFactory.profileLike({ uid: p.likerUid, targetUid: p.targetUid, correlationId: cid })
    ), p.likerUid, cid, 'PROFILE_LIKE');
  },

  handleMessageReply(p: MessageReplyParams): void {
    const cid  = newCorrelationId();
    const opts: ProcessorOptions = { correlationId: cid, originCF: 'onMessageReply', triggerName: 'messages/{msgId}' };
    run(() => fireAndForget('MESSAGE_REPLY', p.uid, cid, opts,
      () => GameEventFactory.messageReply({ uid: p.uid, targetUid: p.targetUid, correlationId: cid, meta: { messageCount: p.messageCount } })
    ), p.uid, cid, 'MESSAGE_REPLY');
  },

  handleMatchCreated(p: MatchCreatedParams): void {
    const cid  = newCorrelationId();
    const opts: ProcessorOptions = { correlationId: cid, originCF: 'MatchService', triggerName: 'createMatch' };
    run(() => fireAndForget('MATCH_CREATED', p.uid, cid, opts,
      () => GameEventFactory.matchCreated({ uid: p.uid, targetUid: p.targetUid, correlationId: cid })
    ), p.uid, cid, 'MATCH_CREATED');
  },

  handleMissionCompleted(p: MissionCompletedParams): void {
    const cid  = newCorrelationId();
    const opts: ProcessorOptions = { correlationId: cid, originCF: 'MissionService', triggerName: 'completeMission' };
    run(() => fireAndForget('MISSION_COMPLETED', p.uid, cid, opts,
      () => GameEventFactory.missionCompleted({ uid: p.uid, correlationId: cid, meta: { missionId: p.missionId, missionCategory: p.missionCategory } })
    ), p.uid, cid, 'MISSION_COMPLETED');
  },
};