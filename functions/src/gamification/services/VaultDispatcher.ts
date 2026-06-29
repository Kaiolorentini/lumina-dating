// ============================================
// LUMINA — VAULT DISPATCHER v2.0
// functions/src/gamification/services/VaultDispatcher.ts
//
// RESPONSABILIDADE ÚNICA: adaptar GameEventInput → VaultService.
// Sem regras de negócio. Sem acesso ao Firestore.
// ============================================

import { IGameDispatcher, DispatcherMetadata } from '../IGameDispatcher';
import { GameEventInput, DispatcherResult }     from '../GameEventContext';
import { registerDispatcher }                   from '../DispatcherRegistry';
import { VaultService }                         from './VaultService';
import { GameLogger }                           from '../GameLogger';

class VaultDispatcher implements IGameDispatcher {
  getMetadata(): DispatcherMetadata {
    return { name: 'VaultDispatcher', version: 2, type: 'VAULT', timeoutMs: 1000, retryable: false, priority: 'NORMAL' };
  }

  canHandle(input: GameEventInput): boolean {
    return VaultService.getFragments(input.eventType) !== undefined && !!input.targetUid;
  }

  async dispatch(input: GameEventInput): Promise<DispatcherResult> {
    if (!this.canHandle(input)) {
      return { dispatcher: 'VAULT', status: 'SKIPPED', durationMs: 0 };
    }

    const result = await VaultService.process(input.uid, input.targetUid!, input.eventType, input.eventId);

    if (result.skipped) {
      GameLogger.warn({ dispatcher: 'VAULT', eventId: input.eventId, uid: input.uid, message: 'Vault pulado', warning: result.reason ?? '' });
      return { dispatcher: 'VAULT', status: 'SKIPPED', durationMs: 0, warnings: [result.reason ?? ''] };
    }

    GameLogger.info({ dispatcher: 'VAULT', eventId: input.eventId, uid: input.uid, message: 'Fragmentos depositados', meta: { deposited: result.deposited } });
    return { dispatcher: 'VAULT', status: 'SUCCESS', durationMs: 0 };
  }
}

registerDispatcher(new VaultDispatcher());