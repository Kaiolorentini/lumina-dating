// ============================================
// LUMINA — EVENT DISPATCHER v1.2
// functions/src/gamification/EventDispatcher.ts
//
// v1.2: usa IGameDispatcher.dispatch() e getMetadata().timeoutMs
// ============================================

import { DispatcherType } from './GameEventTypes';
import { GameEventInput, DispatcherResult } from './GameEventContext';
import { getDispatchersForEvent }            from './EventMatrix';
import { isDispatcherEnabled }               from './FeatureFlags';
import { getDispatcher }                     from './DispatcherRegistry';
import { Logger }                            from './middlewares/LoggingMiddleware';
import { EventLifecycle }                    from './EventLifecycle';

const DEFAULT_TIMEOUT_MS = 2000;

async function withTimeout<T>(
  promise: Promise<T>,
  ms:      number,
  label:   string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout após ${ms}ms em ${label}`)), ms)
  );
  return Promise.race([promise, timeout]);
}

async function runDispatcher(
  type:  DispatcherType,
  input: GameEventInput
): Promise<DispatcherResult> {
  const startMs = Date.now();

  if (!isDispatcherEnabled(type)) {
    return { dispatcher: type, status: 'DISABLED', durationMs: 0 };
  }

  const dispatcher = getDispatcher(type);
  if (!dispatcher) {
    return {
      dispatcher: type,
      status:     'SKIPPED',
      durationMs: 0,
      warnings:   [`${type} não registrado — implementar no Bloco 5`],
    };
  }

  // Usa timeout configurado no metadata do dispatcher (MELHORIA 9)
  const timeoutMs = dispatcher.getMetadata().timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Verifica se o dispatcher pode processar este evento
  if (!dispatcher.canHandle(input)) {
    return {
      dispatcher: type,
      status:     'SKIPPED',
      durationMs: 0,
      warnings:   [`${type}.canHandle() retornou false para ${input.eventType}`],
    };
  }

  try {
    // REGRA: usa dispatch() — interface IGameDispatcher
    const result = await withTimeout(
      dispatcher.dispatch(input),
      timeoutMs,
      type
    );
    return { ...result, durationMs: Date.now() - startMs };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    Logger.error({
      eventId:    input.eventId,
      eventType:  input.eventType,
      uid:        input.uid,
      lifecycle:  'FAILED' as EventLifecycle,
      message:    `Dispatcher ${type} falhou`,
      error:      msg,
      durationMs: Date.now() - startMs,
    });
    return {
      dispatcher: type,
      status:     'FAILED',
      durationMs: Date.now() - startMs,
      errors:     [msg],
    };
  }
}

export interface DispatchResult {
  results:  DispatcherResult[];
  executed: DispatcherType[];
  skipped:  DispatcherType[];
  errors:   string[];
}

export async function dispatch(input: GameEventInput): Promise<DispatchResult> {
  const dispatchers = getDispatchersForEvent(input.eventType);
  const results:  DispatcherResult[] = [];
  const executed: DispatcherType[]   = [];
  const skipped:  DispatcherType[]   = [];
  const errors:   string[]           = [];

  for (const type of dispatchers) {
    const result = await runDispatcher(type, input);
    results.push(result);

    switch (result.status) {
      case 'SUCCESS':
        executed.push(type);
        break;
      case 'SKIPPED':
      case 'DISABLED':
        skipped.push(type);
        break;
      case 'FAILED':
        errors.push(`${type}: ${result.errors?.join(', ') ?? 'erro desconhecido'}`);
        break;
    }
  }

  return { results, executed, skipped, errors };
}