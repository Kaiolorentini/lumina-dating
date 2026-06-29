
// ============================================
// LUMINA — Notification DISPATCHER v2.0
// functions/src/gamification/services/NotificationDispatcher.ts
//
// RESPONSABILIDADE ÚNICA: adaptar GameEventInput → NotificationService.
// TODO Bloco 5: implementar NotificationService e NotificationRepository.
// ============================================

import { IGameDispatcher, DispatcherMetadata } from '../IGameDispatcher';
import { GameEventInput, DispatcherResult }     from '../GameEventContext';
import { registerDispatcher }                   from '../DispatcherRegistry';

class NotificationDispatcherImpl implements IGameDispatcher {
  getMetadata(): DispatcherMetadata {
    return {
      name:      'NotificationDispatcher',
      version:   1,
      type:      'NOTIFICATION' as any,
      timeoutMs: 2000,
      retryable: true,
      priority:  'NORMAL',
    };
  }

  canHandle(_input: GameEventInput): boolean {
    // TODO Bloco 5: implementar canHandle
    return true;
  }

  async dispatch(_input: GameEventInput): Promise<DispatcherResult> {
    // TODO Bloco 5: chamar NotificationService
    return {
      dispatcher: 'NOTIFICATION' as any,
      status:     'SKIPPED',
      durationMs: 0,
      warnings:   ['NotificationService não implementado — Bloco 5'],
    };
  }
}

registerDispatcher(new NotificationDispatcherImpl());