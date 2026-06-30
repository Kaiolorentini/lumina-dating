// ============================================
// LUMINA — COMPARATOR REGISTRY v1.0
// functions/src/gamification/shadow/ComparatorRegistry.ts
//
// SPRINT 1C — Registry central de comparadores.
// ============================================

import { IShadowComparator } from './IShadowComparator';
import { ShadowSystem }      from './ShadowStatus';

const registry = new Map<ShadowSystem, IShadowComparator>();

export function registerComparator(system: ShadowSystem, comparator: IShadowComparator): void {
  if (registry.has(system)) {
    throw new Error(`Comparator para ${system} já registrado.`);
  }
  registry.set(system, comparator);
}

export function getComparator(system: ShadowSystem): IShadowComparator | undefined {
  return registry.get(system);
}