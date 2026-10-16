// ============================================
// LUMINA — VERIFICAÇÃO DE IDADE: CÂMERA (WEB)
// src/modules/verification/services/verificationCapture.web.ts
//
// Decisão de Kaio (13/10/2026): no navegador, as fotos só podem ser
// tiradas no CELULAR, com a câmera do telefone. No computador não
// (a tela mostra "continue no celular" — VerifyOnPhoneCard).
//
// O expo-image-picker na web abre a câmera do telefone por um campo
// de arquivo com o atributo `capture`: no Chrome do Android e no
// Safari do iPhone isso abre a CÂMERA direto, sem a galeria.
//
// Sem requestCameraPermissionsAsync: o campo com `capture` não usa a
// permissão de câmera do navegador (getUserMedia), que só existe em
// HTTPS — pedir a permissão quebraria o teste em http:// na rede de
// casa sem trazer proteção nenhuma.
//
// Mesmos exports do verificationCapture.ts.
// ============================================

import * as ImagePicker from 'expo-image-picker';
import { CapturedImage, prepareCapture } from './verificationImage';
import { canCaptureVerification } from './captureSupport';

export async function captureVerificationImage(): Promise<CapturedImage | null> {
  // Segunda barreira: a tela já não mostra o botão no computador.
  if (!canCaptureVerification()) {
    throw new Error('As fotos da verificação só podem ser tiradas pelo navegador do celular.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.9,
    base64: false,
    exif: false,
  });

  if (result.canceled || !result.assets[0]) return null;
  return prepareCapture(result.assets[0]);
}

/** Só o Android encerra o app com a câmera aberta: na web não há o que recuperar. */
export async function recoverPendingCapture(): Promise<CapturedImage | null> {
  return null;
}
