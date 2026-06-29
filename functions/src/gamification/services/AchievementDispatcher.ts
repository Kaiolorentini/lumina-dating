// ============================================
// LUMINA — Achievement DISPATCHER v2.0
// functions/src/gamification/services/AchievementDispatcher.ts
//
// RESPONSABILIDADE ÚNICA: adaptar GameEventInput → AchievementService.
// TODO Bloco 5: implementar AchievementService e AchievementRepository.
// ============================================

import { IGameDispatcher, DispatcherMetadata } from '../IGameDispatcher';
import { GameEventInput, DispatcherResult }     from '../GameEventContext';
import { registerDispatcher }                   from '../DispatcherRegistry';

class AchievementDispatcherImpl implements IGameDispatcher {
  getMetadata(): DispatcherMetadata {
    return {
      name:      'AchievementDispatcher',
      version:   1,
      type:      'ACHIEVEMENT' as any,
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
    // TODO Bloco 5: chamar AchievementService
    return {
      dispatcher: 'ACHIEVEMENT' as any,
      status:     'SKIPPED',
      durationMs: 0,
      warnings:   ['AchievementService não implementado — Bloco 5'],
    };
  }
}

registerDispatcher(new AchievementDispatcherImpl());