// ============================================
// LUMINA — GAMIFICATION INTEGRATION SERVICE v1.4
// functions/src/gamification/GamificationIntegrationService.ts
//
// v1.4: os handlers DEVOLVEM a promise e o chamador aguarda.
//
// Até a v1.3 o run() disparava fn() e retornava void. A Cloud
// Function que chamava o handler terminava antes da gamificação,
// e o Google estrangula a CPU da instância depois que a function
// termina: o trabalho seguia a conta-gotas (dispatchers de 6 a
// 10s numa transação de ~300ms) e podia ser perdido se a
// instância fosse reciclada no meio.
//
// O catch continua engolindo o erro: uma falha na gamificação
// nunca derruba o fluxo principal (sintonia, visita, mensagem).
//
// Serviço burro: Factory + Processor + Logger.
// ============================================

import { GameEventFactory }           from './GameEventFactory';
import { GameEventProcessor, ProcessorOptions } from './GameEventProcessor';
import { AnalyticsRepository }        from './repositories/AnalyticsRepository';
import { GameLogger }                 from './GameLogger';

function newCorrelationId(): string {
  return `corr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function processAndRecord(
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

async function run(fn: () => Promise<void>, uid: string, correlationId: string, eventType: string): Promise<void> {
  try {
    await fn();
  } catch (err) {
    GameLogger.error({ dispatcher: 'ANALYTICS', eventId: 'unknown', uid, message: `${eventType} falhou`, error: String(err), meta: { correlationId } });
    await AnalyticsRepository.record({ eventType, uid, correlationId, status: 'failed', meta: { error: String(err) } })
      .catch(() => {});
  }
}

export interface ProfileVisitParams { visitorUid: string; targetUid: string; platform?: 'ios'|'android'|'web'; sessionId?: string; }
export interface ProfileLikeParams  { likerUid: string;  targetUid: string; }
export interface MessageReplyParams { uid: string; targetUid: string; messageCount: number; }
export interface MatchCreatedParams { uid: string; targetUid: string; }
export interface MissionCompletedParams { uid: string; missionId: string; missionCategory: string; }

export const GamificationIntegrationService = {

  handleProfileVisit(p: ProfileVisitParams): Promise<void> {
    const cid  = newCorrelationId();
    const opts: ProcessorOptions = { correlationId: cid, originCF: 'onProfileVisit', triggerName: 'profile_visits/{visitId}' };
    return run(() => processAndRecord('PROFILE_VISIT', p.visitorUid, cid, opts,
      () => GameEventFactory.profileVisit({ uid: p.visitorUid, targetUid: p.targetUid, platform: p.platform, sessionId: p.sessionId, correlationId: cid })
    ), p.visitorUid, cid, 'PROFILE_VISIT');
  },

  handleProfileLike(p: ProfileLikeParams): Promise<void> {
    const cid  = newCorrelationId();
    // triggerName dizia 'likes/{likeId}', contrato do mundo antigo
    // em que o cliente gravava a curtida. Desde a 2D quem grava é
    // o onCreateMatch, e o rastro de auditoria apontava para um
    // trigger que não existe mais.
    const opts: ProcessorOptions = { correlationId: cid, originCF: 'onProfileLike', triggerName: 'onCreateMatch' };
    return run(() => processAndRecord('PROFILE_LIKE', p.likerUid, cid, opts,
      () => GameEventFactory.profileLike({ uid: p.likerUid, targetUid: p.targetUid, correlationId: cid })
    ), p.likerUid, cid, 'PROFILE_LIKE');
  },

  handleMessageReply(p: MessageReplyParams): Promise<void> {
    const cid  = newCorrelationId();
    const opts: ProcessorOptions = { correlationId: cid, originCF: 'onMessageReply', triggerName: 'messages/{msgId}' };
    return run(() => processAndRecord('MESSAGE_REPLY', p.uid, cid, opts,
      () => GameEventFactory.messageReply({ uid: p.uid, targetUid: p.targetUid, correlationId: cid, meta: { messageCount: p.messageCount } })
    ), p.uid, cid, 'MESSAGE_REPLY');
  },

  handleMatchCreated(p: MatchCreatedParams): Promise<void> {
    const cid  = newCorrelationId();
    const opts: ProcessorOptions = { correlationId: cid, originCF: 'MatchService', triggerName: 'createMatch' };
    return run(() => processAndRecord('MATCH_CREATED', p.uid, cid, opts,
      () => GameEventFactory.matchCreated({ uid: p.uid, targetUid: p.targetUid, correlationId: cid })
    ), p.uid, cid, 'MATCH_CREATED');
  },

  handleMissionCompleted(p: MissionCompletedParams): Promise<void> {
    const cid  = newCorrelationId();
    const opts: ProcessorOptions = { correlationId: cid, originCF: 'MissionService', triggerName: 'completeMission' };
    return run(() => processAndRecord('MISSION_COMPLETED', p.uid, cid, opts,
      () => GameEventFactory.missionCompleted({ uid: p.uid, correlationId: cid, meta: { missionId: p.missionId, missionCategory: p.missionCategory } })
    ), p.uid, cid, 'MISSION_COMPLETED');
  },
};