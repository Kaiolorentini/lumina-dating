// ============================================
// SAVE CREATOR PIX KEY v2 — chave de recebimento do criador
// functions/src/payments/saveCreatorPixKey.ts
//
// v2 (28/09): a chave vai para users/{uid}/private/payout, fechada
// a todo cliente. Antes ficava em users/{uid}, lido por qualquer
// conta — e com chave CPF, o CPF do criador ficava exposto.
//
// getMyPixKeyStatus: o dono vê a chave MASCARADA, pelo servidor
// (a área privada não é legível nem por ele).
//
// A validação de FORMATO evita erro de digitação, mas NÃO confirma
// titularidade: o admin confere os dados antes de transferir.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { assertAuthenticated } from '../utils/adminGuard';
import { assertUserNotBlocked } from '../utils/assertUserNotBlocked';
import { createAuditLog } from '../utils/auditLog';
import { parsePixKey, maskPixKey, payoutRef, readPayoutKey } from '../utils/pixKey';

export const saveCreatorPixKey = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  await assertUserNotBlocked(uid);

  const { pixKey, pixKeyType } = (request.data ?? {}) as { pixKey?: unknown; pixKeyType?: unknown };
  const key = parsePixKey(pixKeyType, pixKey);

  const db      = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const snap    = await userRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Usuário não encontrado.');

  const batch = db.batch();
  batch.set(payoutRef(uid), { ...key, updatedAt: FieldValue.serverTimestamp() });
  batch.update(userRef, {
    // Só o status fica no documento público — a chave não.
    paymentSetupStatus: 'configured',
    pixKey:             FieldValue.delete(),
    pixKeyType:         FieldValue.delete(),
    pixKeyVerifiedAt:   FieldValue.delete(),
  });
  await batch.commit();

  createAuditLog({
    action: 'pix_key_saved',
    performedBy: uid,
    targetId: uid,
    targetType: 'user',
    metadata: { pixKeyType: key.pixKeyType },
    req: request.rawRequest,
  }).catch(() => {});

  return { valid: true, pixKeyType: key.pixKeyType, maskedKey: maskPixKey(key.pixKey) };
});

/** Chave do próprio criador, mascarada. */
export const getMyPixKeyStatus = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  const key = await readPayoutKey(uid);
  if (!key) return { configured: false };

  return { configured: true, pixKeyType: key.pixKeyType, maskedKey: maskPixKey(key.pixKey) };
});