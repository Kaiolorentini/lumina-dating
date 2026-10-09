// ============================================
// LUMINA — EXCLUSÃO DE CONTA (auditoria A5)
// functions/src/users/accountDeletion.ts
//
// Exigida pelo Google Play (dentro do app e por link na web) e pela
// LGPD, art. 18. Decisões de produto (Kaio, 06/10/2026):
//   • exclusão na hora, sem volta;
//   • vendas, compras e registros financeiros: ANONIMIZADOS e
//     guardados (obrigação fiscal);
//   • criadora com saldo a receber ou saque em andamento: exclusão
//     BLOQUEADA até o saque;
//   • conversas somem para os dois lados;
//   • avaliações ficam, com autor "Usuário removido" — e com id
//     NOVO (anon_<hash>_<produto>): o id antigo carregava o uid.
//
// DUAS FASES
//   1. deleteMyAccount (callable): confere login recente, saldo e
//      saque; DESATIVA a conta no Auth, derruba as sessões e grava
//      accountDeletions/{uid}.
//   2. processAccountDeletion (gatilho, retry): apaga e anonimiza
//      tudo e, por ÚLTIMO, apaga a conta no Auth. Cada passo é
//      idempotente — se cair no meio, a nova tentativa continua.
//
// Anonimizar = trocar o uid por anon_<hash> (irreversível) e remover
// nome, foto e chave Pix do registro.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import {
  FieldPath, FieldValue, Query, QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { createHash } from 'crypto';
import { isSuperAdmin } from '../utils/adminGuard';
import { chatIdFor } from '../social/chatAccess';

const db = admin.firestore();

const RECENT_LOGIN_SECONDS = 5 * 60;
const PAGE                 = 300;
const GIVE_UP_AFTER_MS     = 24 * 3600 * 1000;
const REMOVED_NAME         = 'Usuário removido';

export function anonIdFor(uid: string): string {
  return 'anon_' + createHash('sha256').update(`lumina:${uid}`).digest('hex').slice(0, 24);
}

const col = (name: string) => db.collection(name);

// ── Paginação por cursor: termina mesmo quando o patch não tira o
// documento do filtro, e nunca carrega a coleção inteira. ──
async function forEachPage(
  query: Query,
  pageSize: number,
  fn: (docs: QueryDocumentSnapshot[]) => Promise<void>,
): Promise<number> {
  let last: QueryDocumentSnapshot | null = null;
  let total = 0;

  for (;;) {
    let q = query.orderBy(FieldPath.documentId()).limit(pageSize);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) return total;

    await fn(snap.docs);
    total += snap.size;
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) return total;
  }
}

async function deleteWhere(collection: string, field: string, uid: string): Promise<number> {
  return forEachPage(col(collection).where(field, '==', uid), PAGE, async (docs) => {
    const batch = db.batch();
    docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  });
}

async function deleteWhereRecursive(collection: string, field: string, uid: string): Promise<number> {
  return forEachPage(col(collection).where(field, '==', uid), 50, async (docs) => {
    for (const d of docs) await db.recursiveDelete(d.ref);
  });
}

/** Documentos cujo id começa com "<uid>_" (controles diários, ranking). */
async function deleteByIdPrefix(collection: string, uid: string): Promise<number> {
  const prefix = `${uid}_`;
  const query = col(collection)
    .where(FieldPath.documentId(), '>=', prefix)
    .where(FieldPath.documentId(), '<', `${prefix}\uf8ff`);
  return forEachPage(query, PAGE, async (docs) => {
    const batch = db.batch();
    docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  });
}

async function anonymizeWhere(
  collection: string,
  field: string,
  uid: string,
  patch: Record<string, unknown>,
): Promise<number> {
  return forEachPage(col(collection).where(field, '==', uid), PAGE, async (docs) => {
    const batch = db.batch();
    docs.forEach(d => batch.update(d.ref, patch));
    await batch.commit();
  });
}

/**
 * Avaliações: a nota continua valendo na média do produto, mas o
 * documento é RECRIADO com id do pseudônimo. Anonimizar só os
 * campos deixaria o uid no id (`<uid>_<produto>`).
 * 200 por página: cada avaliação são 2 operações no batch (limite 500).
 * Idempotente: o que já foi movido sai do filtro userId == uid.
 */
async function moveReviewsToAnon(uid: string, anonId: string): Promise<number> {
  return forEachPage(col('productReviews').where('userId', '==', uid), 200, async (docs) => {
    const batch = db.batch();
    docs.forEach(d => {
      const data = d.data();
      const productId = typeof data.productId === 'string' && data.productId ? data.productId : d.id;
      const rest: Record<string, unknown> = { ...data };
      delete rest.userPhoto;
      batch.set(col('productReviews').doc(`${anonId}_${productId}`), {
        ...rest,
        userId:       anonId,
        userName:     REMOVED_NAME,
        anonymizedAt: FieldValue.serverTimestamp(),
      });
      batch.delete(d.ref);
    });
    await batch.commit();
  });
}

async function deleteDocRecursive(collection: string, id: string): Promise<void> {
  await db.recursiveDelete(col(collection).doc(id));
}

async function deleteStoragePrefix(prefix: string): Promise<void> {
  await admin.storage().bucket().deleteFiles({ prefix, force: true });
}

function pendingCreatorBalance(wallet: Record<string, unknown> | undefined): number {
  if (!wallet) return 0;
  // Todo campo *Balance conta, menos a dívida (que é do criador
  // com a plataforma, não a receber).
  return Object.entries(wallet)
    .filter(([key]) => key.endsWith('Balance') && key !== 'debtBalance')
    .reduce((sum, [, value]) => sum + Math.max(0, Number(value) || 0), 0);
}

// ============================================
// FASE 1 — PEDIDO
// ============================================
export const deleteMyAccount = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

  // Login recente: um token roubado ou um celular destravado não
  // bastam. O app reautentica com a senha antes de chamar.
  const authTime = Number(request.auth?.token.auth_time ?? 0);
  if (!authTime || Date.now() / 1000 - authTime > RECENT_LOGIN_SECONDS) {
    throw new HttpsError('failed-precondition', 'Confirme sua senha novamente para excluir a conta.');
  }

  if (await isSuperAdmin(uid)) {
    throw new HttpsError('failed-precondition', 'Conta de administração não pode ser excluída pelo app.');
  }

  const [walletSnap, openWithdrawals] = await Promise.all([
    col('creatorWallets').doc(uid).get(),
    col('withdrawals')
      .where('userId', '==', uid)
      .where('status', 'in', ['pending', 'approved'])
      .limit(1)
      .get(),
  ]);

  const toReceive = pendingCreatorBalance(walletSnap.data());
  if (toReceive > 0) {
    throw new HttpsError(
      'failed-precondition',
      `Você tem R$ ${toReceive.toFixed(2).replace('.', ',')} a receber. Faça o saque em Meus Ganhos antes de excluir a conta.`,
    );
  }
  if (!openWithdrawals.empty) {
    throw new HttpsError(
      'failed-precondition',
      'Você tem um saque em andamento. Aguarde o pagamento antes de excluir a conta.',
    );
  }

  // Desativa ANTES de gravar o pedido: o gatilho apaga a conta no
  // Auth, e desativar depois falharia com usuário inexistente.
  await admin.auth().updateUser(uid, { disabled: true });
  await admin.auth().revokeRefreshTokens(uid);

  try {
    await col('accountDeletions').doc(uid).create({
      requestedAt: FieldValue.serverTimestamp(),
      anonId:      anonIdFor(uid),
    });
  } catch (error) {
    // Já pedido antes (toque duplo): o processamento já está em curso.
    const code = (error as { code?: number | string })?.code;
    if (code !== 6 && code !== 'already-exists') throw error;
  }

  console.log(`[deleteMyAccount] pedido registrado — ${anonIdFor(uid)}`);
  return { success: true };
});

// ============================================
// FASE 2 — PROCESSAMENTO
// ============================================
async function runDeletion(uid: string, anonId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const add = (key: string, n: number) => { counts[key] = (counts[key] ?? 0) + n; };

  // ── 1. Parceiros de conversa, ANTES de apagar conexões e curtidas ──
  const partners = new Set<string>();
  const collectPartner = (value: unknown) => {
    if (typeof value === 'string' && value && value !== uid) partners.add(value);
  };
  await forEachPage(col('connectionRequests').where('fromUserId', '==', uid), PAGE,
    async docs => docs.forEach(d => collectPartner(d.get('toUserId'))));
  await forEachPage(col('connectionRequests').where('toUserId', '==', uid), PAGE,
    async docs => docs.forEach(d => collectPartner(d.get('fromUserId'))));
  await forEachPage(col('likes').where('fromUid', '==', uid), PAGE,
    async docs => docs.forEach(d => collectPartner(d.get('toUid'))));
  await forEachPage(col('likes').where('toUid', '==', uid), PAGE,
    async docs => docs.forEach(d => collectPartner(d.get('fromUid'))));

  // Conversas somem para os dois lados.
  for (const partner of partners) {
    const chatId = chatIdFor(uid, partner);
    await db.recursiveDelete(col('chats').doc(chatId));
    await col('sintonias').doc(chatId).delete();
    await col('chatAccess').doc(chatId).delete();
  }
  add('conversas', partners.size);

  // ── 2. Produtos da criadora ──
  const bucket = admin.storage().bucket();
  add('produtos', await forEachPage(col('products').where('ownerId', '==', uid), 50, async (docs) => {
    for (const d of docs) {
      const sold = !(await col('sales').where('productId', '==', d.id).limit(1).get()).empty;
      if (sold) {
        // Quem comprou mantém o acesso: o produto sai da venda e o
        // dono vira anônimo; os arquivos ficam.
        await d.ref.update({
          ownerId:      anonId,
          isDeleted:    true,
          ownerDeleted: true,
          deletedAt:    FieldValue.serverTimestamp(),
        });
      } else {
        await bucket.deleteFiles({ prefix: `marketplace/products/${d.id}/`, force: true });
        await db.recursiveDelete(col('productAnalytics').doc(d.id));
        await db.recursiveDelete(d.ref);
      }
    }
  }));

  // ── 3. Anonimizar (registros fiscais, contábeis e de auditoria) ──
  const anon = { uid: anonId };
  add('vendas', await anonymizeWhere('sales', 'buyerId', uid, { buyerId: anonId }));
  add('vendas', await anonymizeWhere('sales', 'sellerId', uid, { sellerId: anonId }));
  add('saques', await anonymizeWhere('withdrawals', 'userId', uid, {
    userId: anonId, pixKey: FieldValue.delete(), pixType: FieldValue.delete(),
  }));
  add('reembolsos', await anonymizeWhere('refundRequests', 'buyerId', uid, {
    buyerId: anonId, pixKey: FieldValue.delete(), pixKeyType: FieldValue.delete(),
  }));
  add('cuponsUsados', await anonymizeWhere('couponUses', 'userId', uid, { userId: anonId }));
  add('transacoesCriador', await anonymizeWhere('creatorTransactions', 'userId', uid, { userId: anonId }));
  for (const field of ['uid', 'userId']) {
    add('logsCarteiraCriador', await anonymizeWhere('creatorWalletLogs', field, uid, { [field]: anonId }));
    add('fraudes', await anonymizeWhere('fraudFlags', field, uid, { [field]: anonId }));
  }
  for (const collection of [
    'economyLedger', 'walletAuditLogs', 'premiumUsageLog', 'premiumAnalytics',
    'coinsPurchases', 'achievementLog', 'eventLedger', 'eventDeadLetterQueue',
  ]) {
    add(collection, await anonymizeWhere(collection, 'uid', uid, anon));
  }
  add('auditoria', await anonymizeWhere('auditLogs', 'performedBy', uid, { performedBy: anonId }));
  add('auditoria', await anonymizeWhere('auditLogs', 'targetId', uid, { targetId: anonId }));
  add('avaliacoes', await moveReviewsToAnon(uid, anonId));

  // Aceite dos termos: prova de consentimento, movida para o pseudônimo.
  const termsRef  = col('termsAcceptances').doc(uid);
  const termsSnap = await termsRef.get();
  if (termsSnap.exists) {
    const target  = col('termsAcceptances').doc(anonId);
    const history = await termsRef.collection('history').get();
    const batch   = db.batch();
    batch.set(target, { ...termsSnap.data(), uid: anonId, anonymizedAt: FieldValue.serverTimestamp() });
    history.docs.forEach(h => {
      batch.set(target.collection('history').doc(h.id), { ...h.data(), uid: anonId });
    });
    await batch.commit();
    await db.recursiveDelete(termsRef);
    add('termos', 1);
  }

  // ── 4. Apagar por campo ──
  const byField: Array<[string, string]> = [
    ['dailyMissions', 'uid'], ['xpLog', 'uid'], ['notifications', 'userId'],
    ['favorites', 'userId'], ['downloads', 'userId'],
    ['achievementTriggers', 'uid'], ['achievementAnalytics', 'uid'], ['gamificationAnalytics', 'uid'],
    ['likes', 'fromUid'], ['likes', 'toUid'], ['likes', 'likerUid'],
    ['profile_visits', 'visitorId'], ['profile_visits', 'profileId'],
    ['connectionRequests', 'fromUserId'], ['connectionRequests', 'toUserId'],
    ['blocks', 'blockerId'], ['blocks', 'blockedId'],
    ['triggerSecrets', 'userId'], ['triggerSecrets', 'visitorId'],
    ['pendingLostSintonia', 'profileId'], ['pendingLostSintonia', 'visitorId'],
    ['screenshotEvents', 'userId'], ['destaqueWaitlist', 'uid'],
    ['mediaItems', 'uploadedBy'], ['creatorRequests', 'userId'],
    ['purchases', 'buyerId'], ['vaultControl', 'targetUid'],
  ];
  for (const [collection, field] of byField) {
    add(collection, await deleteWhere(collection, field, uid));
  }
  add('supportTickets', await deleteWhereRecursive('supportTickets', 'uid', uid));

  // ── 5. Apagar por prefixo do id (<uid>_...) ──
  for (const collection of [
    'weeklyRanking', 'rankingReview', 'rankingAnalytics', 'pushRateLimit',
    'vaultControl', 'visitFarmControl', 'triggerControl',
  ]) {
    add(collection, await deleteByIdPrefix(collection, uid));
  }

  // ── 6. Documentos com id = uid (com subcoleções) ──
  for (const collection of [
    'wallets', 'dailyRewards', 'dailyFaisca', 'destinyCards', 'prestige',
    'galaxiaPlus', 'visitorsAccess', 'profile_visit_counts', 'offerLog',
    'activeOffers', 'contentAccessLogs', 'ageVerifications', 'creatorWallets',
    'preRegistrations',
    // Resumo do Painel do Criador (09/10/2026) — com as marcas.
    'creatorStats',
  ]) {
    await deleteDocRecursive(collection, uid);
  }

  // ── 7. Storage ──
  for (const prefix of [
    `profile_photos/${uid}/`, `age_verification/${uid}/`, `support/${uid}/`, `users/${uid}/`,
  ]) {
    await deleteStoragePrefix(prefix);
  }

  // ── 8. Perfil por último entre os dados ──
  await deleteDocRecursive('users', uid);

  return counts;
}

export const processAccountDeletion = onDocumentCreated(
  { document: 'accountDeletions/{uid}', retry: true, timeoutSeconds: 540, memory: '512MiB' },
  async (event) => {
    const uid    = event.params.uid;
    const anonId = anonIdFor(uid);

    // Nova tentativa por até 24 h; depois disso, para e registra.
    if (Date.now() - new Date(event.time).getTime() > GIVE_UP_AFTER_MS) {
      console.error(`[processAccountDeletion] desistiu após 24 h — ${anonId}`);
      return;
    }

    const counts = await runDeletion(uid, anonId);

    try {
      await admin.auth().deleteUser(uid);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== 'auth/user-not-found') throw error;
    }

    await col('accountDeletionLog').doc(anonId).set({
      anonId,
      requestedAt: event.data?.get('requestedAt') ?? null,
      completedAt: FieldValue.serverTimestamp(),
      counts,
    });
    await event.data?.ref.delete();

    console.log(`[processAccountDeletion] concluída — ${anonId}`, JSON.stringify(counts));
  },
);


