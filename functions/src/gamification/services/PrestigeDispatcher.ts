// ============================================
// LUMINA — Prestige DISPATCHER v2.0
// functions/src/gamification/services/PrestigeDispatcher.ts
//
// RESPONSABILIDADE ÚNICA: adaptar GameEventInput → PrestigeService.
// TODO Bloco 5: implementar PrestigeService e PrestigeRepository.
// ============================================

import { IGameDispatcher, DispatcherMetadata } from '../IGameDispatcher';
import { GameEventInput, DispatcherResult }     from '../GameEventContext';
import { registerDispatcher }                   from '../DispatcherRegistry';

class PrestigeDispatcherImpl implements IGameDispatcher {
  getMetadata(): DispatcherMetadata {
    return {
      name:      'PrestigeDispatcher',
      version:   1,
      type:      'PRESTIGE' as any,
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
    // TODO Bloco 5: chamar PrestigeService
    return {
      dispatcher: 'PRESTIGE' as any,
      status:     'SKIPPED',
      durationMs: 0,
      warnings:   ['PrestigeService não implementado — Bloco 5'],
    };
  }
}

registerDispatcher(new PrestigeDispatcherImpl());