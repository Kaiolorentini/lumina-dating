// ============================================
// LUMINA — PRÉ-CADASTRO DA LANDING
// functions/src/preRegistration/registerPreSignup.ts
//
// Chamada pelo site depois que a conta foi criada no Firebase Auth.
// Grava preRegistrations/{uid} — NÃO cria users/{uid}: no lançamento
// a pessoa entra no app e passa pelo gate normal (termos → perfil →
// verificação +18), e o acceptAppTerms semeia o documento users.
//
// - Autenticação obrigatória (o uid vem do token, nunca do cliente)
// - Validação completa no servidor
// - Idempotente: um documento por uid; reenviar não duplica nem
//   consome nova vaga. Único caso que altera: upgrade user → creator
// - Vaga de Criador Fundador atribuída dentro da transação
// - E-mail NÃO é copiado: já está no Auth (minimização, LGPD)
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  PRE_REGISTRATION_COLLECTION,
  CREATOR_FOUNDER_COUNTER_PATH,
  CREATOR_FOUNDER_LIMIT,
  PRE_REGISTRATION_CONSENT_VERSION,
  PRE_REGISTRATION_CATEGORIES,
  PreRegistrationCategory,
  PreRegistrationType,
} from '../config/preRegistration';

interface PreSignupInput {
  type: PreRegistrationType;
  name: string;
  handle: string | null;
  category: PreRegistrationCategory | null;
  utm: Record<string, string>;
}

interface PreSignupResult {
  ok: true;
  type: PreRegistrationType;
  creatorFounder: boolean;
  creatorFounderNumber: number | null;
}

// Letras latinas com acento (português), espaço, apóstrofo, ponto e hífen.
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' .-]{1,59}$/;
const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;
const UTM_VALUE_RE = /^[\w .:/+-]{1,100}$/;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function invalid(message: string): never {
  throw new HttpsError('invalid-argument', message);
}

function parseInput(raw: unknown): PreSignupInput {
  if (typeof raw !== 'object' || raw === null) invalid('Dados do cadastro ausentes.');
  const data = raw as Record<string, unknown>;

  const type = data.type;
  if (type !== 'user' && type !== 'creator') invalid('Tipo de cadastro inválido.');

  const name = asString(data.name).trim().replace(/\s+/g, ' ');
  if (!NAME_RE.test(name)) invalid('Digite seu nome (de 2 a 60 letras).');

  if (data.ageConfirmed !== true) invalid('Confirme que você tem 18 anos ou mais.');

  if (data.consentVersion !== PRE_REGISTRATION_CONSENT_VERSION) {
    throw new HttpsError('failed-precondition', 'O texto de consentimento foi atualizado. Recarregue a página e tente de novo.');
  }

  let handle: string | null = null;
  let category: PreRegistrationCategory | null = null;

  if (type === 'creator') {
    const rawHandle = asString(data.handle).trim().replace(/^@/, '');
    if (rawHandle) {
      if (!HANDLE_RE.test(rawHandle)) invalid('O @ só pode ter letras, números, ponto e sublinhado.');
      handle = rawHandle.toLowerCase();
    }
    const rawCategory = asString(data.category);
    if (!(PRE_REGISTRATION_CATEGORIES as readonly string[]).includes(rawCategory)) {
      invalid('Escolha o tipo de conteúdo.');
    }
    category = rawCategory as PreRegistrationCategory;
  }

  // UTM é opcional e informativa: valor fora do padrão é descartado, não recusado.
  const utm: Record<string, string> = {};
  const rawUtm = typeof data.utm === 'object' && data.utm !== null ? (data.utm as Record<string, unknown>) : {};
  UTM_KEYS.forEach((key) => {
    const v = asString(rawUtm[key]).trim();
    if (v && UTM_VALUE_RE.test(v)) utm[key] = v;
  });

  return { type, name, handle, category, utm };
}

export const registerPreSignup = onCall({ maxInstances: 10 }, async (request): Promise<PreSignupResult> => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Crie sua conta antes de concluir o pré-cadastro.');
  }
  const uid = request.auth.uid;

  // Campo isca: invisível para pessoas, preenchido por robôs.
  // Responde como sucesso para não ensinar o robô, e não grava nada.
  const honeypot = asString((request.data as Record<string, unknown> | null)?.website);
  if (honeypot) {
    logger.warn('[registerPreSignup] honeypot preenchido', { uid });
    return { ok: true, type: 'user', creatorFounder: false, creatorFounderNumber: null };
  }

  const input = parseInput(request.data);

  const db = getFirestore();
  const ref = db.collection(PRE_REGISTRATION_COLLECTION).doc(uid);
  const counterRef = db.doc(CREATOR_FOUNDER_COUNTER_PATH);

  try {
    const result = await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const existing = snap.exists ? snap.data() ?? {} : null;
      const existingType: PreRegistrationType | null =
        existing?.type === 'creator' ? 'creator' : existing?.type === 'user' ? 'user' : null;

      // Idempotência: já é criador, ou já existe e o pedido é de usuário.
      if (existing && (existingType === 'creator' || input.type === 'user')) {
        return {
          created: false,
          upgraded: false,
          type: existingType ?? input.type,
          creatorFounder: existing.creatorFounder === true,
          creatorFounderNumber: typeof existing.creatorFounderNumber === 'number' ? existing.creatorFounderNumber : null,
        };
      }

      let creatorFounder = false;
      let creatorFounderNumber: number | null = null;

      if (input.type === 'creator') {
        // Leitura antes de qualquer escrita (exigência das transações).
        const counterSnap = await t.get(counterRef);
        const count = Number(counterSnap.get('count')) || 0;
        if (count < CREATOR_FOUNDER_LIMIT) {
          creatorFounderNumber = count + 1;
          creatorFounder = true;
          t.set(counterRef, { count: creatorFounderNumber, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
      }

      const consent = {
        version: PRE_REGISTRATION_CONSENT_VERSION,
        ageConfirmed: true,
        acceptedAt: FieldValue.serverTimestamp(),
      };

      if (existing) {
        // Upgrade user → creator: mantém createdAt e a origem do primeiro cadastro.
        t.update(ref, {
          type: 'creator',
          name: input.name,
          handle: input.handle,
          category: input.category,
          creatorFounder,
          creatorFounderNumber,
          consent,
          upgradedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        t.set(ref, {
          uid,
          type: input.type,
          name: input.name,
          handle: input.handle,
          category: input.category,
          creatorFounder,
          creatorFounderNumber,
          consent,
          utm: input.utm,
          source: 'landing',
          status: 'pending', // o app marca como vinculado no primeiro acesso após o lançamento
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      return {
        created: !existing,
        upgraded: Boolean(existing),
        type: input.type,
        creatorFounder,
        creatorFounderNumber,
      };
    });

    logger.info('[registerPreSignup] ok', {
      uid,
      type: result.type,
      created: result.created,
      upgraded: result.upgraded,
      creatorFounder: result.creatorFounder,
      creatorFounderNumber: result.creatorFounderNumber,
    });

    return {
      ok: true,
      type: result.type,
      creatorFounder: result.creatorFounder,
      creatorFounderNumber: result.creatorFounderNumber,
    };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('[registerPreSignup] falha na transação', {
      uid,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new HttpsError('internal', 'Não foi possível concluir o pré-cadastro agora.');
  }
});