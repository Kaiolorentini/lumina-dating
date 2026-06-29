// ============================================
// LUMINA — EVENT LEDGER v1.1
// functions/src/gamification/EventLedger.ts
//
// BLOCO 4 — v1.1: options opcional adicionado.
// Inclui correlationId, originCF, triggerName, executionId.
// ============================================

import * as admin      from 'firebase-admin';
import { FieldValue }  from 'firebase-admin/firestore';
import { GameEventInput, GameEventResult } from './GameEventContext';
import { EventLifecycle }                  from './EventLifecycle';
import { GAME_EVENT_VERSION }              from './GameEventTypes';

const db = admin.firestore();

export interface LedgerOptions {
  correlationId?: string;
  originCF?:      string;
  triggerName?:   string;
  executionId?:   string;
}

export async function writeLedger(
  result:    GameEventResult,
  input:     GameEventInput,
  lifecycle: EventLifecycle,
  eventHash: string,
  options?:  LedgerOptions        // ← opcional para compatibilidade retroativa
): Promise<void> {
  await db.collection('eventLedger').doc(result.eventId).set({
    eventId:             result.eventId,
    eventHash,
    eventType:           result.eventType,
    uid:                 result.uid,
    targetUid:           input.targetUid ?? null,

    // Rastreabilidade
    correlationId:       options?.correlationId ?? null,
    originCF:            options?.originCF      ?? null,
    triggerName:         options?.triggerName   ?? null,
    executionId:         options?.executionId   ?? null,

    lifecycle,
    status:              result.status,
    priority:            result.priority,
    eventVersion:        GAME_EVENT_VERSION,
    schemaVersion:       result.schemaVersion,
    source:              result.source,
    origin:              result.origin,
    requestId:           input.requestId  ?? null,
    sessionId:           input.sessionId  ?? null,
    deviceId:            input.deviceId   ?? null,
    appVersion:          input.appVersion ?? null,
    platform:            input.platform   ?? null,
    locale:              input.locale     ?? null,
    dispatchersExecuted: result.dispatchersExecuted,
    dispatchersSkipped:  result.dispatchersSkipped,
    totalDurationMs:     result.totalDurationMs,
    retryCount:          result.retryCount,
    errors:              result.errors,
    warnings:            result.warnings,
    processedAt:         FieldValue.serverTimestamp(),
    imutavel:            true,
  });
}