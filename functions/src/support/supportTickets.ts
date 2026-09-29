// ============================================
// LUMINA — SUPORTE (chamados)
// functions/src/support/supportTickets.ts
//
// Chamado aberto por QUESTIONÁRIO (o app monta as respostas; o
// texto livre só aparece em "Outro", ideias e "Outro assunto").
//
// Status:
//   open      → aguardando o suporte (balão no painel)
//   answered  → aguardando o usuário (balão no Perfil)
//   resolved  → encerrado. Só o admin resolve, pelo painel.
//
// Um chamado ativo (open ou answered) por usuário.
// Prioridade calculada AQUI, não pelo app: denúncias graves,
// pagamento não recebido, cobrança dupla e conta invadida → urgente.
//
// Anexos: support/{uid}/..., leitura só por URL assinada de 5 min
// (getSupportAttachmentUrl), para o dono e para a administração.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { assertAuthenticated } from '../utils/adminGuard';
import { assertUserNotBlocked } from '../utils/assertUserNotBlocked';
import { notifyAdmins } from '../utils/notifyAdmins';
import { notifyUser } from '../utils/notifyUser';
import { isGalaxiaPlusActive } from '../payments/activateGalaxiaPlus';

const db = admin.firestore();

const CATEGORIES = new Set([
  'bug', 'payment', 'economy', 'account', 'social', 'marketplace',
  'creator', 'report', 'privacy', 'idea', 'question', 'other',
]);

/** Opções que tornam o chamado urgente. Espelha o questionário do app. */
const URGENT_OPTIONS = new Set([
  'pay_not_received', 'pay_double', 'acc_hacked',
  'rep_minor', 'rep_nonconsensual', 'rep_threat',
]);

const LOW_PRIORITY_CATEGORIES = new Set(['idea', 'question']);
/** Categorias em que a descrição é obrigatória. */
const TEXT_REQUIRED_CATEGORIES = new Set(['idea', 'other']);

const ADMIN_ROLES   = new Set(['admin', 'superadmin']);
const ACTIVE_STATUS = ['open', 'answered'];
const UID_PATTERN   = /^[A-Za-z0-9_-]{1,128}$/;

const MAX_TEXT     = 2000;
const MAX_LABEL    = 160;
const MAX_ANSWERS  = 12;
const MAX_OPTIONS  = 12;
const MAX_MESSAGES = 200;
const SIGNED_URL_MS = 5 * 60 * 1000;

type Priority = 'urgent' | 'normal' | 'low';

interface Answer {
  questionId: string;
  question:   string;
  optionIds:  string[];
  labels:     string[];
  text:       string;
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function strArray(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, maxItems).map(x => str(x, maxLen)).filter(Boolean);
}

function assertTicketId(v: unknown): string {
  if (typeof v !== 'string' || !v || v.includes('/')) {
    throw new HttpsError('invalid-argument', 'Chamado inválido.');
  }
  return v;
}

async function roleOf(uid: string): Promise<string> {
  return String((await db.collection('users').doc(uid).get()).data()?.role ?? 'user');
}

/** Anexo precisa estar na pasta de quem envia e ser imagem. */
async function assertAttachment(path: unknown, ownerUid: string): Promise<string> {
  if (typeof path !== 'string' || !path.startsWith(`support/${ownerUid}/`) || path.includes('..')) {
    throw new HttpsError('invalid-argument', 'Anexo inválido.');
  }
  try {
    const [meta] = await admin.storage().bucket().file(path).getMetadata();
    if (!String(meta.contentType ?? '').startsWith('image/')) {
      throw new HttpsError('invalid-argument', 'O anexo precisa ser uma imagem.');
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('failed-precondition', 'O anexo não terminou de enviar. Tente de novo.');
  }
  return path;
}

function parseAnswers(raw: unknown): Answer[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ANSWERS) {
    throw new HttpsError('invalid-argument', 'Responda o questionário.');
  }
  return raw.map((a: Record<string, unknown>) => {
    const answer: Answer = {
      questionId: str(a?.questionId, 60),
      question:   str(a?.question, MAX_LABEL),
      optionIds:  strArray(a?.optionIds, MAX_OPTIONS, 60),
      labels:     strArray(a?.labels, MAX_OPTIONS, MAX_LABEL),
      text:       str(a?.text, MAX_TEXT),
    };
    if (!answer.questionId || answer.optionIds.length === 0) {
      throw new HttpsError('invalid-argument', 'Questionário incompleto.');
    }
    if (answer.optionIds.includes('other') && !answer.text) {
      throw new HttpsError('invalid-argument', 'Descreva a opção "Outro".');
    }
    return answer;
  });
}

// ============================================
// ABRIR CHAMADO
// ============================================
export const createSupportTicket = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;
  await assertUserNotBlocked(uid);

  const d = (request.data ?? {}) as Record<string, unknown>;

  const category = str(d.category, 40);
  if (!CATEGORIES.has(category)) throw new HttpsError('invalid-argument', 'Assunto inválido.');

  const categoryLabel = str(d.categoryLabel, MAX_LABEL) || category;
  const answers       = parseAnswers(d.answers);
  const description   = str(d.description, MAX_TEXT);

  if (TEXT_REQUIRED_CATEGORIES.has(category) && !description) {
    throw new HttpsError('invalid-argument', 'Descreva o que você precisa.');
  }

  const reportedUid = typeof d.reportedUid === 'string' && UID_PATTERN.test(d.reportedUid) && d.reportedUid !== uid
    ? d.reportedUid : null;

  const attachmentPath = d.attachmentPath ? await assertAttachment(d.attachmentPath, uid) : null;

  const dev = (d.device ?? {}) as Record<string, unknown>;
  const device = {
    platform:       str(dev.platform, 20),
    osVersion:      str(dev.osVersion, 40),
    model:          str(dev.model, 60),
    appVersion:     str(dev.appVersion, 20),
    runtimeVersion: str(dev.runtimeVersion, 20),
  };

  const allOptions = answers.flatMap(a => a.optionIds);
  const priority: Priority = allOptions.some(o => URGENT_OPTIONS.has(o))
    ? 'urgent'
    : LOW_PRIORITY_CATEGORIES.has(category) ? 'low' : 'normal';

  const [userSnap, isPlus] = await Promise.all([
    db.collection('users').doc(uid).get(),
    isGalaxiaPlusActive(uid),
  ]);
  const user = userSnap.data() ?? {};

  const ticketRef = db.collection('supportTickets').doc();
  const summary   = answers.slice(0, 2).map(a => a.labels.join(', ')).filter(Boolean).join(' · ');

  await db.runTransaction(async (t) => {
    const active = await t.get(db.collection('supportTickets')
      .where('uid', '==', uid)
      .where('status', 'in', ACTIVE_STATUS)
      .limit(1));
    if (!active.empty) {
      throw new HttpsError(
        'failed-precondition',
        'Você já tem um chamado em andamento. Acompanhe por ele ou aguarde a resolução para abrir outro.',
      );
    }

    const now = FieldValue.serverTimestamp();
    t.set(ticketRef, {
      uid,
      userName:  String(user.name ?? ''),
      userPhoto: String(user.photoURL ?? ''),
      category, categoryLabel, answers, summary,
      description, reportedUid, attachmentPath, device,
      context: { role: String(user.role ?? 'user'), galaxiaPlus: isPlus },
      priority,
      status:         'open',
      unreadForUser:  false,
      unreadForAdmin: true,
      messagesCount:  description ? 1 : 0,
      lastMessageBy:  'user',
      createdAt: now, updatedAt: now, lastMessageAt: now,
    });

    if (description) {
      t.set(ticketRef.collection('messages').doc(), {
        author: 'user', authorUid: uid, text: description, attachmentPath, createdAt: now,
      });
    }
  });

  notifyAdmins({
    title: priority === 'urgent' ? '🚨 Chamado URGENTE' : '🆘 Novo chamado de suporte',
    body:  `${categoryLabel}${summary ? `: ${summary}` : ''}`.slice(0, 180),
    type:  'support_new',
    data:  { ticketId: ticketRef.id },
  }).catch(() => {});

  return { success: true, ticketId: ticketRef.id, priority };
});

// ============================================
// RESPONDER (usuário ou admin)
// ============================================
export const replySupportTicket = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  const d        = (request.data ?? {}) as Record<string, unknown>;
  const ticketId = assertTicketId(d.ticketId);
  const text     = str(d.text, MAX_TEXT);
  const isAdmin  = ADMIN_ROLES.has(await roleOf(uid));
  const ticketRef = db.collection('supportTickets').doc(ticketId);

  const attachmentPath = d.attachmentPath ? await assertAttachment(d.attachmentPath, uid) : null;
  if (!text && !attachmentPath) throw new HttpsError('invalid-argument', 'Escreva uma mensagem.');

  const result = await db.runTransaction(async (t) => {
    const snap = await t.get(ticketRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Chamado não encontrado.');
    const ticket = snap.data()!;

    const isOwner = ticket.uid === uid;
    if (!isOwner && !isAdmin) throw new HttpsError('permission-denied', 'Sem acesso a este chamado.');
    if (ticket.status === 'resolved') {
      throw new HttpsError('failed-precondition', 'Este chamado foi resolvido. Se precisar, abra um novo.');
    }
    if ((ticket.messagesCount ?? 0) >= MAX_MESSAGES) {
      throw new HttpsError('resource-exhausted', 'Este chamado atingiu o limite de mensagens.');
    }

    const author = isOwner ? 'user' : 'admin';
    if (!isOwner) await assertUserNotBlocked(uid).catch(() => undefined);

    const now = FieldValue.serverTimestamp();
    t.set(ticketRef.collection('messages').doc(), {
      author, authorUid: uid, text, attachmentPath, createdAt: now,
    });
    t.update(ticketRef, {
      status:         author === 'admin' ? 'answered' : 'open',
      unreadForUser:  author === 'admin',
      unreadForAdmin: author === 'user',
      lastMessageBy:  author,
      lastMessageAt:  now,
      updatedAt:      now,
      messagesCount:  FieldValue.increment(1),
    });

    return { author, ownerUid: String(ticket.uid), categoryLabel: String(ticket.categoryLabel ?? 'Suporte') };
  });

  if (result.author === 'admin') {
    notifyUser({
      userId: result.ownerUid,
      title:  '💬 O suporte respondeu',
      body:   (text || 'Você recebeu uma imagem.').slice(0, 140),
      type:   'support_reply',
      data:   { ticketId },
    }).catch(() => {});
  } else {
    notifyAdmins({
      title: '💬 Resposta em chamado',
      body:  `${result.categoryLabel}: ${(text || 'imagem enviada').slice(0, 120)}`,
      type:  'support_new',
      data:  { ticketId },
    }).catch(() => {});
  }

  return { success: true };
});

// ============================================
// RESOLVER (só admin, pelo painel)
// ============================================
export const resolveSupportTicket = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;
  if (!ADMIN_ROLES.has(await roleOf(uid))) throw new HttpsError('permission-denied', 'Acesso restrito.');

  const ticketId  = assertTicketId((request.data ?? {}).ticketId);
  const ticketRef = db.collection('supportTickets').doc(ticketId);

  const ownerUid = await db.runTransaction(async (t) => {
    const snap = await t.get(ticketRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Chamado não encontrado.');
    if (snap.data()!.status === 'resolved') throw new HttpsError('failed-precondition', 'Já está resolvido.');
    t.update(ticketRef, {
      status:         'resolved',
      resolvedAt:     FieldValue.serverTimestamp(),
      resolvedBy:     uid,
      unreadForAdmin: false,
      unreadForUser:  true,
      updatedAt:      FieldValue.serverTimestamp(),
    });
    return String(snap.data()!.uid);
  });

  notifyUser({
    userId: ownerUid,
    title:  '✅ Chamado resolvido',
    body:   'Seu chamado foi marcado como resolvido. Se precisar, é só abrir outro.',
    type:   'support_reply',
    data:   { ticketId },
  }).catch(() => {});

  return { success: true };
});

// ============================================
// MARCAR COMO LIDO (apaga o balão de quem abriu)
// ============================================
export const markSupportTicketRead = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;
  const ticketId  = assertTicketId((request.data ?? {}).ticketId);
  const ticketRef = db.collection('supportTickets').doc(ticketId);

  const snap = await ticketRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Chamado não encontrado.');
  const ticket = snap.data()!;

  if (ticket.uid === uid) {
    if (ticket.unreadForUser) await ticketRef.update({ unreadForUser: false });
  } else if (ADMIN_ROLES.has(await roleOf(uid))) {
    if (ticket.unreadForAdmin) await ticketRef.update({ unreadForAdmin: false });
  } else {
    throw new HttpsError('permission-denied', 'Sem acesso a este chamado.');
  }
  return { success: true };
});

// ============================================
// ANEXO (URL assinada de 5 min)
// ============================================
export const getSupportAttachmentUrl = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;
  const d = (request.data ?? {}) as Record<string, unknown>;
  const ticketId = assertTicketId(d.ticketId);
  const path     = str(d.path, 300);

  const ticketRef = db.collection('supportTickets').doc(ticketId);
  const snap = await ticketRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Chamado não encontrado.');
  const ticket = snap.data()!;

  if (ticket.uid !== uid && !ADMIN_ROLES.has(await roleOf(uid))) {
    throw new HttpsError('permission-denied', 'Sem acesso a este anexo.');
  }

  const belongs = ticket.attachmentPath === path || !(await ticketRef.collection('messages')
    .where('attachmentPath', '==', path).limit(1).get()).empty;
  if (!path || !belongs) throw new HttpsError('permission-denied', 'Anexo não pertence ao chamado.');

  const [url] = await admin.storage().bucket().file(path).getSignedUrl({
    action: 'read', expires: Date.now() + SIGNED_URL_MS,
  });
  return { url };
});