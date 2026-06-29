// ============================================
// LUMINA — XP DISPATCHER v2.0
// functions/src/gamification/services/XPDispatcher.ts
//
// RESPONSABILIDADE ÚNICA: adaptar GameEventInput → XPService.
// Sem regras de negócio. Sem acesso ao Firestore.
// ============================================

import { IGameDispatcher, DispatcherMetadata } from '../IGameDispatcher';
import { GameEventInput, DispatcherResult }     from '../GameEventContext';
import { registerDispatcher }                   from '../DispatcherRegistry';
import { XPService }                            from './XPService';
import { GameLogger }                           from '../GameLogger';

class XPDispatcher implements IGameDispatcher {
  getMetadata(): DispatcherMetadata {
    return { name: 'XPDispatcher', version: 2, type: 'XP', timeoutMs: 1000, retryable: false, priority: 'NORMAL' };
  }

  canHandle(input: GameEventInput): boolean {
    return XPService.getActionKey(input.eventType) !== undefined;
  }

  async dispatch(input: GameEventInput): Promise<DispatcherResult> {
    if (!this.canHandle(input)) {
      return { dispatcher: 'XP', status: 'SKIPPED', durationMs: 0, warnings: [`Sem ação XP para ${input.eventType}`] };
    }

    const result = await XPService.process(input.uid, input.eventId, input.eventType);

    if (result.skipped) {
      GameLogger.warn({ dispatcher: 'XP', eventId: input.eventId, uid: input.uid, message: 'XP pulado', warning: result.reason ?? '' });
      return { dispatcher: 'XP', status: 'SKIPPED', durationMs: 0, warnings: [result.reason ?? ''] };
    }

    GameLogger.info({ dispatcher: 'XP', eventId: input.eventId, uid: input.uid, message: 'XP concedido', meta: { xpGained: result.xpGained } });
    return { dispatcher: 'XP', status: 'SUCCESS', durationMs: 0 };
  }
}

registerDispatcher(new XPDispatcher());