// ============================================
// LUMINA — RANKING DISPATCHER v6.0
// functions/src/gamification/services/RankingDispatcher.ts
//
// SPRINT 1C — v6.0: simplificado. Comparação Shadow é
// responsabilidade exclusiva do RankingCompatibilityAdapter
// (Calculator puro, fora do pipeline do Engine).
// ============================================

import { IGameDispatcher, DispatcherMetadata } from '../IGameDispatcher';
import { GameEventInput, DispatcherResult }     from '../GameEventContext';
import { registerDispatcher }                   from '../DispatcherRegistry';
import { RankingService }                       from './RankingService';
import { XP_ACTION_VALUES }                     from '../../config/xpValues';
import { getDispatcherMode }                    from '../featureflags/DispatcherMode';
import { GameLogger }                           from '../GameLogger';

const EVENT_TO_XP_ACTION: Record<string, string> = {
  PROFILE_LIKE:      'GIVE_LIKE',
  MATCH_CREATED:     'CREATE_SINTONIA',
  MESSAGE_REPLY:     'START_CONVO',
  MISSION_COMPLETED: 'COMPLETE_MISSION',
};

class RankingDispatcherImpl implements IGameDispatcher {
  getMetadata(): DispatcherMetadata {
    return { name: 'RankingDispatcher', version: 6, type: 'RANKING', timeoutMs: 2000, retryable: true, priority: 'NORMAL' };
  }

  canHandle(input: GameEventInput): boolean {
    return RankingService.getCategoryForEvent(input.eventType) !== undefined;
  }

  async dispatch(input: GameEventInput): Promise<DispatcherResult> {
    if (!this.canHandle(input)) {
      return { dispatcher: 'RANKING', status: 'SKIPPED', durationMs: 0 };
    }

    const mode = await getDispatcherMode('RANKING');

    if (mode !== 'ENGINE') {
      return { dispatcher: 'RANKING', status: 'SKIPPED', durationMs: 0, warnings: [`Modo ${mode} — RankingDispatcher não persiste`] };
    }

    const actionKey  = EVENT_TO_XP_ACTION[input.eventType];
    const xpAmount    = actionKey ? (XP_ACTION_VALUES[actionKey]?.xp ?? 0) : 0;
    const computation = await RankingService.computeXP(input.uid, input.eventType, xpAmount);

    if (computation.skipped) {
      return { dispatcher: 'RANKING', status: 'SKIPPED', durationMs: 0, warnings: [computation.reason ?? ''] };
    }

    await RankingService.persist(computation);
    GameLogger.info({ dispatcher: 'RANKING', eventId: input.eventId, uid: input.uid, message: 'Ranking persistido (modo ENGINE)', meta: { socialXP: computation.newSocialXP } });
    return { dispatcher: 'RANKING', status: 'SUCCESS', durationMs: 0 };
  }
}

registerDispatcher(new RankingDispatcherImpl());