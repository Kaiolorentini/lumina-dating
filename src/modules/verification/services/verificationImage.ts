// ============================================
// LUMINA — VERIFICAÇÃO DE IDADE: PREPARO DA FOTO
// src/modules/verification/services/verificationImage.ts
//
// Usado pelo app (verificationCapture.ts) e pelo navegador
// (verificationCapture.web.ts): uma regra só para o tamanho e a
// qualidade das fotos que o admin vai analisar.
//
// A foto é reduzida para 1600 px no lado maior (a data de nascimento
// continua legível) e o original é apagado (no app, o arquivo; na
// web, a memória do endereço blob:).
// ============================================

import type * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { deleteLocalFile } from './verificationDraft';

export const MAX_SIDE     = 1600;
export const JPEG_QUALITY = 0.8;

export interface CapturedImage {
  /** Arquivo local (app) ou endereço data:/blob: (web), já reduzido. */
  uri: string;
}

export async function prepareCapture(asset: ImagePicker.ImagePickerAsset): Promise<CapturedImage> {
  const context = ImageManipulator.manipulate(asset.uri);
  const { width, height } = asset;

  if (width >= height && width > MAX_SIDE) context.resize({ width: MAX_SIDE });
  else if (height > width && height > MAX_SIDE) context.resize({ height: MAX_SIDE });

  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });

  if (saved.uri !== asset.uri) void deleteLocalFile(asset.uri);
  return { uri: saved.uri };
}
