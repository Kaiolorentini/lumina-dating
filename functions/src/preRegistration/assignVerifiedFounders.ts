// ============================================
// LUMINA — PRÉ-CADASTRO DA LANDING
// functions/src/preRegistration/assignVerifiedFounders.ts
//
// Garante a vaga de Criador Fundador SOZINHO, sem a pessoa voltar ao
// site: a cada 5 minutos, procura pré-cadastros de criador esperando a
// confirmação do e-mail, pergunta ao Firebase Auth quem já clicou no
// link e concede a vaga.
//
// Por que agendada e não no clique do link:
//   - o Firebase Auth não dispara evento quando o e-mail é confirmado;
//   - um manipulador próprio do link mudaria o modelo de e-mail do
//     projeto inteiro (inclusive a redefinição de senha do app).
//
// Ordem justa: entre os confirmados de cada rodada, quem se cadastrou
// primeiro recebe o número menor.
//
// Segurança e idempotência:
//   - a confirmação do e-mail vem do Auth (Admin SDK), nunca do cliente;
//   - cada vaga é concedida numa transação que relê o pré-cadastro e o
//     contador: rodadas sobrepostas ou a ação 'confirm' da callable não
//     concedem duas vagas para a mesma pessoa nem passam do limite.
//
// Custo: 1 consulta por rodada (mínimo de 1 leitura quando não há
// ninguém esperando) + 1 transação por pessoa confirmada.
// Sem índice composto: o filtro é de igualdade num campo só e a ordem
// por createdAt é feita em memória.
// ============================================

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  PRE_REGISTRATION_COLLECTION,
  CREATOR_FOUNDER_COUNTER_PATH,
  CREATOR_FOUNDER_LIMIT,
} from '../config/preRegistration';

// Teto por rodada. Se a fila passar disso, o resto entra na próxima.
const MAX_PER_RUN = 500;
// Limite do getUsers do Admin SDK por chamada.
const AUTH_BATCH = 100;

interface Waiting {
  uid: string;
  createdAtMs: number;
}

function millis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : Number.MAX_SAFE_INTEGER;
}

async function verifiedUids(uids: string[]): Promise<Set<string>> {
  const verified = new Set<string>();
  for (let i = 0; i < uids.length; i += AUTH_BATCH) {
    const chunk = uids.slice(i, i + AUTH_BATCH).map((uid) => ({ uid }));
    const { users } = await getAuth().getUsers(chunk);
    users.forEach((u) => {
      if (u.emailVerified && !u.disabled) verified.add(u.uid);
    });
  }
  return verified;
}

type Outcome = 'founder' | 'sold_out' | 'skipped';

async function grantSlot(uid: string): Promise<{ outcome: Outcome; number: number | null }> {
  const db = getFirestore();
  const ref = db.collection(PRE_REGISTRATION_COLLECTION).doc(uid);
  const counterRef = db.doc(CREATOR_FOUNDER_COUNTER_PATH);

  return db.runTransaction(async (t) => {
    const [snap, counterSnap] = await Promise.all([t.get(ref), t.get(counterRef)]);
    const data = snap.data();
    // Outra rodada, ou a ação 'confirm' da callable, já resolveu.
    if (!data || data.type !== 'creator' || data.status !== 'awaiting_email' || data.creatorFounder === true) {
      return { outcome: 'skipped' as const, number: null };
    }

    const count = Number(counterSnap.get('count')) || 0;
    const slot = count < CREATOR_FOUNDER_LIMIT ? count + 1 : null;
    if (slot !== null) {
      t.set(counterRef, { count: slot, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    t.update(ref, {
      creatorFounder: slot !== null,
      creatorFounderNumber: slot,
      status: 'pending',
      emailVerifiedAt: FieldValue.serverTimestamp(),
      founderAssignedBy: 'schedule',
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { outcome: slot !== null ? ('founder' as const) : ('sold_out' as const), number: slot };
  });
}

export const assignVerifiedFounders = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'America/Sao_Paulo',
    maxInstances: 1,
    retryCount: 0, // a próxima rodada já é a nova tentativa
    timeoutSeconds: 120,
  },
  async () => {
    const snap = await getFirestore()
      .collection(PRE_REGISTRATION_COLLECTION)
      .where('status', '==', 'awaiting_email')
      .limit(MAX_PER_RUN)
      .get();

    if (snap.empty) return;

    const waiting: Waiting[] = snap.docs
      .filter((d) => d.get('type') === 'creator')
      .map((d) => ({ uid: d.id, createdAtMs: millis(d.get('createdAt')) }));

    const verified = await verifiedUids(waiting.map((w) => w.uid));
    const ready = waiting
      .filter((w) => verified.has(w.uid))
      .sort((a, b) => a.createdAtMs - b.createdAtMs);

    let founders = 0;
    let soldOut = 0;
    let failed = 0;
    for (const w of ready) {
      try {
        const { outcome, number } = await grantSlot(w.uid);
        if (outcome === 'founder') {
          founders += 1;
          logger.info('[assignVerifiedFounders] vaga concedida', { uid: w.uid, creatorFounderNumber: number });
        } else if (outcome === 'sold_out') {
          soldOut += 1;
        }
      } catch (err) {
        // Uma falha não derruba a rodada: a pessoa continua em
        // awaiting_email e entra na próxima.
        failed += 1;
        logger.error('[assignVerifiedFounders] falha ao conceder vaga', {
          uid: w.uid,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('[assignVerifiedFounders] rodada concluída', {
      waiting: waiting.length,
      verified: ready.length,
      founders,
      soldOut,
      failed,
    });
  },
);