// ============================================
// LUMINA — RASCUNHO DA VERIFICAÇÃO DE IDADE
// src/modules/verification/services/verificationDraft.ts
//
// Guarda no aparelho, por usuário, o andamento das três fotos:
// quais já foram tiradas (só o ENDEREÇO do arquivo local, nunca
// a imagem nem base64), a etapa atual e qual etapa estava com a
// câmera aberta.
//
// Por quê: com a câmera aberta, o Android pode encerrar o Lumina
// para liberar memória. Sem isto a pessoa voltava para a etapa 1
// e perdia a foto que acabou de tirar.
//
// Estado em módulo + assinantes: se a tela for desmontada e
// montada de novo enquanto a câmera está aberta, a foto que
// chega na instância antiga aparece na nova.
//
// LGPD: os arquivos são apagados no envio aceito, ao sair da
// conta e quando o rascunho passa de 24 h.
// ============================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { VERIFICATION_STEPS, VerificationStep } from '../../../config/verification';

const KEY_PREFIX = '@lumina:ageVerificationDraft:';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type DraftCaptures = Partial<Record<VerificationStep, string>>;

export interface VerificationDraft {
  captures: DraftCaptures;
  stepIndex: number;
  /** Etapa com a câmera aberta. Sobrevive ao encerramento do app. */
  pendingStep: VerificationStep | null;
  updatedAt: number;
}

export const EMPTY_DRAFT: VerificationDraft = {
  captures: {},
  stepIndex: 0,
  pendingStep: null,
  updatedAt: 0,
};

type Listener = (draft: VerificationDraft) => void;

let memoryUid: string | null = null;
let memoryDraft: VerificationDraft = EMPTY_DRAFT;
const subscribers = new Set<{ uid: string; fn: Listener }>();

// Gravações em fila: um setItem atrasado nunca passa por cima
// de um mais novo nem ressuscita um rascunho apagado.
let writeChain: Promise<void> = Promise.resolve();

function storageKey(uid: string): string {
  return `${KEY_PREFIX}${uid}`;
}

function isStep(value: unknown): value is VerificationStep {
  return typeof value === 'string'
    && (VERIFICATION_STEPS as readonly string[]).includes(value);
}

/** Só arquivos dentro das pastas do próprio app. */
function isAppLocalUri(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!value.startsWith('file://') || value.includes('..')) return false;
  const roots = [FileSystem.cacheDirectory, FileSystem.documentDirectory]
    .filter((root): root is string => !!root);
  return roots.some(root => value.startsWith(root));
}

async function fileExists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

/** Apaga um arquivo local do app. Nunca lança. */
export async function deleteLocalFile(uri: string | null | undefined): Promise<void> {
  if (!isAppLocalUri(uri)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (error) {
    console.warn('[verificationDraft] Falha ao apagar arquivo local', error);
  }
}

function notify(uid: string, draft: VerificationDraft): void {
  subscribers.forEach(sub => {
    if (sub.uid === uid) sub.fn(draft);
  });
}

function enqueue(task: () => Promise<void>): Promise<void> {
  writeChain = writeChain
    .then(task)
    .catch(error => console.warn('[verificationDraft] Falha ao gravar rascunho', error));
  return writeChain;
}

async function readStored(uid: string): Promise<VerificationDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;

    const rawCaptures =
      obj.captures && typeof obj.captures === 'object'
        ? (obj.captures as Record<string, unknown>)
        : {};

    const captures: DraftCaptures = {};
    for (const step of VERIFICATION_STEPS) {
      const uri = rawCaptures[step];
      if (isAppLocalUri(uri)) captures[step] = uri;
    }

    const stepIndex =
      typeof obj.stepIndex === 'number'
      && Number.isInteger(obj.stepIndex)
      && obj.stepIndex >= 0
      && obj.stepIndex < VERIFICATION_STEPS.length
        ? obj.stepIndex
        : 0;

    return {
      captures,
      stepIndex,
      pendingStep: isStep(obj.pendingStep) ? obj.pendingStep : null,
      updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

/** Rascunho em memória, sem ler o aparelho. */
export function getDraft(uid: string): VerificationDraft {
  return memoryUid === uid ? memoryDraft : EMPTY_DRAFT;
}

/**
 * Carrega o rascunho do usuário. No mesmo processo a memória é a
 * versão mais nova; depois de o app ser encerrado, vem do aparelho,
 * descartando arquivos que sumiram e rascunhos com mais de 24 h.
 */
export async function loadDraft(uid: string): Promise<VerificationDraft> {
  if (memoryUid === uid) return memoryDraft;

  const stored = await readStored(uid);
  if (memoryUid === uid) return memoryDraft;

  let draft: VerificationDraft = EMPTY_DRAFT;

  if (stored) {
    const expired = Date.now() - stored.updatedAt > MAX_AGE_MS;
    if (expired) {
      await Promise.all(Object.values(stored.captures).map(deleteLocalFile));
      await enqueue(() => AsyncStorage.removeItem(storageKey(uid)));
    } else {
      const captures: DraftCaptures = {};
      for (const step of VERIFICATION_STEPS) {
        const uri = stored.captures[step];
        if (uri && (await fileExists(uri))) captures[step] = uri;
      }
      draft = { ...stored, captures };
    }
  }

  if (memoryUid === uid) return memoryDraft;
  memoryUid = uid;
  memoryDraft = draft;
  notify(uid, draft);
  return draft;
}

/** Altera o rascunho, avisa a tela e grava no aparelho. */
export function updateDraft(
  uid: string,
  mutate: (draft: VerificationDraft) => VerificationDraft,
): Promise<void> {
  const base = memoryUid === uid ? memoryDraft : EMPTY_DRAFT;
  const next: VerificationDraft = { ...mutate(base), updatedAt: Date.now() };
  memoryUid = uid;
  memoryDraft = next;
  notify(uid, next);
  return enqueue(() => AsyncStorage.setItem(storageKey(uid), JSON.stringify(next)));
}

/**
 * Apaga o rascunho e as fotos locais.
 * notify: false no envio aceito — a tela não pode piscar vazia
 * antes de o app trocar para a espera.
 */
export async function clearDraft(
  uid: string,
  options: { notify?: boolean } = {},
): Promise<void> {
  const known = memoryUid === uid ? memoryDraft : await readStored(uid);

  if (memoryUid === uid) {
    memoryDraft = EMPTY_DRAFT;
    if (options.notify !== false) notify(uid, EMPTY_DRAFT);
  }

  await enqueue(() => AsyncStorage.removeItem(storageKey(uid)));

  if (known) {
    await Promise.all(Object.values(known.captures).map(deleteLocalFile));
  }
}

export function subscribeDraft(uid: string, fn: Listener): () => void {
  const sub = { uid, fn };
  subscribers.add(sub);
  return () => {
    subscribers.delete(sub);
  };
}