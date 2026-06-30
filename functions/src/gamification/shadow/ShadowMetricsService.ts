// ============================================
// LUMINA — SHADOW METRICS SERVICE v2.0
// functions/src/gamification/shadow/ShadowMetricsService.ts
//
// SPRINT 1C — v2.0: exibe 5 estados possíveis:
// ACTIVE, INHERITED, NOT_SUPPORTED, NO_DATA, ERROR.
// Tree = INHERITED. Prestige = NOT_SUPPORTED.
// ============================================

import * as admin from 'firebase-admin';
import { ShadowStatus, ShadowSystem } from './ShadowStatus';

const db = admin.firestore();

export type SystemCoverageStatus =
  | 'ACTIVE'        // Shadow rodando com comparação real (XP, Ranking, Achievement)
  | 'INHERITED'     // Coberto indiretamente por outro sistema (Tree via XP)
  | 'NOT_SUPPORTED' // Modelo incompatível nesta Sprint (Prestige)
  | 'NO_DATA'       // Shadow ativo mas sem comparações ainda
  | 'ERROR';        // Falha ao obter métricas

export interface ShadowScore {
  system:           ShadowSystem;
  coverageStatus:   SystemCoverageStatus;
  scorePercent:     number;
  totalComparisons: number;
  matched:          number;
  different:        number;
  errors:           number;
  criticalCount:    number;
  note?:            string;
}

// Sistemas com Shadow real ativo
const ACTIVE_SYSTEMS: ShadowSystem[]       = ['XP', 'RANKING', 'ACHIEVEMENT'];
// Sistemas com cobertura indireta
const INHERITED_SYSTEMS: ShadowSystem[]    = ['TREE'];
// Sistemas fora do escopo desta Sprint
const NOT_SUPPORTED_SYSTEMS: ShadowSystem[] = ['PRESTIGE'];

async function getActiveScore(system: ShadowSystem, hoursWindow: number): Promise<ShadowScore> {
  try {
    const since = new Date(Date.now() - hoursWindow * 3600_000);
    const snap  = await db.collection('shadowComparisons')
      .where('system', '==', system)
      .where('timestamp', '>=', since)
      .limit(5000)
      .get();

    if (snap.empty) {
      return {
        system, coverageStatus: 'NO_DATA', scorePercent: 100,
        totalComparisons: 0, matched: 0, different: 0, errors: 0, criticalCount: 0,
        note: 'Shadow ativo mas sem comparações ainda — aguardando eventos reais',
      };
    }

    const docs      = snap.docs.map(d => d.data());
    const total     = docs.length;
    const matched   = docs.filter(d => d.status === ShadowStatus.MATCH).length;
    const different = docs.filter(d => d.status === ShadowStatus.DIFFERENT).length;
    const errors    = docs.filter(d => d.status === ShadowStatus.ERROR).length;
    const critical  = docs.filter(d => d.severity === 'CRITICAL').length;

    return {
      system,
      coverageStatus:   'ACTIVE',
      totalComparisons: total,
      matched,
      different,
      errors,
      criticalCount:    critical,
      scorePercent:     (matched / total) * 100,
    };
  } catch {
    return {
      system, coverageStatus: 'ERROR', scorePercent: 0,
      totalComparisons: 0, matched: 0, different: 0, errors: 0, criticalCount: 999,
    };
  }
}

export const ShadowMetricsService = {

  async getScore(system: ShadowSystem, hoursWindow = 72): Promise<ShadowScore> {
    if (INHERITED_SYSTEMS.includes(system)) {
      return {
        system, coverageStatus: 'INHERITED', scorePercent: 100,
        totalComparisons: 0, matched: 0, different: 0, errors: 0, criticalCount: 0,
        note: 'Coberto indiretamente pelo XPCompatibilityAdapter — sem comparação direta necessária',
      };
    }

    if (NOT_SUPPORTED_SYSTEMS.includes(system)) {
      return {
        system, coverageStatus: 'NOT_SUPPORTED', scorePercent: 100,
        totalComparisons: 0, matched: 0, different: 0, errors: 0, criticalCount: 0,
        note: 'Modelo legado baseado em marcos — incompatível com GameEventType nesta Sprint',
      };
    }

    if (ACTIVE_SYSTEMS.includes(system)) {
      return getActiveScore(system, hoursWindow);
    }

    return {
      system, coverageStatus: 'NOT_SUPPORTED', scorePercent: 100,
      totalComparisons: 0, matched: 0, different: 0, errors: 0, criticalCount: 0,
    };
  },

  async getAllScores(hoursWindow = 72): Promise<ShadowScore[]> {
    const systems: ShadowSystem[] = ['XP', 'RANKING', 'ACHIEVEMENT', 'VAULT', 'TREE', 'PRESTIGE'];
    return Promise.all(systems.map(s => this.getScore(s, hoursWindow)));
  },

  // Verifica se os critérios de promoção para ENGINE estão atingidos
  async isReadyForEngine(system: ShadowSystem, hoursWindow = 72): Promise<boolean> {
    if (!ACTIVE_SYSTEMS.includes(system)) return false;
    const score = await this.getScore(system, hoursWindow);
    return (
      score.coverageStatus === 'ACTIVE' &&
      score.criticalCount  === 0 &&
      score.scorePercent   >= 99.99 &&
      score.totalComparisons > 0
    );
  },
};