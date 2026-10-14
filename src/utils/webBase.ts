// ============================================
// LUMINA — ENDEREÇO-BASE DO APP NA WEB
// src/utils/webBase.ts
//
// 13/10/2026 (unificação com a landing): o app web mora em
// https://lumina-ff667.web.app/app — a raiz é da landing. As URLs das
// telas ganham o prefixo /app (ex.: /app/sintonize).
//
// O prefixo é DETECTADO pelo endereço em que a página abriu: aberto
// em /app/... → '/app'; aberto na raiz (teste local com `npx serve`
// de uma pasta só do app) → ''. Assim o mesmo build funciona nos dois
// e nada depende de configuração extra. No Android não há location:
// devolve ''.
// ============================================

/** Pasta do app no site (sem barra no fim). */
export const APP_BASE_PATH = '/app';

interface LocationLike { pathname?: string; origin?: string; host?: string }

function currentLocation(): LocationLike | undefined {
  return (globalThis as unknown as { location?: LocationLike }).location;
}

function computeBase(): string {
  const path = currentLocation()?.pathname ?? '';
  return path === APP_BASE_PATH || path.startsWith(`${APP_BASE_PATH}/`) ? APP_BASE_PATH : '';
}

/** Prefixo em uso nesta página: '/app' ou ''. Fixado ao abrir. */
export const webBasePath = computeBase();

/** Tira o prefixo de um caminho do navegador: '/app/cofre' → '/cofre'. */
export function stripWebBase(path: string): string {
  if (!webBasePath) return path;
  if (path === webBasePath) return '/';
  return path.startsWith(`${webBasePath}/`) ? path.slice(webBasePath.length) : path;
}

/** Põe o prefixo num caminho do app: '/cofre' → '/app/cofre'. */
export function withWebBase(path: string): string {
  if (!webBasePath) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return clean === '/' ? webBasePath : `${webBasePath}${clean}`;
}

/** Endereço completo do app (para QR code e "copiar link"). */
export function appAddress(): { full: string; short: string } {
  const loc = currentLocation();
  const origin = loc?.origin ?? '';
  return {
    full:  origin ? `${origin}${webBasePath}` : '',
    short: loc?.host ? `${loc.host}${webBasePath}` : origin,
  };
}
