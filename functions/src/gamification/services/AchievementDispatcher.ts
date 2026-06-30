// ============================================
// LUMINA — ACHIEVEMENT DISPATCHER v3.0
// functions/src/gamification/services/AchievementDispatcher.ts
//
// SPRINT 1C — v3.0: simplificado. Comparação Shadow é
// responsabilidade exclusiva do AchievementCompatibilityAdapter.
// ============================================

import { IGameDispatcher, DispatcherMetadata } from '../IGameDispatcher';
import { GameEventInput, DispatcherResult }     from '../GameEventContext';
import { registerDispatcher }                   from '../DispatcherRegistry';
import { AchievementService }                   from './AchievementService';
import { getDispatcherMode }                    from '../featureflags/DispatcherMode';
import { GameLogger }                           from '../GameLogger';

class AchievementDispatcherImpl implements IGameDispatcher {
  getMetadata(): DispatcherMetadata {
    return { name: 'AchievementDispatcher', version: 3, type: 'ACHIEVEMENT', timeoutMs: 2000, retryable: true, priority: 'NORMAL' };
  }

  canHandle(input: GameEventInput): boolean {
    return AchievementService.getActionKey(input.eventType) !== undefined;
  }

  async dispatch(input: GameEventInput): Promise<DispatcherResult> {
    if (!this.canHandle(input)) {
      return { dispatcher: 'ACHIEVEMENT', status: 'SKIPPED', durationMs: 0 };
    }

    const mode = await getDispatcherMode('ACHIEVEMENT');

    if (mode !== 'ENGINE') {
      return { dispatcher: 'ACHIEVEMENT', status: 'SKIPPED', durationMs: 0, warnings: [`Modo ${mode} — AchievementDispatcher não persiste`] };
    }

    const computation = await AchievementService.computeUnlocks(input.uid, input.eventType);
    if (computation.skipped) {
      return { dispatcher: 'ACHIEVEMENT', status: 'SKIPPED', durationMs: 0, warnings: [computation.reason ?? ''] };
    }

    const unlocked = await AchievementService.persist(input.uid, input.eventType, computation);
    GameLogger.info({ dispatcher: 'ACHIEVEMENT', eventId: input.eventId, uid: input.uid, message: 'Conquistas persistidas (modo ENGINE)', meta: { unlocked } });
    return { dispatcher: 'ACHIEVEMENT', status: 'SUCCESS', durationMs: 0 };
  }
}

registerDispatcher(new AchievementDispatcherImpl());