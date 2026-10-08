// ============================================
// LUMINA — VERIFICAÇÃO DE IDADE, SERVIÇO
// src/modules/verification/services/verificationService.ts
//
// As imagens sobem DIRETO para o Storage (as Rules
// permitem só ao dono escrever em age_verification/{uid}/)
// e depois a CF submitAgeVerification confirma que os três
// arquivos chegaram e cria o registro pendente.
//
// Por que não passar as imagens pela CF: payload de
// callable tem limite de 10 MB. Upload direto também dá
// progresso real.
//
// SÓ CÂMERA, nunca galeria: foto de galeria pode ser
// imagem de outra pessoa baixada da internet.
//
// MEMÓRIA: a foto NÃO vem em base64. Base64 de foto de câmera
// são 4 a 6 MB parados no JavaScript, e com a câmera aberta o
// Android encerra primeiro o app mais pesado. A foto é reduzida
// para 1600 px no lado maior (a data de nascimento continua
// legível) e o original é apagado.
// ============================================

import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { storage } from '../../../core/firebase';
import { resolveImageBlob } from '../../../shared/utils/imageBlob';
import { VerificationStep, MAX_IMAGE_MB } from '../../../config/verification';
import { deleteLocalFile } from './verificationDraft';

const MAX_SIDE     = 1600;
const JPEG_QUALITY = 0.8;

// Genéricos extraídos para tipos nomeados: httpsCallable
// em fim de linha é corrompido ao colar.
interface AcceptTermsPayload {
  version: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
}

interface AcceptTermsResult {
  success: boolean;
  version: string;
}

interface SubmitResult {
  success: boolean;
  status: 'pending';
  attempt: number;
}

export interface CapturedImage {
  /** Arquivo local já reduzido. */
  uri: string;
}

function functionsInstance() {
  return getFunctions(app, 'us-central1');
}

function storagePathFor(uid: string, step: VerificationStep): string {
  return `age_verification/${uid}/${step}.jpg`;
}

/**
 * Reduz a foto da câmera e apaga o original, que é foto de
 * documento em tamanho cheio e não deve ficar no aparelho.
 */
async function prepareCapture(asset: ImagePicker.ImagePickerAsset): Promise<CapturedImage> {
  const context = ImageManipulator.manipulate(asset.uri);
  const { width, height } = asset;

  if (width >= height && width > MAX_SIDE) context.resize({ width: MAX_SIDE });
  else if (height > width && height > MAX_SIDE) context.resize({ height: MAX_SIDE });

  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });

  if (saved.uri !== asset.uri) void deleteLocalFile(asset.uri);
  return { uri: saved.uri };
}

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

/**
 * Lê o arquivo como Blob. O base64 é o plano B do imageBlob.ts,
 * lido do disco só agora, na hora do envio, em vez de ficar na
 * memória desde a captura.
 */
async function readImageBlob(uri: string): Promise<Blob> {
  try {
    return await resolveImageBlob(uri, null);
  } catch {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return resolveImageBlob(uri, base64);
  }
}

/**
 * Sobe uma imagem para o Storage. Resolve com o caminho.
 * O onProgress serve para a tela mostrar o avanço — três
 * fotos de câmera demoram em conexão ruim.
 */
export async function uploadVerificationImage(
  uid: string,
  step: VerificationStep,
  image: CapturedImage,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const path = storagePathFor(uid, step);
  const blob = await readImageBlob(image.uri);

  const maxBytes = MAX_IMAGE_MB * 1024 * 1024;
  if (blob.size > maxBytes) {
    throw new Error(
      `A imagem tem ${(blob.size / 1024 / 1024).toFixed(1)} MB e o limite é ${MAX_IMAGE_MB} MB. Tire a foto novamente.`,
    );
  }

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), blob, {
      contentType: 'image/jpeg',
    });

    task.on(
      'state_changed',
      snapshot => {
        if (onProgress && snapshot.totalBytes > 0) {
          onProgress(
            Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
          );
        }
      },
      error => {
        console.error(`[verificationService] Upload falhou: ${step}`, error);
        const code = (error as { code?: string })?.code ?? 'desconhecido';
        reject(new Error(`Falha no envio (${code}). Verifique sua conexão.`));
      },
      () => resolve(path),
    );
  });
}

/**
 * Confirma o envio. Chamar só depois que as três imagens
 * subiram: a CF verifica que os arquivos existem e recusa
 * se faltar alguma.
 */
export async function submitVerification(): Promise<SubmitResult> {
  const fn = httpsCallable<void, SubmitResult>(
    functionsInstance(),
    'submitAgeVerification',
  );
  const result = await fn();
  return result.data;
}

/** Registra o aceite dos Termos e da Política. */
export async function acceptTerms(version: string): Promise<AcceptTermsResult> {
  const fn = httpsCallable<AcceptTermsPayload, AcceptTermsResult>(
    functionsInstance(),
    'acceptAppTerms',
  );
  const result = await fn({
    version,
    acceptedTerms: true,
    acceptedPrivacy: true,
  });
  return result.data;
}