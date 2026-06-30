// ============================================
// LUMINA — COMPATIBILITY REGISTRY v1.0
// functions/src/gamification/compatibility/CompatibilityRegistry.ts
//
// SPRINT 1C — Registry central de Adapters.
// Mesmo padrão do DispatcherRegistry: novo Adapter = só registrar.
// ============================================

import { ICompatibilityAdapter } from './ICompatibilityAdapter';
import { ShadowSystem }          from '../shadow/ShadowStatus';

const registry = new Map<ShadowSystem, ICompatibilityAdapter>();

export function registerCompatibilityAdapter(adapter: ICompatibilityAdapter): void {
  if (registry.has(adapter.system)) {
    throw new Error(`CompatibilityAdapter para ${adapter.system} já registrado.`);
  }
  registry.set(adapter.system, adapter);
}

export function getCompatibilityAdapter(system: ShadowSystem): ICompatibilityAdapter | undefined {
  return registry.get(system);
}

export function getRegisteredSystems(): ShadowSystem[] {
  return Array.from(registry.keys());
}