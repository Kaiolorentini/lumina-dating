// ============================================
// LUMINA — GAMIFICATION HEALTH SERVICE v1.0
// functions/src/gamification/health/GamificationHealthService.ts
//
// SPRINT 0 — Mede saúde do sistema completo:
// Engine → Dispatchers → Repositories → Firestore → Feature Flags
// Retorna: OK / WARNING / CRITICAL
// ============================================

import * as admin from 'firebase-admin';
import { getRegisteredTypes } from '../DispatcherRegistry';
import { GAMIFICATION_ENGINE_ENABLED }       from '../FeatureFlags';

const db = admin.firestore();

export type HealthStatus = 'OK' | 'WARNING' | 'CRITICAL';

export interface ComponentHealth {
  name:    string;
  status:  HealthStatus;
  details?: string;
  latencyMs?: number;
}

export interface HealthReport {
  status:     HealthStatus;
  timestamp:  string;
  components: ComponentHealth[];
}

// Verifica conectividade básica com Firestore
async function checkFirestore(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    await db.collection('_health').doc('ping').set({ ts: Date.now() }, { merge: true });
    const latencyMs = Date.now() - start;
    return {
      name: 'Firestore',
      status: latencyMs > 1000 ? 'WARNING' : 'OK',
      latencyMs,
    };
  } catch (error) {
    return { name: 'Firestore', status: 'CRITICAL', details: String(error) };
  }
}

// Verifica se o Engine está habilitado
function checkEngineFlag(): ComponentHealth {
  return {
    name:   'GamificationEngine Flag',
    status: GAMIFICATION_ENGINE_ENABLED ? 'OK' : 'CRITICAL',
    details: GAMIFICATION_ENGINE_ENABLED ? undefined : 'Engine desabilitado globalmente',
  };
}

// Verifica quantos Dispatchers estão registrados vs esperados
function checkDispatchers(): ComponentHealth {
  const expected = 9; // XP, Vault, Mission, Achievement, Ranking, Tree, Prestige, Notification, Analytics
  const registered = getRegisteredTypes();
  const missing = expected - registered.length;

  if (missing === 0) {
    return { name: 'Dispatchers', status: 'OK', details: `${registered.length}/${expected} registrados` };
  }
  if (missing <= 3) {
    return { name: 'Dispatchers', status: 'WARNING', details: `${registered.length}/${expected} registrados — ${missing} stub(s)` };
  }
  return { name: 'Dispatchers', status: 'CRITICAL', details: `${registered.length}/${expected} registrados — ${missing} ausentes` };
}

// Verifica taxa de erro recente no EventLedger (últimos 5 min)
async function checkRecentErrorRate(): Promise<ComponentHealth> {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const snap = await db.collection('eventLedger')
      .where('processedAt', '>=', fiveMinAgo)
      .limit(200)
      .get();

    if (snap.empty) {
      return { name: 'Error Rate (5min)', status: 'OK', details: 'Sem eventos recentes' };
    }

    const total  = snap.size;
    const failed = snap.docs.filter(d => d.data().status === 'FAILED').length;
    const rate   = failed / total;

    if (rate < 0.01) return { name: 'Error Rate (5min)', status: 'OK', details: `${(rate * 100).toFixed(2)}%` };
    if (rate < 0.05) return { name: 'Error Rate (5min)', status: 'WARNING', details: `${(rate * 100).toFixed(2)}%` };
    return { name: 'Error Rate (5min)', status: 'CRITICAL', details: `${(rate * 100).toFixed(2)}%` };
  } catch (error) {
    return { name: 'Error Rate (5min)', status: 'WARNING', details: 'Não foi possível calcular' };
  }
}

// Verifica Dead Letter Queue
async function checkDeadLetterQueue(): Promise<ComponentHealth> {
  try {
    const snap = await db.collection('eventDeadLetterQueue').limit(50).get();
    const count = snap.size;

    if (count === 0)  return { name: 'Dead Letter Queue', status: 'OK', details: '0 itens' };
    if (count < 10)   return { name: 'Dead Letter Queue', status: 'WARNING', details: `${count} itens` };
    return { name: 'Dead Letter Queue', status: 'CRITICAL', details: `${count}+ itens` };
  } catch {
    return { name: 'Dead Letter Queue', status: 'WARNING', details: 'Collection não encontrada' };
  }
}

function aggregateStatus(components: ComponentHealth[]): HealthStatus {
  if (components.some(c => c.status === 'CRITICAL')) return 'CRITICAL';
  if (components.some(c => c.status === 'WARNING'))  return 'WARNING';
  return 'OK';
}

export const GamificationHealthService = {
  async checkHealth(): Promise<HealthReport> {
    const components = await Promise.all([
      checkFirestore(),
      Promise.resolve(checkEngineFlag()),
      Promise.resolve(checkDispatchers()),
      checkRecentErrorRate(),
      checkDeadLetterQueue(),
    ]);

    return {
      status:     aggregateStatus(components),
      timestamp:  new Date().toISOString(),
      components,
    };
  },
};