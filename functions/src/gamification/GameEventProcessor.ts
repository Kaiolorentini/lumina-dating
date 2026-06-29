// ============================================
// LUMINA — GAME EVENT PROCESSOR v1.0
// functions/src/gamification/GameEventProcessor.ts
//
// BLOCO 4 — Regra 3: classe que encapsula processGameEventInternal.
// Facilita adicionar: métricas, cache, fila, retries, circuit breaker.
// ============================================

import { GameEventInput, GameEventResult, createEventResult } from './GameEventContext';
import { getPolicyForEvent }       from './EventPolicies';
import { validate }                from './middlewares/ValidationMiddleware';
import { checkIdempotency, buildEventHash, reserveEventHash } from './middlewares/IdempotencyMiddleware';
import { evaluateRisk }            from './middlewares/RiskMiddleware';
import { checkFeatureFlags }       from './middlewares/FeatureFlagMiddleware';
import { Logger }                  from './middlewares/LoggingMiddleware';
import { dispatch }                from './EventDispatcher';
import { writeLedger, LedgerOptions } from './EventLedger';
import { GamificationError }          from './ErrorBoundary';

export interface ProcessorOptions extends LedgerOptions {
  correlationId: string;
  originCF:      string;
  triggerName:   string;
  executionId?:  string;
}

export class GameEventProcessor {
  private readonly options: ProcessorOptions;

  constructor(options: ProcessorOptions) {
    this.options = options;
  }

  async process(input: GameEventInput): Promise<GameEventResult> {
    const startMs   = Date.now();
    const policy    = getPolicyForEvent(input.eventType);
    const result    = createEventResult(input, policy.priority);
    const eventHash = buildEventHash(input);

    Logger.info({
      eventId:   input.eventId,
      eventType: input.eventType,
      uid:       input.uid,
      lifecycle: 'RECEIVED',
      message:   'Evento recebido',
      meta:      { correlationId: this.options.correlationId, originCF: this.options.originCF },
    });

    // Middleware 1: Feature Flags
    const flagResult = checkFeatureFlags(input.eventType);
    if (!flagResult.allowed) {
      result.status        = 'FAILED';
      result.errors        = [flagResult.reason ?? 'Feature desabilitada'];
      result.totalDurationMs = Date.now() - startMs;
      return result;
    }

    // Middleware 2: Validation
    const validation = validate(input);
    if (!validation.valid) {
      result.status        = 'FAILED';
      result.errors        = validation.errors;
      result.totalDurationMs = Date.now() - startMs;
      return result;
    }

    Logger.info({ eventId: input.eventId, eventType: input.eventType, uid: input.uid, lifecycle: 'VALIDATED', message: 'Validado' });

    // Middleware 3: Idempotência
    const idempotency = await checkIdempotency(input, eventHash);
    if (idempotency.alreadyProcessed) {
      result.status        = 'COMPLETED';
      result.warnings      = [`Duplicado via ${idempotency.reason}`];
      result.totalDurationMs = Date.now() - startMs;
      return result;
    }

    await reserveEventHash(input.eventId, eventHash);

    // Middleware 4: Risk
    const riskResult = await evaluateRisk(input.uid);
    if (riskResult.decision === 'BLOCK') {
      result.status        = 'FAILED';
      result.errors        = [riskResult.reason ?? 'Bloqueado por risco'];
      result.totalDurationMs = Date.now() - startMs;
      await writeLedger(result, input, 'FAILED', eventHash, this.options).catch(() => {});
      return result;
    }

    if (riskResult.decision === 'LIMIT') {
      result.warnings.push(riskResult.reason ?? 'Recompensas limitadas');
    }

    // Dispatch
    result.status = 'PROCESSING';
    const dispatchResult   = await dispatch(input);
    result.dispatcherResults   = dispatchResult.results;
    result.dispatchersExecuted = dispatchResult.executed;
    result.dispatchersSkipped  = dispatchResult.skipped;
    result.errors.push(...dispatchResult.errors);
    result.totalDurationMs     = Date.now() - startMs;
    result.status              = dispatchResult.errors.length > 0 ? 'FAILED' : 'COMPLETED';

    // Event Ledger — só após pipeline completo
    await writeLedger(result, input, result.status as any, eventHash, this.options)
      .catch(err => { throw new GamificationError('LEDGER_WRITE_FAILED', String(err)); });

    Logger.result(result);
    return result;
  }
}