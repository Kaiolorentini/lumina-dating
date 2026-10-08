// ============================================
// LUMINA — SERVIÇO DO SUPORTE
// src/modules/support/services/supportService.ts
//
// Escritas sempre pelas CFs de supportTickets. Leituras em tempo
// real pelas rules (dono ou admin).
// ============================================

import {
  collection, doc, getDoc, query, where, orderBy, limit, onSnapshot,
  Timestamp, DocumentData,
} from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { resolveImageBlob } from '../../../shared/utils/imageBlob';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import app, { db, storage } from '../../../core/firebase';

export type TicketStatus   = 'open' | 'answered' | 'resolved';
export type TicketPriority = 'urgent' | 'normal' | 'low';

export interface TicketAnswer {
  questionId: string;
  question:   string;
  optionIds:  string[];
  labels:     string[];
  text:       string;
}

export interface SupportTicket {
  id:             string;
  uid:            string;
  userName:       string;
  userPhoto:      string;
  category:       string;
  categoryLabel:  string;
  answers:        TicketAnswer[];
  summary:        string;
  description:    string;
  reportedUid:    string | null;
  attachmentPath: string | null;
  device:         { platform: string; osVersion: string; model: string; appVersion: string; runtimeVersion: string };
  context:        { role: string; galaxiaPlus: boolean };
  priority:       TicketPriority;
  status:         TicketStatus;
  unreadForUser:  boolean;
  unreadForAdmin: boolean;
  messagesCount:  number;
  lastMessageBy:  'user' | 'admin';
  createdAt:      Date | null;
  lastMessageAt:  Date | null;
}

export interface SupportMessage {
  id:             string;
  author:         'user' | 'admin';
  authorUid:      string;
  text:           string;
  attachmentPath: string | null;
  createdAt:      Date | null;
}

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open:     'Aguardando o suporte',
  answered: 'Respondido',
  resolved: 'Resolvido',
};

function toDate(v: unknown): Date | null {
  return (v as Timestamp | undefined)?.toDate?.() ?? null;
}

function mapTicket(id: string, d: DocumentData): SupportTicket {
  return {
    id,
    uid:            String(d.uid ?? ''),
    userName:       String(d.userName ?? ''),
    userPhoto:      String(d.userPhoto ?? ''),
    category:       String(d.category ?? ''),
    categoryLabel:  String(d.categoryLabel ?? ''),
    answers:        (d.answers as TicketAnswer[] | undefined) ?? [],
    summary:        String(d.summary ?? ''),
    description:    String(d.description ?? ''),
    reportedUid:    (d.reportedUid as string | null | undefined) ?? null,
    attachmentPath: (d.attachmentPath as string | null | undefined) ?? null,
    device:         {
      platform: '', osVersion: '', model: '', appVersion: '', runtimeVersion: '',
      ...(d.device ?? {}),
    },
    context:        { role: 'user', galaxiaPlus: false, ...(d.context ?? {}) },
    priority:       (d.priority as TicketPriority) ?? 'normal',
    status:         (d.status as TicketStatus) ?? 'open',
    unreadForUser:  d.unreadForUser === true,
    unreadForAdmin: d.unreadForAdmin === true,
    messagesCount:  Number(d.messagesCount ?? 0),
    lastMessageBy:  d.lastMessageBy === 'admin' ? 'admin' : 'user',
    createdAt:      toDate(d.createdAt),
    lastMessageAt:  toDate(d.lastMessageAt),
  };
}

// ── Escutas ──

export function listenMyTickets(
  uid: string,
  onChange: (tickets: SupportTicket[]) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'supportTickets'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(20)),
    snap => onChange(snap.docs.map(d => mapTicket(d.id, d.data()))),
    onError,
  );
}

/** Fila do painel. Índice: supportTickets (status, lastMessageAt DESC). */
export function listenTicketsByStatus(
  status: TicketStatus,
  onChange: (tickets: SupportTicket[]) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'supportTickets'), where('status', '==', status), orderBy('lastMessageAt', 'desc'), limit(50)),
    snap => onChange(snap.docs.map(d => mapTicket(d.id, d.data()))),
    onError,
  );
}

export function listenTicket(
  ticketId: string,
  onChange: (ticket: SupportTicket | null) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, 'supportTickets', ticketId),
    snap => onChange(snap.exists() ? mapTicket(snap.id, snap.data()) : null),
    onError,
  );
}

export function listenMessages(
  ticketId: string,
  onChange: (messages: SupportMessage[]) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'supportTickets', ticketId, 'messages'), orderBy('createdAt', 'asc')),
    snap => onChange(snap.docs.map(d => {
      const m = d.data();
      return {
        id:             d.id,
        author:         m.author === 'admin' ? 'admin' : 'user',
        authorUid:      String(m.authorUid ?? ''),
        text:           String(m.text ?? ''),
        attachmentPath: (m.attachmentPath as string | null | undefined) ?? null,
        createdAt:      toDate(m.createdAt),
      };
    })),
    onError,
  );
}

// ── Ações (CFs) ──

function fns() {
  return getFunctions(app, 'us-central1');
}

export interface CreateTicketInput {
  category:       string;
  categoryLabel:  string;
  answers:        TicketAnswer[];
  description?:   string;
  reportedUid?:   string | null;
  attachmentPath?: string | null;
  device:         SupportTicket['device'];
}

export async function createTicket(input: CreateTicketInput): Promise<string> {
  const res = await httpsCallable<CreateTicketInput, { ticketId: string }>(fns(), 'createSupportTicket')(input);
  return res.data.ticketId;
}

export async function replyTicket(ticketId: string, text: string, attachmentPath?: string | null): Promise<void> {
  await httpsCallable(fns(), 'replySupportTicket')({ ticketId, text, attachmentPath: attachmentPath ?? null });
}

export async function resolveTicket(ticketId: string): Promise<void> {
  await httpsCallable(fns(), 'resolveSupportTicket')({ ticketId });
}

export async function markTicketRead(ticketId: string): Promise<void> {
  await httpsCallable(fns(), 'markSupportTicketRead')({ ticketId });
}

export async function getAttachmentUrl(ticketId: string, path: string): Promise<string> {
  const res = await httpsCallable<{ ticketId: string; path: string }, { url: string }>(
    fns(), 'getSupportAttachmentUrl',
  )({ ticketId, path });
  return res.data.url;
}

// ── Print ──

/**
 * Envia o print para support/{uid}/ e devolve o caminho.
 *
 * O Blob vem do resolveImageBlob (fetch da URI, base64 como plano B):
 * no React Native, entregar bytes (Uint8Array) ao Storage faz o SDK
 * montar um Blob a partir de ArrayBuffer, o que não é suportado.
 * Ver o histórico em shared/utils/imageBlob.ts.
 */
export async function uploadSupportImage(
  uid: string,
  image: { uri: string; base64: string | null },
): Promise<string> {
  const path = `support/${uid}/${Date.now()}.jpg`;
  const blob = await resolveImageBlob(image.uri, image.base64);
  await uploadBytes(ref(storage, path), blob, { contentType: 'image/jpeg' });
  return path;
}

// ── Contexto ──

export function collectDeviceInfo(): SupportTicket['device'] {
  const constants = Platform.constants as { Model?: string; Brand?: string };
  return {
    platform:       Platform.OS,
    osVersion:      String(Platform.Version ?? ''),
    model:          [constants.Brand, constants.Model].filter(Boolean).join(' '),
    appVersion:     Constants.expoConfig?.version ?? '',
    runtimeVersion: Updates.runtimeVersion ?? '',
  };
}

/** Conexões recentes, para escolher quem denunciar. */
export async function loadReportCandidates(
  uid: string,
  connections: Array<{ fromUserId: string; toUserId: string }>,
): Promise<Array<{ uid: string; name: string; photoURL: string }>> {
  const ids = Array.from(new Set(connections.map(c => (c.fromUserId === uid ? c.toUserId : c.fromUserId))))
    .filter(Boolean)
    .slice(0, 30);
  const snaps = await Promise.all(ids.map(id => getDoc(doc(db, 'users', id)).catch(() => null)));
  return snaps
    .filter((s): s is NonNullable<typeof s> => !!s && s.exists())
    .map(s => {
      const data = s.data() ?? {};
      return { uid: s.id, name: String(data.name ?? 'Usuário'), photoURL: String(data.photoURL ?? '') };
    });
}