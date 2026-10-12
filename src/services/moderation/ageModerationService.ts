// ============================================
// LUMINA — MODERAÇÃO DA VERIFICAÇÃO DE IDADE (chamadas ao servidor)
// src/services/moderation/ageModerationService.ts
//
// 12/10/2026. Aprovar e recusar passam SEMPRE pelo questionário. O
// servidor confere tudo de novo, decide o motivo da recusa e grava o
// registro em moderationRecords — o app só envia as respostas.
//
// O rascunho (respostas, observações e a data digitada) fica em
// memória por usuário: se o admin sair da tela, volta de onde parou.
// Some ao fechar o app ou ao concluir. Nada disso vai para o disco —
// é dado de documento (LGPD).
// ============================================

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../core/firebase';
import {
  AGE_CHECKLIST_VERSION, AgeChecklistAnswer, AgeChecklistPayload,
} from '../../config/moderation/ageChecklist';

export interface AgeChecklistDraft {
  answers: Record<string, AgeChecklistAnswer>;
  notes: Record<string, string>;
  /** Como o admin digitou (DD/MM/AAAA). */
  birthDateInput: string;
}

export interface PendingVerification {
  uid: string;
  declaredName: string | null;
  declaredAge: number | null;
  city: string | null;
  state: string | null;
  email: string | null;
  photoURL: string | null;
  attempts: number;
  submittedAt: string | null;
  /** URLs assinadas na ordem: frente, verso, selfie. */
  imageUrls: string[];
}

interface ListPendingPayload {
  userId?: string;
}

interface ListPendingResult {
  items: PendingVerification[];
  signedUrlMinutes: number;
}

interface ApprovePayload {
  userId: string;
  birthDate: string;
  checklist: AgeChecklistPayload;
}

export interface ApproveAgeResult {
  success: boolean;
  verifiedAge: number;
  ageCorrected: boolean;
  founderNumber: number | null;
}

interface RejectPayload {
  userId: string;
  checklist: AgeChecklistPayload;
  birthDate?: string;
}

export interface RejectAgeResult {
  success: boolean;
  accountBanned: boolean;
  attemptsLeft: number;
  reason: string;
  userMessage: string;
  moderationRecordId: string;
}

const drafts = new Map<string, AgeChecklistDraft>();

export function getAgeDraft(userId: string): AgeChecklistDraft {
  return drafts.get(userId) ?? { answers: {}, notes: {}, birthDateInput: '' };
}

export function saveAgeDraft(userId: string, draft: AgeChecklistDraft): void {
  drafts.set(userId, draft);
}

export function clearAgeDraft(userId: string): void {
  drafts.delete(userId);
}

/** Aceita 31/12/1990 ou 31121990 e devolve AAAA-MM-DD (ou null). */
export function toIsoDate(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
}

/** Brasília: UTC-3 (sem horário de verão desde 2019). */
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Máscara DD/MM/AAAA enquanto digita. */
export function maskBirthDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Idade em anos completos no fuso de Brasília — só PRÉVIA para o
 * admin; o servidor calcula de novo e é quem decide.
 * Devolve null para data incompleta, inexistente ou no futuro.
 */
export function previewAge(input: string): number | null {
  const iso = toIsoDate(input);
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;

  // "Hoje" em Brasília SEM toLocaleString: no Hermes (motor do app)
  // o texto de toLocaleString não volta para Date e dava "NaN anos"
  // (12/10/2026). Brasília é UTC-3 o ano todo desde 2019 (sem horário
  // de verão), então basta deslocar e ler os campos em UTC.
  const nowBrt = new Date(Date.now() - BRT_OFFSET_MS);
  const todayYear  = nowBrt.getUTCFullYear();
  const todayMonth = nowBrt.getUTCMonth() + 1;
  const todayDay   = nowBrt.getUTCDate();

  // Data no futuro (comparando só dia/mês/ano).
  if (year * 10000 + month * 100 + day > todayYear * 10000 + todayMonth * 100 + todayDay) return null;
  if (year < todayYear - 120) return null;

  let age = todayYear - year;
  if (todayMonth < month || (todayMonth === month && todayDay < day)) age--;
  return Number.isFinite(age) ? age : null;
}

function toPayload(draft: AgeChecklistDraft): AgeChecklistPayload {
  const notes: Record<string, string> = {};
  Object.entries(draft.notes).forEach(([id, note]) => {
    const trimmed = note.trim();
    if (trimmed && draft.answers[id] === 'rejected') notes[id] = trimmed.slice(0, 300);
  });
  return { version: AGE_CHECKLIST_VERSION, answers: draft.answers, notes };
}

const functions = () => getFunctions(app, 'us-central1');

/** Mensagem do servidor (HttpsError) ou genérica. */
export function ageModerationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Não foi possível concluir agora. Tente de novo.';
}

/** Lista a fila (sem userId) ou uma verificação pendente (com userId). */
export async function listPendingVerifications(userId?: string): Promise<ListPendingResult> {
  const fn = httpsCallable<ListPendingPayload, ListPendingResult>(functions(), 'listPendingVerifications');
  const result = await fn(userId ? { userId } : {});
  return result.data;
}

/** Aprova — todos os itens aprovados e data de nascimento do documento. */
export async function approveAge(userId: string, draft: AgeChecklistDraft): Promise<ApproveAgeResult> {
  const birthDate = toIsoDate(draft.birthDateInput);
  if (!birthDate) throw new Error('Digite a data de nascimento do documento no formato DD/MM/AAAA.');
  const fn = httpsCallable<ApprovePayload, ApproveAgeResult>(functions(), 'approveAgeVerification');
  const result = await fn({ userId, birthDate, checklist: toPayload(draft) });
  return result.data;
}

/**
 * Recusa — pelo menos um item negado. A data só é enviada se for uma
 * data válida; o servidor a exige quando o item "18 anos ou mais" é negado.
 */
export async function rejectAge(userId: string, draft: AgeChecklistDraft): Promise<RejectAgeResult> {
  const birthDate = toIsoDate(draft.birthDateInput);
  const payload: RejectPayload = { userId, checklist: toPayload(draft) };
  // Só data válida: documento ilegível com data meio digitada não pode
  // travar a recusa.
  if (birthDate && previewAge(draft.birthDateInput) !== null) payload.birthDate = birthDate;
  const fn = httpsCallable<RejectPayload, RejectAgeResult>(functions(), 'rejectAgeVerification');
  const result = await fn(payload);
  return result.data;
}
