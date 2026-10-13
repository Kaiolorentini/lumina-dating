// ============================================
// LUMINA — ONDE AS FOTOS DA VERIFICAÇÃO PODEM SER TIRADAS (APP)
// src/modules/verification/services/captureSupport.ts
//
// No app (Android/iOS) sempre: é um celular com câmera.
// A versão do navegador é captureSupport.web.ts.
// ============================================

export function canCaptureVerification(): boolean {
  return true;
}
