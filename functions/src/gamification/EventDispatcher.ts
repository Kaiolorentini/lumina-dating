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

// withTimeout REMOVIDO.
//
// Promise.race NÃO CANCELA a promise perdedora: a transação do
// Firestore continuava rodando e COMPLETAVA o trabalho depois
// do timeout. No log via-se "Dispatcher XP falhou — Timeout
// após 8000ms" e, segundos depois, "XP concedido (modo
// ENGINE)". O timeout só corrompia o status e as métricas:
// `executed` saía vazio e o evento ia para o ledger como
// FAILED mesmo tendo dado certo.
//
// Pior, ele CAUSAVA o problema que parecia medir. Ao desistir
// de esperar, o dispatcher seguinte começava com o anterior
// ainda em transação, e os dois disputavam o mesmo documento
// `users/{uid}` — XPService e RankingService escrevem nele.
// O Firestore serializa e repete a transação perdedora, e cada
// repetição somava segundos. Sem o timeout os dispatchers
// rodam de fato em sequência e não há disputa.
//
// O limite real continua sendo o timeout da própria Cloud
// Function, hoje 60s.

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
    // FAILED, não SKIPPED: dispatcher ausente é erro de
    // configuração, não caso normal. Como SKIPPED, ele não
    // entrava em `errors` e o evento voltava COMPLETED — o
    // Engine parecia funcionar enquanto não concedia nada.
    //
    // Os nove dispatchers existem e chamam registerDispatcher()
    // no carregamento do módulo, mas NENHUM arquivo os importa,
    // então o registry fica vazio. Ver LEIA-ME.md nesta pasta.
    Logger.error({
      eventId:    input.eventId,
      eventType:  input.eventType,
      uid:        input.uid,
      lifecycle:  'FAILED' as EventLifecycle,
      message:    `Dispatcher ${type} NÃO REGISTRADO — o módulo não foi importado`,
      error:      'DISPATCHER_NOT_REGISTERED',
      durationMs: 0,
    });
    return {
      dispatcher: type,
      status:     'FAILED',
      durationMs: 0,
      errors:     [`${type} não registrado — o módulo não foi importado (ver LEIA-ME.md)`],
    };
  }

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
    const result = await dispatcher.dispatch(input);
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