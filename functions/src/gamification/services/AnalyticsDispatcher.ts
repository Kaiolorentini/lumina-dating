// ============================================
// LUMINA — Analytics DISPATCHER v2.0
// functions/src/gamification/services/AnalyticsDispatcher.ts
//
// RESPONSABILIDADE ÚNICA: adaptar GameEventInput → AnalyticsService.
// TODO Bloco 5: implementar AnalyticsService e AnalyticsRepository.
// ============================================

import { IGameDispatcher, DispatcherMetadata } from '../IGameDispatcher';
import { GameEventInput, DispatcherResult }     from '../GameEventContext';
import { registerDispatcher }                   from '../DispatcherRegistry';

class AnalyticsDispatcherImpl implements IGameDispatcher {
  getMetadata(): DispatcherMetadata {
    return {
      name:      'AnalyticsDispatcher',
      version:   1,
      type:      'ANALYTICS' as any,
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
    // TODO Bloco 5: chamar AnalyticsService
    return {
      dispatcher: 'ANALYTICS' as any,
      status:     'SKIPPED',
      durationMs: 0,
      warnings:   ['AnalyticsService não implementado — Bloco 5'],
    };
  }
}

registerDispatcher(new AnalyticsDispatcherImpl());