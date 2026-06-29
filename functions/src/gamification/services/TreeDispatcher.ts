// ============================================
// LUMINA — Tree DISPATCHER v2.0
// functions/src/gamification/services/TreeDispatcher.ts
//
// RESPONSABILIDADE ÚNICA: adaptar GameEventInput → TreeService.
// TODO Bloco 5: implementar TreeService e TreeRepository.
// ============================================

import { IGameDispatcher, DispatcherMetadata } from '../IGameDispatcher';
import { GameEventInput, DispatcherResult }     from '../GameEventContext';
import { registerDispatcher }                   from '../DispatcherRegistry';

class TreeDispatcherImpl implements IGameDispatcher {
  getMetadata(): DispatcherMetadata {
    return {
      name:      'TreeDispatcher',
      version:   1,
      type:      'TREE' as any,
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
    // TODO Bloco 5: chamar TreeService
    return {
      dispatcher: 'TREE' as any,
      status:     'SKIPPED',
      durationMs: 0,
      warnings:   ['TreeService não implementado — Bloco 5'],
    };
  }
}

registerDispatcher(new TreeDispatcherImpl());