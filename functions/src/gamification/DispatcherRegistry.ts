// ============================================
// LUMINA — DISPATCHER REGISTRY v1.1
// functions/src/gamification/DispatcherRegistry.ts
//
// BLOCO 3 — Registry com proteção contra duplicatas.
// MELHORIA 9: impede nomes duplicados e registros repetidos.
// ============================================

import { DispatcherType }  from './GameEventTypes';
import { IGameDispatcher } from './IGameDispatcher';

const registry = new Map<DispatcherType, IGameDispatcher>();

// MELHORIA 9: impede duplicatas e registros sem interface
export function registerDispatcher(dispatcher: IGameDispatcher): void {
  const meta = dispatcher.getMetadata();

  if (!meta.name || !meta.type) {
    throw new Error(`Dispatcher inválido — metadata incompleto: ${JSON.stringify(meta)}`);
  }

  if (registry.has(meta.type)) {
    throw new Error(`Dispatcher ${meta.type} já registrado. Remova o duplicado.`);
  }

  registry.set(meta.type, dispatcher);
}

export function getDispatcher(type: DispatcherType): IGameDispatcher | undefined {
  return registry.get(type);
}

export function getRegisteredTypes(): DispatcherType[] {
  return Array.from(registry.keys());
}

// Expõe interface para o EventDispatcher
export type { IGameDispatcher };