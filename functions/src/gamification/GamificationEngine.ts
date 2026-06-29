// ============================================
// LUMINA — GAMIFICATION ENGINE v1.1
// functions/src/gamification/GamificationEngine.ts
//
// BLOCO 2 — Núcleo do Engine
// CF principal — ponto de entrada único.
// Responsabilidades: receber → middleware pipeline
//   → dispatch → ledger. Zero lógica de negócio.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import { GameEventInput, GameEventResult, createEventResult } from './GameEventContext';
import { getPolicyForEvent }            from './EventPolicies';
import { validate }                     from './middlewares/ValidationMiddleware';
import { checkIdempotency, buildEventHash, reserveEventHash } from './middlewares/IdempotencyMiddleware';
import { evaluateRisk }                 from './middlewares/RiskMiddleware';
import { checkFeatureFlags }            from './middlewares/FeatureFlagMiddleware';
import { Logger }                       from './middlewares/LoggingMiddleware';
import { dispatch }                     from './EventDispatcher';
import { writeLedger }                  from './EventLedger';

// ── CF principal ──
export const processGameEvent = functions.onCall(
  { region: 'us-central1' },
  async (request): Promise<GameEventResult> => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const input = request.data as GameEventInput;

    // uid do token deve bater com o do evento
    if (input.uid !== uid) {
      throw new functions.HttpsError('permission-denied', 'uid não corresponde ao token.');
    }

    const startMs    = Date.now();
    const policy     = getPolicyForEvent(input.eventType);
    const result     = createEventResult(input, policy.priority);
    const eventHash  = buildEventHash(input);

    Logger.info({
      eventId:   input.eventId,
      eventType: input.eventType,
      uid,
      lifecycle: 'RECEIVED',
      message:   'Evento recebido',
      meta:      { source: input.source, origin: input.origin },
    });

    // ── MIDDLEWARE 1: Feature Flags ──
    const flagResult = checkFeatureFlags(input.eventType);
    if (!flagResult.allowed) {
      result.status   = 'FAILED';
      result.errors   = [flagResult.reason ?? 'Feature desabilitada'];
      result.totalDurationMs = Date.now() - startMs;
      // Não grava no Ledger — evento inválido não polui (MELHORIA 1)
      return result;
    }

    // ── MIDDLEWARE 2: Validation ──
    const validation = validate(input);
    if (!validation.valid) {
      result.status   = 'FAILED';
      result.errors   = validation.errors;
      result.totalDurationMs = Date.now() - startMs;
      // Não grava no Ledger — evento inválido não polui (MELHORIA 1)
      return result;
    }

    Logger.info({
      eventId:   input.eventId,
      eventType: input.eventType,
      uid,
      lifecycle: 'VALIDATED',
      message:   'Evento validado',
    });

    // ── MIDDLEWARE 3: Idempotência ──
    const idempotency = await checkIdempotency(input, eventHash);
    if (idempotency.alreadyProcessed) {
      result.status   = 'COMPLETED';
      result.warnings = [`Evento já processado via ${idempotency.reason}`];
      result.totalDurationMs = Date.now() - startMs;
      return result;
    }

    // Reserva eventHash para evitar race condition
    await reserveEventHash(input.eventId, eventHash);

    // ── MIDDLEWARE 4: Risk ──
    const riskResult = await evaluateRisk(uid);
    if (riskResult.decision === 'BLOCK') {
      result.status   = 'FAILED';
      result.errors   = [riskResult.reason ?? 'Evento bloqueado por risco'];
      result.totalDurationMs = Date.now() - startMs;
      await writeLedger(result, input, 'FAILED', eventHash);
      return result;
    }

    if (riskResult.decision === 'LIMIT') {
      result.warnings.push(riskResult.reason ?? 'Recompensas limitadas por risco');
    }

    // ── DISPATCH ──
    result.status = 'PROCESSING';

    const dispatchResult = await dispatch(input);

    result.dispatcherResults   = dispatchResult.results;
    result.dispatchersExecuted = dispatchResult.executed;
    result.dispatchersSkipped  = dispatchResult.skipped;
    result.errors.push(...dispatchResult.errors);
    result.totalDurationMs     = Date.now() - startMs;
    result.status              = dispatchResult.errors.length > 0 ? 'FAILED' : 'COMPLETED';

    // ── EVENT LEDGER — só grava após pipeline completo ──
    await writeLedger(result, input, result.status as any, eventHash);

    Logger.result(result);

    return result;
  }
);