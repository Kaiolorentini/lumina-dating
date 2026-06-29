// ============================================
// LUMINA — RISK MIDDLEWARE v1.0
// functions/src/gamification/middlewares/RiskMiddleware.ts
//
// BLOCO 2 — Núcleo do Engine
// Avalia o risco do usuário antes de processar.
// MELHORIA 7: RiskDecision ALLOW / LIMIT / BLOCK
// ============================================

import * as admin from 'firebase-admin';
import { RiskDecision } from '../EventLifecycle';

const db = admin.firestore();

const RISK_LIMIT_THRESHOLD = 50;  // acima disso: LIMIT (recompensas reduzidas)
const RISK_BLOCK_THRESHOLD = 100; // acima disso: BLOCK (ignora evento)

export interface RiskResult {
  decision:  RiskDecision;
  riskScore: number;
  reason?:   string;
}

export async function evaluateRisk(uid: string): Promise<RiskResult> {
  const userDoc   = await db.collection('users').doc(uid).get();
  const riskScore = userDoc.data()?.xp?.xpRiskScore ?? 0;

  if (riskScore >= RISK_BLOCK_THRESHOLD) {
    return {
      decision:  'BLOCK',
      riskScore,
      reason:    `riskScore ${riskScore} acima do limite de bloqueio (${RISK_BLOCK_THRESHOLD})`,
    };
  }

  if (riskScore >= RISK_LIMIT_THRESHOLD) {
    return {
      decision:  'LIMIT',
      riskScore,
      reason:    `riskScore ${riskScore} acima do limite de restrição (${RISK_LIMIT_THRESHOLD})`,
    };
  }

  return { decision: 'ALLOW', riskScore };
}