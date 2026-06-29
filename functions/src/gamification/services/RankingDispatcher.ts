// ============================================
// LUMINA — Ranking DISPATCHER v2.0
// functions/src/gamification/services/RankingDispatcher.ts
//
// RESPONSABILIDADE ÚNICA: adaptar GameEventInput → RankingService.
// TODO Bloco 5: implementar RankingService e RankingRepository.
// ============================================

import { IGameDispatcher, DispatcherMetadata } from '../IGameDispatcher';
import { GameEventInput, DispatcherResult }     from '../GameEventContext';
import { registerDispatcher }                   from '../DispatcherRegistry';

class RankingDispatcherImpl implements IGameDispatcher {
  getMetadata(): DispatcherMetadata {
    return {
      name:      'RankingDispatcher',
      version:   1,
      type:      'RANKING' as any,
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
    // TODO Bloco 5: chamar RankingService
    return {
      dispatcher: 'RANKING' as any,
      status:     'SKIPPED',
      durationMs: 0,
      warnings:   ['RankingService não implementado — Bloco 5'],
    };
  }
}

registerDispatcher(new RankingDispatcherImpl());