// ============================================
// LUMINA — TREE DISPATCHER v4.0
// functions/src/gamification/services/TreeDispatcher.ts
//
// SPRINT 1C — v4.0: simplificado. Comparação Shadow é
// responsabilidade exclusiva do TreeCompatibilityAdapter.
// ============================================

import { IGameDispatcher, DispatcherMetadata } from '../IGameDispatcher';
import { GameEventInput, DispatcherResult }     from '../GameEventContext';
import { registerDispatcher }                   from '../DispatcherRegistry';
import { TreeService }                          from './TreeService';
import { getDispatcherMode }                    from '../featureflags/DispatcherMode';
import { GameLogger }                           from '../GameLogger';

class TreeDispatcherImpl implements IGameDispatcher {
  getMetadata(): DispatcherMetadata {
    return { name: 'TreeDispatcher', version: 4, type: 'TREE', timeoutMs: 2000, retryable: true, priority: 'NORMAL' };
  }

  canHandle(input: GameEventInput): boolean {
    return TreeService.canHandle(input.eventType);
  }

  async dispatch(input: GameEventInput): Promise<DispatcherResult> {
    if (!this.canHandle(input)) {
      return { dispatcher: 'TREE', status: 'SKIPPED', durationMs: 0 };
    }

    const mode = await getDispatcherMode('TREE');

    if (mode !== 'ENGINE') {
      return { dispatcher: 'TREE', status: 'SKIPPED', durationMs: 0, warnings: [`Modo ${mode} — TreeDispatcher não persiste`] };
    }

    const computation = await TreeService.computeEvolution(input.uid, input.eventType);
    if (computation.skipped) {
      return { dispatcher: 'TREE', status: 'SKIPPED', durationMs: 0, warnings: [computation.reason ?? ''] };
    }

    await TreeService.persist(input.uid, computation);
    GameLogger.info({ dispatcher: 'TREE', eventId: input.eventId, uid: input.uid, message: 'Árvore persistida (modo ENGINE)', meta: { newStage: computation.newStage } });
    return { dispatcher: 'TREE', status: 'SUCCESS', durationMs: 0 };
  }
}

registerDispatcher(new TreeDispatcherImpl());