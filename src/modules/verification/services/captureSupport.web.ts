// ============================================
// LUMINA — ONDE AS FOTOS DA VERIFICAÇÃO PODEM SER TIRADAS (WEB)
// src/modules/verification/services/captureSupport.web.ts
//
// Decisão de Kaio (13/10/2026): no navegador, só no CELULAR.
// Computador → a tela pede para continuar no celular.
//
// Isto é UX, não segurança: quem quiser engana o navegador. A
// barreira real é o questionário humano (item 8: "selfie real,
// feita na hora").
// ============================================

interface NavigatorLike {
  userAgent?:     string;
  maxTouchPoints?: number;
  userAgentData?: { mobile?: boolean };
}

function detectPhone(): boolean {
  const nav = (globalThis as unknown as { navigator?: NavigatorLike }).navigator;
  if (!nav) return false;
  if (nav.userAgentData?.mobile === true) return true;

  const ua = nav.userAgent ?? '';
  if (/Android|iPhone|iPod|Mobile/i.test(ua)) return true;

  // iPadOS se apresenta como Mac; Mac com tela de toque = iPad.
  return /Macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1;
}

const IS_PHONE = detectPhone();

export function canCaptureVerification(): boolean {
  return IS_PHONE;
}
