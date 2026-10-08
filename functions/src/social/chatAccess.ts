// ============================================
// LUMINA — LIBERAÇÃO DO CHAT
// functions/src/social/chatAccess.ts
//
// chatAccess/{chatId} existe ⇔ há pedido de conexão ACEITO entre os
// dois e nenhum bloqueou o outro. As Firestore Rules do chat exigem
// este documento — antes bastava o uid estar no id do chat, e
// qualquer conta abria conversa com qualquer pessoa pelo SDK.
//
// chatId = os dois uids em ordem, separados por "_" — o mesmo do
// generateChatId do app e do id usado pelo MatchService.
//
// Cobre os dois caminhos da conexão (decisão de produto: pedido
// aceito OU Sintonia mútua): o MatchService grava a Sintonia como
// pedido `accepted` (id sintonia_<a>_<b>), então um só gatilho basta.
//
// RECALCULA a partir da verdade em vez de confiar no evento: a ordem
// de entrega dos gatilhos não é garantida. Idempotente.
//
// As conexões anteriores a estes gatilhos foram migradas em
// 06/10/2026 pela função de uso único backfillChatAccess (4 pares),
// já removida.
//
// Escrita só pelo Admin SDK; as Rules fecham a coleção ao cliente.
// ============================================

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

export function chatIdFor(a: string, b: string): string {
  return [a, b].sort().join('_');
}

function isUid(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !value.includes('/');
}

async function hasAcceptedConnection(a: string, b: string): Promise<boolean> {
  const col = db.collection('connectionRequests');
  const [ab, ba] = await Promise.all([
    col.where('fromUserId', '==', a).where('toUserId', '==', b)
      .where('status', '==', 'accepted').limit(1).get(),
    col.where('fromUserId', '==', b).where('toUserId', '==', a)
      .where('status', '==', 'accepted').limit(1).get(),
  ]);
  return !ab.empty || !ba.empty;
}

async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const col = db.collection('blocks');
  const [ab, ba] = await Promise.all([
    col.where('blockerId', '==', a).where('blockedId', '==', b).limit(1).get(),
    col.where('blockerId', '==', b).where('blockedId', '==', a).limit(1).get(),
  ]);
  return !ab.empty || !ba.empty;
}

/** Grava ou apaga chatAccess conforme a situação atual do par. */
export async function syncChatAccess(a: string, b: string): Promise<'granted' | 'revoked'> {
  const ref = db.collection('chatAccess').doc(chatIdFor(a, b));
  const [connected, blocked] = await Promise.all([
    hasAcceptedConnection(a, b),
    isBlockedEitherWay(a, b),
  ]);

  if (connected && !blocked) {
    await ref.set(
      { members: [a, b].sort(), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return 'granted';
  }

  await ref.delete();
  return 'revoked';
}

// ── Pedido virou ou deixou de ser aceito (inclui a Sintonia) ──
export const onConnectionRequestWritten = onDocumentWritten(
  'connectionRequests/{requestId}',
  async (event) => {
    const before = event.data?.before.data();
    const after  = event.data?.after.data();

    const wasAccepted = before?.status === 'accepted';
    const isAccepted  = after?.status === 'accepted';
    if (wasAccepted === isAccepted) return;

    const data = after ?? before;
    const from = data?.fromUserId;
    const to   = data?.toUserId;
    if (!isUid(from) || !isUid(to) || from === to) return;

    const result = await syncChatAccess(from, to);
    console.log(`[chatAccess] pedido ${event.params.requestId} — ${chatIdFor(from, to)}: ${result}`);
  },
);

// ── Bloqueio criado ou desfeito ──
export const onBlockWritten = onDocumentWritten(
  'blocks/{blockId}',
  async (event) => {
    const data = event.data?.after.data() ?? event.data?.before.data();
    const a = data?.blockerId;
    const b = data?.blockedId;
    if (!isUid(a) || !isUid(b) || a === b) return;

    const result = await syncChatAccess(a, b);
    console.log(`[chatAccess] bloqueio ${event.params.blockId} — ${chatIdFor(a, b)}: ${result}`);
  },
);