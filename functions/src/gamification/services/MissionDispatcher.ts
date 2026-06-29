// ============================================
// LUMINA — Mission DISPATCHER v2.0
// functions/src/gamification/services/MissionDispatcher.ts
//
// RESPONSABILIDADE ÚNICA: adaptar GameEventInput → MissionService.
// TODO Bloco 5: implementar MissionService e MissionRepository.
// ============================================

import { IGameDispatcher, DispatcherMetadata } from '../IGameDispatcher';
import { GameEventInput, DispatcherResult }     from '../GameEventContext';
import { registerDispatcher }                   from '../DispatcherRegistry';

class MissionDispatcherImpl implements IGameDispatcher {
  getMetadata(): DispatcherMetadata {
    return {
      name:      'MissionDispatcher',
      version:   1,
      type:      'MISSION' as any,
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
    // TODO Bloco 5: chamar MissionService
    return {
      dispatcher: 'MISSION' as any,
      status:     'SKIPPED',
      durationMs: 0,
      warnings:   ['MissionService não implementado — Bloco 5'],
    };
  }
}

registerDispatcher(new MissionDispatcherImpl());