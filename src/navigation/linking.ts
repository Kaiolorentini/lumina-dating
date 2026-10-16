// ============================================
// LUMINA — LINKS / URLS (APP ANDROID/iOS)
// src/navigation/linking.ts
//
// No app não há configuração de links: o Android continua exatamente
// como antes, sem deep links novos. A versão do navegador (URL por
// tela, F5 mantém a tela) é linking.web.ts.
// ============================================

import type { LinkingOptions, NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const appLinking: LinkingOptions<RootStackParamList> | undefined = undefined;

export function restoreWebRoute(
  _navigation: NavigationContainerRef<RootStackParamList> | null,
): void {
  // Nada a restaurar fora do navegador.
}