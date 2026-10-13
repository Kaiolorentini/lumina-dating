// ============================================
// LUMINA — PERFIL PÚBLICO
// functions/src/users/publicProfiles.ts
//
// 12/10/2026 — fecha o vazamento CRÍTICO da análise da Sintonia.
// O feed, o Sintonize e as telas de chat liam o documento users
// INTEIRO de outras pessoas, e a regra deixava qualquer conta
// verificada baixar a base toda: e-mail, data de nascimento do
// documento, moderação, boosts comprados, quem a pessoa passou...
//
// Agora existe publicProfiles/{uid}, gravado SÓ por este gatilho,
// com a LISTA BRANCA abaixo. O app lê o perfil de outras pessoas
// daqui; users/{uid} fica restrito ao dono e aos admins.
//
// • Só perfil LISTÁVEL tem documento público: verificação de idade
//   aprovada, conta não encerrada, nome, idade e gênero preenchidos.
//   Perdeu a condição (ban, exclusão) → o público é apagado.
// • O gatilho compara a projeção de antes e de depois e só grava
//   quando um campo público mudou: XP, carteira e progressão mudam o
//   users o tempo todo e não podem virar gravação aqui.
// • `seeks` = gêneros pelos quais a pessoa se interessa (derivado
//   das preferências). É o que deixa o feed buscar primeiro quem tem
//   interesse MÚTUO direto na consulta.
// • 13/10/2026: randomSeed nunca falta no público (feedSeed).
//
// Preenchimento inicial: crie no Console do Firestore o documento
// adminJobs/{qualquer id} com { type: "rebuildPublicProfiles" }.
// O gatilho onAdminJobCreated refaz todos e grava o resultado nele.
// ============================================

import { onDocumentWritten, onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { seeksFromPreferences } from '../config/sintoniaFormula';
import { sanitizeInterests } from '../config/interestsCatalog';
import { runUserFieldsAudit } from './userFieldsAudit';

export const PUBLIC_PROFILES = 'publicProfiles';

type Data = Record<string, unknown>;

function str(value: unknown, max: number): string | null {
  return typeof value === 'string' && value ? value.slice(0, max) : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Posição no feed sorteado. Conta sem randomSeed (antiga, ou reduzida
 * pela limpeza) ficava invisível: a busca é por faixa de randomSeed.
 * Sem o campo, usamos um número FIXO tirado do uid (hash FNV-1a) —
 * estável, sem gravar no users e sem a pessoa poder escolher.
 */
function feedSeed(uid: string, value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1) return value;
  let hash = 0x811c9dc5;
  for (let i = 0; i < uid.length; i++) {
    hash ^= uid.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 0x100000000;
}

function ts(value: unknown): Timestamp | null {
  return value instanceof Timestamp ? value : null;
}

/** Boost: só prazo, força e região — nada da compra. */
function boost(value: unknown, withRegion: boolean): Data | null {
  if (!value || typeof value !== 'object') return null;
  const b = value as Data;
  const out: Data = { expiresAt: ts(b.expiresAt), boostScore: num(b.boostScore) ?? 0 };
  if (withRegion) out.regiaoId = str(b.regiaoId, 7);
  return out;
}

/** O perfil aparece para outras pessoas? Espelha isListableProfile do app. */
export function isListable(data: Data | undefined): boolean {
  if (!data) return false;
  return data.ageVerified === true &&
    data.ageVerificationStatus === 'approved' &&
    data.accountBanned !== true &&
    typeof data.name === 'string' && !!data.name &&
    typeof data.age === 'number' &&
    typeof data.gender === 'string' && !!data.gender;
}

/**
 * Projeção pública. LISTA BRANCA: campo novo no users NUNCA vaza por
 * engano — só entra se for adicionado aqui.
 */
export function buildPublicProfile(uid: string, data: Data | undefined): Data | null {
  if (!isListable(data)) return null;
  const d = data!;
  const prog = (d.progression && typeof d.progression === 'object' ? d.progression : {}) as Data;

  return {
    uid,
    name:        str(d.name, 80),
    age:         num(d.age),
    city:        str(d.city, 100),
    state:       str(d.state, 2),
    regiaoId:    str(d.regiaoId, 7),
    estadoId:    num(d.estadoId),
    gender:      str(d.gender, 20),
    preferences: Array.isArray(d.preferences) ? d.preferences.filter(p => typeof p === 'string').slice(0, 4) : [],
    seeks:       seeksFromPreferences(d.preferences),
    bio:         str(d.bio, 1000) ?? '',
    photoURL:    str(d.photoURL, 1024) ?? '',
    gallery:     Array.isArray(d.gallery) ? d.gallery : [],
    interests:   sanitizeInterests(d.interests),
    randomSeed:  feedSeed(uid, d.randomSeed),
    role:        str(d.role, 20) ?? 'user',
    isBlocked:   d.isBlocked === true,
    // isListableProfile do app confere estes três; só listáveis
    // chegam aqui, então os valores são sempre os "aprovados".
    ageVerified:           true,
    ageVerificationStatus: 'approved',
    accountBanned:         false,
    boostActiveUntil: ts(d.boostActiveUntil),
    boostType:        str(d.boostType, 20),
    turbo:            boost(d.turbo, false),
    impulso:          boost(d.impulso, false),
    destaqueRegional: boost(d.destaqueRegional, true),
    progression: {
      equippedFrame:       str(prog.equippedFrame, 80),
      equippedFrameUntil:  ts(prog.equippedFrameUntil),
      equippedBadge:       str(prog.equippedBadge, 80),
      equippedBadgeUntil:  ts(prog.equippedBadgeUntil),
      equippedBadgeRarity: str(prog.equippedBadgeRarity, 20),
      equippedTitle:       str(prog.equippedTitle, 80),
      prestigeStage:       num(prog.prestigeStage) ?? 0,
    },
    createdAt: ts(d.createdAt),
  };
}

/** Comparação estável (Timestamp vira milissegundos). */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v instanceof Timestamp) return { __ts: v.toMillis() };
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v).sort().reduce<Data>((acc, k) => { acc[k] = (v as Data)[k]; return acc; }, {});
    }
    return v;
  });
}

function publicRef(uid: string) {
  return admin.firestore().collection(PUBLIC_PROFILES).doc(uid);
}

/** Grava ou apaga o público a partir do users atual. */
async function syncOne(uid: string, data: Data | undefined): Promise<'written' | 'deleted'> {
  const projection = buildPublicProfile(uid, data);
  if (!projection) {
    await publicRef(uid).delete();
    return 'deleted';
  }
  await publicRef(uid).set({ ...projection, syncedAt: FieldValue.serverTimestamp() });
  return 'written';
}

export const onUserWrittenPublicProfile = onDocumentWritten(
  { document: 'users/{uid}', region: 'us-central1' },
  async (event) => {
    const uid = event.params.uid;
    const before = event.data?.before?.data() as Data | undefined;
    const after = event.data?.after?.data() as Data | undefined;

    const projBefore = buildPublicProfile(uid, before);
    const projAfter = buildPublicProfile(uid, after);

    // Nada público mudou (XP, carteira, progressão...): sem gravação.
    if (stable(projBefore) === stable(projAfter)) return;

    try {
      const result = await syncOne(uid, after);
      console.log(`[publicProfiles] ${uid}: ${result}`);
    } catch (error) {
      console.error(`[publicProfiles] falha ao sincronizar ${uid}:`, error);
      throw error; // reexecução automática do gatilho
    }
  },
);

const REBUILD_PAGE = 300;

/**
 * Tarefas de manutenção criadas pelo Console (adminJobs fica fechado
 * para o app nas regras):
 *   rebuildPublicProfiles — refaz todos os perfis públicos;
 *   auditUserFields       — conta campos sensíveis no users (CPF...)
 *                           e, com removeCpf: true, apaga (13/10/2026).
 */
export const onAdminJobCreated = onDocumentCreated(
  { document: 'adminJobs/{jobId}', region: 'us-central1', timeoutSeconds: 540, memory: '512MiB' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const job = snap.data() as Data;

    if (job.type === 'auditUserFields') {
      await snap.ref.set({ status: 'running', startedAt: FieldValue.serverTimestamp() }, { merge: true });
      try {
        const result = await runUserFieldsAudit(job.removeCpf === true);
        await snap.ref.set({ status: 'done', ...result, finishedAt: FieldValue.serverTimestamp() }, { merge: true });
      } catch (error) {
        console.error('[adminJobs] auditUserFields falhou:', error);
        await snap.ref.set({
          status: 'error', error: error instanceof Error ? error.message : String(error),
        }, { merge: true });
      }
      return;
    }

    if (job.type !== 'rebuildPublicProfiles') {
      await snap.ref.set({ status: 'ignored', reason: 'tipo desconhecido' }, { merge: true });
      return;
    }

    await snap.ref.set({ status: 'running', startedAt: FieldValue.serverTimestamp() }, { merge: true });

    const db = admin.firestore();
    let written = 0;
    let deleted = 0;
    let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    try {
      for (;;) {
        let query = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(REBUILD_PAGE);
        if (last) query = query.startAfter(last);
        const page = await query.get();
        if (page.empty) break;

        const batch = db.batch();
        for (const doc of page.docs) {
          const projection = buildPublicProfile(doc.id, doc.data());
          if (projection) {
            batch.set(publicRef(doc.id), { ...projection, syncedAt: FieldValue.serverTimestamp() });
            written++;
          } else {
            batch.delete(publicRef(doc.id));
            deleted++;
          }
        }
        await batch.commit();
        last = page.docs[page.docs.length - 1];
        if (page.size < REBUILD_PAGE) break;
      }

      await snap.ref.set({
        status: 'done', written, deleted, finishedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      console.log(`[publicProfiles] rebuild: ${written} gravados, ${deleted} removidos`);
    } catch (error) {
      console.error('[publicProfiles] rebuild falhou:', error);
      await snap.ref.set({
        status: 'error', written, deleted,
        error: error instanceof Error ? error.message : String(error),
      }, { merge: true });
    }
  },
);
