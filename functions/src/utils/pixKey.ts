// ============================================
// LUMINA — CHAVE PIX (fonte única no servidor)
// functions/src/utils/pixKey.ts
//
// Validação, normalização e máscara da chave Pix, usadas pelo
// cadastro do criador (saveCreatorPixKey), pelo saque
// (requestWithdrawal) e pelo reembolso (requestRefund).
//
// ONDE A CHAVE MORA: users/{uid}/private/payout — área que as
// rules fecham para TODO cliente (nem o dono lê). Antes ficava em
// users/{uid}, documento lido por qualquer conta pelo feed: com
// chave CPF, qualquer usuário lia o CPF de qualquer criador.
//
// MIGRAÇÃO: readPayoutKey move a chave antiga do documento público
// para a área privada na primeira leitura, e apaga a cópia pública.
// Chave antiga inválida (o app podia gravar sem validar) não migra:
// é apagada e o criador cadastra de novo.
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export type PixKeyType = 'cpf' | 'email' | 'phone' | 'random';

export const PIX_KEY_TYPES: readonly PixKeyType[] = ['cpf', 'email', 'phone', 'random'];

export interface PayoutKey {
  pixKey:     string;
  pixKeyType: PixKeyType;
}

function isValidCpf(raw: string): boolean {
  const cpf = raw.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== parseInt(cpf[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === parseInt(cpf[10], 10);
}

const VALIDATORS: Record<PixKeyType, (v: string) => boolean> = {
  cpf:    isValidCpf,
  email:  v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
  phone:  v => {
    const d = v.replace(/\D/g, '').replace(/^55/, '');
    return d.length === 10 || d.length === 11;
  },
  random: v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim()),
};

const TYPE_ERROR: Record<PixKeyType, string> = {
  cpf:    'CPF inválido. Verifique os números.',
  email:  'E-mail inválido.',
  phone:  'Telefone inválido. Use DDD + número.',
  random: 'Chave aleatória inválida (deve ser um código no formato UUID).',
};

function normalizePixKey(type: PixKeyType, raw: string): string {
  const v = raw.trim();
  switch (type) {
    case 'cpf':    return v.replace(/\D/g, '');
    case 'phone':  return `+55${v.replace(/\D/g, '').replace(/^55/, '')}`;
    case 'email':  return v.toLowerCase();
    case 'random': return v.toLowerCase();
  }
}

function isPixKeyType(value: unknown): value is PixKeyType {
  return typeof value === 'string' && (PIX_KEY_TYPES as readonly string[]).includes(value);
}

/** Valida tipo e chave vindos do app e devolve a chave normalizada. */
export function parsePixKey(type: unknown, raw: unknown): PayoutKey {
  if (!isPixKeyType(type)) {
    throw new HttpsError('invalid-argument', 'Tipo de chave Pix inválido.');
  }
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 140) {
    throw new HttpsError('invalid-argument', 'Informe sua chave Pix.');
  }
  if (!VALIDATORS[type](raw)) {
    throw new HttpsError('invalid-argument', TYPE_ERROR[type]);
  }
  return { pixKey: normalizePixKey(type, raw), pixKeyType: type };
}

/** Máscara para exibir ao próprio dono ("123***89"). */
export function maskPixKey(key: string): string {
  return key.length > 4 ? `${key.slice(0, 3)}***${key.slice(-2)}` : '***';
}

export function payoutRef(uid: string): FirebaseFirestore.DocumentReference {
  return admin.firestore().collection('users').doc(uid).collection('private').doc('payout');
}

/** Chave de recebimento do criador, com migração do documento público. */
export async function readPayoutKey(uid: string): Promise<PayoutKey | null> {
  const db   = admin.firestore();
  const snap = await payoutRef(uid).get();
  const data = snap.data();

  if (data && typeof data.pixKey === 'string' && isPixKeyType(data.pixKeyType)) {
    return { pixKey: data.pixKey, pixKeyType: data.pixKeyType };
  }

  const userRef = db.collection('users').doc(uid);
  const user    = (await userRef.get()).data() ?? {};
  if (typeof user.pixKey !== 'string' || !user.pixKey) return null;

  const cleanupPublic = {
    pixKey:           FieldValue.delete(),
    pixKeyType:       FieldValue.delete(),
    pixKeyVerifiedAt: FieldValue.delete(),
  };

  const legacyType = user.pixKeyType;
  const valid = isPixKeyType(legacyType) && VALIDATORS[legacyType](user.pixKey);

  if (!valid) {
    await userRef.update({ ...cleanupPublic, paymentSetupStatus: FieldValue.delete() });
    return null;
  }

  const key: PayoutKey = {
    pixKey:     normalizePixKey(legacyType as PixKeyType, user.pixKey),
    pixKeyType: legacyType as PixKeyType,
  };

  const batch = db.batch();
  batch.set(payoutRef(uid), { ...key, updatedAt: FieldValue.serverTimestamp(), migratedFromProfile: true });
  batch.update(userRef, cleanupPublic);
  await batch.commit();

  return key;
}