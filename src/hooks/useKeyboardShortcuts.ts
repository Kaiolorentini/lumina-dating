// ============================================
// LUMINA — ATALHOS DE TECLADO (APP ANDROID/iOS)
// src/hooks/useKeyboardShortcuts.ts
//
// No app não há teclado físico: não faz nada. A versão do
// navegador é useKeyboardShortcuts.web.ts.
// ============================================

export type ShortcutMap = Partial<Record<string, () => void>>;

export function useKeyboardShortcuts(_map: ShortcutMap, _enabled: boolean): void {
  // Sem teclado no app.
}
