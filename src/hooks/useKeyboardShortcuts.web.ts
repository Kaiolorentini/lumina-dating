// ============================================
// LUMINA — ATALHOS DE TECLADO (WEB)
// src/hooks/useKeyboardShortcuts.web.ts
//
// Atalhos de uma tela no computador (ex.: Sintonize: seta esquerda
// passa, seta direita sintoniza). As teclas são os valores de
// KeyboardEvent.key ('ArrowLeft', 'Enter', ' ').
//
// Não dispara quando a pessoa está digitando (campo de texto) nem
// com um aviso aberto (WebAlertHost): uma seta não pode confirmar
// nada escondido atrás de um modal.
// ============================================

import { useEffect, useRef } from 'react';
import { hasOpenWebAlert } from '../utils/webAlert';

export type ShortcutMap = Partial<Record<string, () => void>>;

interface KeyEventLike {
  key: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target?: unknown;
  preventDefault(): void;
}
interface KeyTarget {
  addEventListener(type: 'keydown', listener: (event: KeyEventLike) => void): void;
  removeEventListener(type: 'keydown', listener: (event: KeyEventLike) => void): void;
}
interface ElementLike { tagName?: string; isContentEditable?: boolean }

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isTyping(target: unknown): boolean {
  const el = target as ElementLike | null;
  if (!el) return false;
  return el.isContentEditable === true || TYPING_TAGS.has((el.tagName ?? '').toUpperCase());
}

export function useKeyboardShortcuts(map: ShortcutMap, enabled: boolean): void {
  // Sempre a versão mais nova das ações, sem recriar o listener.
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    const doc = (globalThis as unknown as { document?: KeyTarget }).document;
    if (!enabled || !doc) return;

    const onKey = (event: KeyEventLike) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target) || hasOpenWebAlert()) return;
      const action = mapRef.current[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    };

    doc.addEventListener('keydown', onKey);
    return () => doc.removeEventListener('keydown', onKey);
  }, [enabled]);
}
