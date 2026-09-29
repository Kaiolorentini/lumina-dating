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

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decodifica base64 sem depender de atob (nem sempre global no RN). */
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]) << 18) |
      (B64.indexOf(clean[i + 1]) << 12) |
      ((B64.indexOf(clean[i + 2] ?? 'A') & 63) << 6) |
      (B64.indexOf(clean[i + 3] ?? 'A') & 63);
    bytes[byteIndex++] = (n >> 16) & 255;
    if (clean[i + 2] !== undefined) bytes[byteIndex++] = (n >> 8) & 255;
    if (clean[i + 3] !== undefined) bytes[byteIndex++] = n & 255;
  }
  return bytes.subarray(0, byteIndex);
}

/** Envia o print para support/{uid}/ e devolve o caminho. */
export async function uploadSupportImage(uid: string, base64: string): Promise<string> {
  const path = `support/${uid}/${Date.now()}.jpg`;
  await uploadBytes(ref(storage, path), base64ToBytes(base64), { contentType: 'image/jpeg' });
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