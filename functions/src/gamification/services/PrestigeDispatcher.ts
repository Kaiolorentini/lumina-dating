// ============================================
// LUMINA — PRESTIGE DISPATCHER v4.0
// functions/src/gamification/services/PrestigeDispatcher.ts
//
// SPRINT 1C — v4.0: simplificado. Comparação Shadow é
// responsabilidade exclusiva do PrestigeCompatibilityAdapter.
// ============================================

import { IGameDispatcher, DispatcherMetadata } from '../IGameDispatcher';
import { GameEventInput, DispatcherResult }     from '../GameEventContext';
import { registerDispatcher }                   from '../DispatcherRegistry';
import { PrestigeService }                      from './PrestigeService';
import { getDispatcherMode }                    from '../featureflags/DispatcherMode';
import { GameLogger }                           from '../GameLogger';

class PrestigeDispatcherImpl implements IGameDispatcher {
  getMetadata(): DispatcherMetadata {
    return { name: 'PrestigeDispatcher', version: 4, type: 'PRESTIGE', timeoutMs: 2000, retryable: true, priority: 'NORMAL' };
  }

  canHandle(input: GameEventInput): boolean {
    return PrestigeService.canHandle(input.eventType);
  }

  async dispatch(input: GameEventInput): Promise<DispatcherResult> {
    if (!this.canHandle(input)) {
      return { dispatcher: 'PRESTIGE', status: 'SKIPPED', durationMs: 0 };
    }

    const mode = await getDispatcherMode('PRESTIGE');

    if (mode !== 'ENGINE') {
      return { dispatcher: 'PRESTIGE', status: 'SKIPPED', durationMs: 0, warnings: [`Modo ${mode} — PrestigeDispatcher não persiste`] };
    }

    const computation = await PrestigeService.computeEvolution(input.uid, input.eventType);
    if (computation.skipped) {
      return { dispatcher: 'PRESTIGE', status: 'SKIPPED', durationMs: 0, warnings: [computation.reason ?? ''] };
    }

    await PrestigeService.persist(input.uid, computation);
    GameLogger.info({ dispatcher: 'PRESTIGE', eventId: input.eventId, uid: input.uid, message: 'Prestígio persistido (modo ENGINE)', meta: { newStage: computation.newStage } });
    return { dispatcher: 'PRESTIGE', status: 'SUCCESS', durationMs: 0 };
  }
}

registerDispatcher(new PrestigeDispatcherImpl());