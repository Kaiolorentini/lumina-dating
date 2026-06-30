// ============================================
// LUMINA — RANKING DISPATCHER v3.0
// functions/src/gamification/services/RankingDispatcher.ts
//
// SPRINT 1A — v3.0: respeita DispatcherMode (LEGACY/SHADOW/ENGINE).
// Regra do projeto: nenhum Dispatcher novo persiste enquanto
// o legado correspondente ainda for a fonte da verdade.
// ============================================

import { IGameDispatcher, DispatcherMetadata } from '../IGameDispatcher';
import { GameEventInput, DispatcherResult }     from '../GameEventContext';
import { registerDispatcher }                   from '../DispatcherRegistry';
import { RankingService }                       from './RankingService';
import { XP_ACTION_VALUES }                     from '../../config/xpValues';
import { getDispatcherMode }                    from '../featureflags/DispatcherMode';
import { ShadowComparisonService }              from '../shadow/ShadowComparisonService';
import { GameLogger }                           from '../GameLogger';

const EVENT_TO_XP_ACTION: Record<string, string> = {
  PROFILE_LIKE:      'GIVE_LIKE',
  MATCH_CREATED:     'CREATE_SINTONIA',
  MESSAGE_REPLY:     'START_CONVO',
  MISSION_COMPLETED: 'COMPLETE_MISSION',
};

class RankingDispatcherImpl implements IGameDispatcher {
  getMetadata(): DispatcherMetadata {
    return {
      name:      'RankingDispatcher',
      version:   3,
      type:      'RANKING',
      timeoutMs: 2000,
      retryable: true, // ADR-011: Ranking = retry, não obrigatório
      priority:  'NORMAL',
    };
  }

  canHandle(input: GameEventInput): boolean {
    return RankingService.getCategoryForEvent(input.eventType) !== undefined;
  }

  async dispatch(input: GameEventInput): Promise<DispatcherResult> {
    if (!this.canHandle(input)) {
      return { dispatcher: 'RANKING', status: 'SKIPPED', durationMs: 0 };
    }

    const mode = await getDispatcherMode('RANKING');

    const actionKey = EVENT_TO_XP_ACTION[input.eventType];
    const xpAmount   = actionKey ? (XP_ACTION_VALUES[actionKey]?.xp ?? 0) : 0;

    // Sempre calcula — mesmo em modo LEGACY (custo baixo, sem persistir)
    const computation = await RankingService.computeXP(input.uid, input.eventType, xpAmount);

    switch (mode) {
      case 'LEGACY': {
        // Legado é a fonte da verdade. Engine calcula mas nunca persiste.
        return {
          dispatcher: 'RANKING', status: 'SKIPPED', durationMs: 0,
          warnings: ['Modo LEGACY — RankingDispatcher não persiste'],
        };
      }

      case 'SHADOW': {
        // Calcula + compara com o legado. Nunca persiste.
        if (!computation.skipped) {
          await ShadowComparisonService.compare({
            system:  'RANKING',
            uid:     input.uid,
            eventId: input.eventId,
            legacyResult: {}, // legado grava via registerRankingXP — comparação real entra na Sprint 1C
            engineResult: { socialXP: computation.newSocialXP, weeklyXP: computation.xpAmount },
          });
        }
        GameLogger.info({
          dispatcher: 'RANKING', eventId: input.eventId, uid: input.uid,
          message: 'Shadow Mode — comparado sem persistir',
        });
        return { dispatcher: 'RANKING', status: 'SKIPPED', durationMs: 0, warnings: ['Modo SHADOW — comparado sem persistir'] };
      }

      case 'ENGINE': {
        // Legado desligado — Engine é a fonte da verdade. Persiste de fato.
        if (computation.skipped) {
          return { dispatcher: 'RANKING', status: 'SKIPPED', durationMs: 0, warnings: [computation.reason ?? ''] };
        }
        await RankingService.persist(computation);
        GameLogger.info({
          dispatcher: 'RANKING', eventId: input.eventId, uid: input.uid,
          message: 'Ranking persistido (modo ENGINE)', meta: { socialXP: computation.newSocialXP },
        });
        return { dispatcher: 'RANKING', status: 'SUCCESS', durationMs: 0 };
      }
    }
  }
}

registerDispatcher(new RankingDispatcherImpl());