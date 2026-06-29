// ============================================
// LUMINA — IDEMPOTENCY MIDDLEWARE v1.0
// functions/src/gamification/middlewares/IdempotencyMiddleware.ts
//
// BLOCO 2 — Núcleo do Engine
// Verifica se o evento já foi processado.
// MELHORIA 8: eventId + eventHash dupla proteção.
// ============================================

import * as admin from 'firebase-admin';
import { GameEventInput } from '../GameEventContext';

const db = admin.firestore();

// Gera hash determinístico a partir do conteúdo do evento
// Protege contra dois clientes gerando IDs diferentes para a mesma ação
export function buildEventHash(input: GameEventInput): string {
  const key = [
    input.uid,
    input.eventType,
    input.targetUid ?? '',
    new Date().toISOString().slice(0, 13), // granularidade: hora
  ].join('|');

  // Hash simples sem dependência externa
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0; // converte para int32
  }
  return Math.abs(hash).toString(36);
}

export interface IdempotencyResult {
  alreadyProcessed: boolean;
  reason?:          'eventId' | 'eventHash';
}

export async function checkIdempotency(
  input:     GameEventInput,
  eventHash: string
): Promise<IdempotencyResult> {
  const [byId, byHash] = await Promise.all([
    db.collection('eventLedger').doc(input.eventId).get(),
    db.collection('eventHashIndex').doc(eventHash).get(),
  ]);

  if (byId.exists)   return { alreadyProcessed: true, reason: 'eventId'   };
  if (byHash.exists) return { alreadyProcessed: true, reason: 'eventHash' };

  return { alreadyProcessed: false };
}

// Reserva o eventHash antes de processar (evita race condition)
export async function reserveEventHash(
  eventId:   string,
  eventHash: string
): Promise<void> {
  await db.collection('eventHashIndex').doc(eventHash).set({
    eventId,
    reservedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}