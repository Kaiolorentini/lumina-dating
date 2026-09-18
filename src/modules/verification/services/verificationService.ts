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
// callable tem limite de 10 MB e três fotos de 8 MB não
// caberiam. Upload direto também dá progresso real.
//
// SÓ CÂMERA, nunca galeria: foto de galeria pode ser
// imagem de outra pessoa baixada da internet.
// ============================================

import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { storage } from '../../../core/firebase';
import { resolveImageBlob } from '../../../shared/utils/imageBlob';
import { VerificationStep, MAX_IMAGE_MB } from '../../../config/verification';

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
  uri: string;
  base64: string | null;
}

function functionsInstance() {
  return getFunctions(app, 'us-central1');
}

function storagePathFor(uid: string, step: VerificationStep): string {
  return `age_verification/${uid}/${step}.jpg`;
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
    // 0.7 equilibra legibilidade e tamanho: o admin precisa
    // ler a data de nascimento, mas 8 MB é o teto da rule.
    quality: 0.7,
    base64: true,
    exif: false,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  return { uri: asset.uri, base64: asset.base64 ?? null };
}

/**
 * Sobe uma imagem para o Storage. Resolve com o caminho.
 * O onProgress serve para a tela mostrar o avanço — três
 * fotos de câmera demoram em conexão ruim.
 */
export function uploadVerificationImage(
  uid: string,
  step: VerificationStep,
  image: CapturedImage,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const path = storagePathFor(uid, step);

  return new Promise(async (resolve, reject) => {
    try {
      const blob = await resolveImageBlob(image.uri, image.base64);

      const maxBytes = MAX_IMAGE_MB * 1024 * 1024;
      if (blob.size > maxBytes) {
        reject(
          new Error(
            `A imagem tem ${(blob.size / 1024 / 1024).toFixed(1)} MB e o limite é ${MAX_IMAGE_MB} MB. Tire a foto novamente.`,
          ),
        );
        return;
      }

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
    } catch (error) {
      reject(error);
    }
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