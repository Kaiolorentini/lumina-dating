// ============================================
// LUMINA — XP DISPATCHER v5.0
// functions/src/gamification/services/XPDispatcher.ts
//
// SPRINT 1C — v5.0: simplificado. A comparação Shadow agora
// é responsabilidade exclusiva dos Compatibility Adapters
// (que usam Calculators puros, fora do pipeline do Engine).
// O Dispatcher só persiste em modo ENGINE — nunca em SHADOW/LEGACY.
// ============================================

import { IGameDispatcher, DispatcherMetadata } from '../IGameDispatcher';
import { GameEventInput, DispatcherResult }     from '../GameEventContext';
import { registerDispatcher }                   from '../DispatcherRegistry';
import { XPService }                            from './XPService';
import { getDispatcherMode }                    from '../featureflags/DispatcherMode';
import { GameLogger }                           from '../GameLogger';

class XPDispatcher implements IGameDispatcher {
  getMetadata(): DispatcherMetadata {
    return { name: 'XPDispatcher', version: 5, type: 'XP', timeoutMs: 1000, retryable: false, priority: 'NORMAL' };
  }

  canHandle(input: GameEventInput): boolean {
    return XPService.getActionKey(input.eventType) !== undefined;
  }

  async dispatch(input: GameEventInput): Promise<DispatcherResult> {
    if (!this.canHandle(input)) {
      return { dispatcher: 'XP', status: 'SKIPPED', durationMs: 0, warnings: [`Sem ação XP para ${input.eventType}`] };
    }

    const mode = await getDispatcherMode('XP');

    // LEGACY e SHADOW: nunca persiste. Comparação Shadow é feita
    // separadamente pelo XPCompatibilityAdapter via LegacyShadowOrchestrator.
    if (mode !== 'ENGINE') {
      return { dispatcher: 'XP', status: 'SKIPPED', durationMs: 0, warnings: [`Modo ${mode} — XPDispatcher não persiste`] };
    }

    const result = await XPService.process(input.uid, input.eventId, input.eventType);

    if (result.skipped) {
      GameLogger.warn({ dispatcher: 'XP', eventId: input.eventId, uid: input.uid, message: 'XP pulado', warning: result.reason ?? '' });
      return { dispatcher: 'XP', status: 'SKIPPED', durationMs: 0, warnings: [result.reason ?? ''] };
    }

    GameLogger.info({ dispatcher: 'XP', eventId: input.eventId, uid: input.uid, message: 'XP concedido (modo ENGINE)', meta: { xpGained: result.xpGained } });
    return { dispatcher: 'XP', status: 'SUCCESS', durationMs: 0 };
  }
}

registerDispatcher(new XPDispatcher());