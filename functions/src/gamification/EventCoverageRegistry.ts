// ============================================
// LUMINA — EVENT COVERAGE REGISTRY v1.0
// functions/src/gamification/EventCoverageRegistry.ts
//
// BLOCO 5 — Fonte de verdade do status de cada evento.
// Permite auditorias automáticas.
// Atualizar status ao completar cada etapa.
// ============================================

export type CoverageStatus = 'PLANNED' | 'IMPLEMENTING' | 'TESTING' | 'READY';

export interface EventCoverage {
  event:        string;
  status:       CoverageStatus;
  validator:    boolean;
  orchestrator: boolean;
  factory:      boolean;
  service:      boolean;
  repository:   boolean;
  antiFarm:     boolean;
  tests:        boolean;
  deployedAt?:  string;
  notes?:       string;
}

// Registro central — atualizar conforme cada evento é implementado
export const EVENT_COVERAGE_REGISTRY: EventCoverage[] = [
  {
    event: 'PROFILE_VISIT', status: 'READY',
    validator: true, orchestrator: true, factory: true,
    service: false, repository: true, antiFarm: true, tests: false,
    deployedAt: '2026-06', notes: 'Bloco 4 — integração completa',
  },
  {
    event: 'PROFILE_LIKE', status: 'IMPLEMENTING',
    validator: false, orchestrator: false, factory: true,
    service: false, repository: false, antiFarm: true, tests: false,
  },
  {
    event: 'MESSAGE_REPLY', status: 'PLANNED',
    validator: false, orchestrator: false, factory: true,
    service: false, repository: false, antiFarm: true, tests: false,
  },
  {
    event: 'MISSION_COMPLETED', status: 'PLANNED',
    validator: false, orchestrator: false, factory: true,
    service: false, repository: false, antiFarm: true, tests: false,
  },
  {
    event: 'MATCH_CREATED', status: 'PLANNED',
    validator: false, orchestrator: false, factory: true,
    service: false, repository: false, antiFarm: true, tests: false,
  },
  // Reservados — Bloco 6+
  { event: 'PROFILE_FOLLOW',  status: 'PLANNED', validator: false, orchestrator: false, factory: false, service: false, repository: false, antiFarm: false, tests: false },
  { event: 'PROFILE_SHARE',   status: 'PLANNED', validator: false, orchestrator: false, factory: false, service: false, repository: false, antiFarm: false, tests: false },
  { event: 'STORY_VIEW',      status: 'PLANNED', validator: false, orchestrator: false, factory: false, service: false, repository: false, antiFarm: false, tests: false },
  { event: 'GIFT_SENT',       status: 'PLANNED', validator: false, orchestrator: false, factory: false, service: false, repository: false, antiFarm: false, tests: false },
  { event: 'DAILY_LOGIN',     status: 'PLANNED', validator: false, orchestrator: false, factory: false, service: false, repository: false, antiFarm: false, tests: false },
  { event: 'WEEKLY_STREAK',   status: 'PLANNED', validator: false, orchestrator: false, factory: false, service: false, repository: false, antiFarm: false, tests: false },
];

// Helper: retorna cobertura de um evento
export function getCoverage(event: string): EventCoverage | undefined {
  return EVENT_COVERAGE_REGISTRY.find(e => e.event === event);
}

// Helper: retorna eventos prontos
export function getReadyEvents(): EventCoverage[] {
  return EVENT_COVERAGE_REGISTRY.filter(e => e.status === 'READY');
}

// Helper: retorna eventos com cobertura incompleta
export function getIncompleteEvents(): EventCoverage[] {
  return EVENT_COVERAGE_REGISTRY.filter(e =>
    e.status !== 'PLANNED' &&
    (!e.validator || !e.orchestrator || !e.factory || !e.antiFarm)
  );
}
