// ============================================
// LUMINA — VERIFICAÇÃO DE IDADE: CÂMERA (APP ANDROID/iOS)
// src/modules/verification/services/verificationCapture.ts
//
// Mesmo código que estava no verificationService.ts, movido para um
// arquivo próprio para o navegador ter a sua versão
// (verificationCapture.web.ts). Comportamento do app inalterado.
//
// SÓ CÂMERA, nunca galeria: foto de galeria pode ser
// imagem de outra pessoa baixada da internet.
// ============================================

import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CapturedImage, prepareCapture } from './verificationImage';

/**
 * Abre a câmera para uma etapa. Devolve null se o usuário
 * cancelar; lança se a permissão for negada, para a tela
 * poder oferecer abrir as configurações.
 */
export async function captureVerificationImage(): Promise<CapturedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    throw new Error('CAMERA_DENIED');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    // Alta de propósito: a foto ainda é reduzida e recomprimida
    // em prepareCapture. Comprimir forte duas vezes borra a data
    // de nascimento que o admin precisa ler.
    quality: 0.9,
    base64: false,
    exif: false,
  });

  if (result.canceled || !result.assets[0]) return null;
  return prepareCapture(result.assets[0]);
}

/**
 * Android: quando o sistema encerra o app com a câmera aberta, a
 * foto fica guardada com o sistema e chega por aqui na reabertura.
 * Só é chamada se a tela tinha aberto a câmera (pendingStep).
 */
export async function recoverPendingCapture(): Promise<CapturedImage | null> {
  if (Platform.OS !== 'android') return null;

  // O formato do retorno mudou entre versões do expo-image-picker
  // (lista ou item único): normaliza os dois.
  const raw: unknown = await ImagePicker.getPendingResultAsync();
  const pending: unknown = Array.isArray(raw) ? raw[0] : raw;
  if (!pending || typeof pending !== 'object') return null;

  if (!('canceled' in pending)) {
    throw new Error('A câmera não devolveu a foto. Tire novamente.');
  }

  const result = pending as ImagePicker.ImagePickerResult;
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  if (asset.type && asset.type !== 'image') return null;

  return prepareCapture(asset);
}
