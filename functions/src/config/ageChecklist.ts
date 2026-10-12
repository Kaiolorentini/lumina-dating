// ============================================
// LUMINA — QUESTIONÁRIO DA VERIFICAÇÃO DE IDADE (SERVIDOR)
// functions/src/config/ageChecklist.ts
//
// FONTE DA VERDADE dos 12 itens que o admin responde antes de aprovar
// ou recusar uma verificação de idade (12/10/2026). O app tem o espelho
// com os textos de ajuda em src/config/moderation/ageChecklist.ts.
//
// AO MUDAR UM ITEM: troque aqui E no espelho (mesmos ids e versão),
// suba AGE_CHECKLIST_VERSION e faça o deploy das functions ANTES do
// eas update.
//
// Cada item negado leva a um resultado (outcome):
//   underage → encerra a conta (UNDERAGE). Só vale se a data de
//              nascimento digitada confirmar menos de 18 anos.
//   mismatch → MISMATCH (dados não batem / suspeita de fraude).
//   illegible→ ILLEGIBLE (foto ruim — reenviar).
//   resubmit → OTHER (corrigir e reenviar).
// Com vários itens negados vale o mais grave:
//   underage > mismatch > illegible > resubmit.
//
// hideFromUser: o motivo e a observação do admin NÃO vão para o
// usuário (não ensinar a fraudar) — ele recebe um texto genérico.
// alert: negar avisa os superadmins (segunda revisão).
// ============================================

export const AGE_CHECKLIST_VERSION = 1;

export type AgeChecklistAnswer = 'approved' | 'rejected';
export type AgeItemOutcome = 'underage' | 'mismatch' | 'illegible' | 'resubmit';
export type AgeRejectionCode = 'UNDERAGE' | 'MISMATCH' | 'ILLEGIBLE' | 'OTHER';

export interface AgeChecklistItemDef {
  id: string;
  title: string;
  outcome: AgeItemOutcome;
  /** Texto enviado ao usuário quando o item é negado. */
  reason: string;
  hideFromUser?: boolean;
  alert?: boolean;
}

export const AGE_CHECKLIST_ITEMS: readonly AgeChecklistItemDef[] = [
  // A. Documento
  { id: 'doc_type', title: 'É um documento aceito', outcome: 'resubmit',
    reason: 'Esse documento não é aceito. Envie RG, CNH, passaporte ou CRNM.' },
  { id: 'doc_legible', title: 'Frente e verso legíveis e inteiros', outcome: 'illegible',
    reason: 'Não deu para ler o documento. Envie de novo, com boa luz e os 4 cantos aparecendo.' },
  { id: 'doc_original', title: 'Documento original, não cópia ou tela', outcome: 'resubmit',
    reason: 'Envie a foto do documento original, não de uma tela ou cópia.' },
  { id: 'doc_untampered', title: 'Sem sinal de adulteração', outcome: 'mismatch', hideFromUser: true, alert: true,
    reason: 'Não foi possível validar seu documento.' },
  { id: 'doc_valid', title: 'Documento dentro da validade', outcome: 'resubmit',
    reason: 'Seu documento está vencido. Envie um documento válido.' },
  { id: 'age_18', title: 'Data de nascimento dá 18 anos ou mais', outcome: 'underage',
    reason: 'O documento indica que você tem menos de 18 anos.' },
  { id: 'name_matches', title: 'Nome compatível com o perfil', outcome: 'mismatch',
    reason: 'Os dados do documento não correspondem aos da sua conta.' },
  // B. Selfie
  { id: 'selfie_live', title: 'Selfie real, feita na hora', outcome: 'resubmit',
    reason: 'Envie uma selfie nova, com o rosto inteiro, segurando o documento, sem filtro, óculos escuros ou boné.' },
  { id: 'selfie_matches_doc', title: 'Mesma pessoa da foto do documento', outcome: 'mismatch',
    reason: 'A pessoa da selfie não corresponde ao documento enviado.' },
  { id: 'profile_photo_matches', title: 'Mesma pessoa da foto de perfil', outcome: 'resubmit',
    reason: 'Sua foto de perfil precisa ser sua. Troque a foto e envie a verificação de novo.' },
  { id: 'adult_appearance', title: 'Aparência compatível com 18 anos ou mais', outcome: 'mismatch',
    hideFromUser: true, alert: true,
    reason: 'Não foi possível concluir sua verificação.' },
  // C. Conta
  { id: 'no_duplicate', title: 'Sem sinal de conta duplicada', outcome: 'mismatch', hideFromUser: true, alert: true,
    reason: 'Não foi possível concluir sua verificação.' },
] as const;

const ITEM_IDS = new Set(AGE_CHECKLIST_ITEMS.map(item => item.id));
const NOTE_MAX = 300;

const OUTCOME_RANK: Record<AgeItemOutcome, number> = { underage: 4, mismatch: 3, illegible: 2, resubmit: 1 };
const OUTCOME_CODE: Record<AgeItemOutcome, AgeRejectionCode> = {
  underage: 'UNDERAGE', mismatch: 'MISMATCH', illegible: 'ILLEGIBLE', resubmit: 'OTHER',
};

export class AgeChecklistError extends Error {}

export interface ParsedAgeChecklist {
  version: number;
  answers: Record<string, AgeChecklistAnswer>;
  notes: Record<string, string>;
  rejectedIds: string[];
  allApproved: boolean;
}

export function parseAgeChecklist(raw: unknown): ParsedAgeChecklist {
  if (typeof raw !== 'object' || raw === null) {
    throw new AgeChecklistError('Responda o questionário de verificação antes de concluir.');
  }
  const data = raw as { version?: unknown; answers?: unknown; notes?: unknown };
  if (data.version !== AGE_CHECKLIST_VERSION) {
    throw new AgeChecklistError('O questionário foi atualizado. Atualize o app e responda de novo.');
  }
  if (typeof data.answers !== 'object' || data.answers === null) {
    throw new AgeChecklistError('Questionário sem respostas.');
  }
  const rawAnswers = data.answers as Record<string, unknown>;
  for (const key of Object.keys(rawAnswers)) {
    if (!ITEM_IDS.has(key)) throw new AgeChecklistError('Questionário com item desconhecido.');
  }

  const answers: Record<string, AgeChecklistAnswer> = {};
  for (const item of AGE_CHECKLIST_ITEMS) {
    const value = rawAnswers[item.id];
    if (value !== 'approved' && value !== 'rejected') {
      throw new AgeChecklistError(`Responda todos os itens. Falta: "${item.title}".`);
    }
    answers[item.id] = value;
  }

  const notes: Record<string, string> = {};
  if (typeof data.notes === 'object' && data.notes !== null) {
    for (const [key, value] of Object.entries(data.notes as Record<string, unknown>)) {
      if (!ITEM_IDS.has(key) || typeof value !== 'string') continue;
      const note = value.trim().slice(0, NOTE_MAX);
      if (note && answers[key] === 'rejected') notes[key] = note;
    }
  }

  const rejectedIds = AGE_CHECKLIST_ITEMS.filter(i => answers[i.id] === 'rejected').map(i => i.id);
  return { version: AGE_CHECKLIST_VERSION, answers, notes, rejectedIds, allApproved: rejectedIds.length === 0 };
}

export interface AgeRejectionDecision {
  code: AgeRejectionCode;
  /** Texto para o usuário (itens com hideFromUser viram texto genérico). */
  userMessage: string;
  /** Há item que pede segunda revisão dos superadmins. */
  alert: boolean;
}

/** Decide o motivo da recusa a partir dos itens negados. */
export function decideAgeRejection(parsed: ParsedAgeChecklist): AgeRejectionDecision {
  const rejected = AGE_CHECKLIST_ITEMS.filter(item => parsed.answers[item.id] === 'rejected');
  if (rejected.length === 0) throw new AgeChecklistError('Para recusar, marque como negado o item que motivou a recusa.');

  const worst = rejected.reduce((a, b) => (OUTCOME_RANK[b.outcome] > OUTCOME_RANK[a.outcome] ? b : a));
  const hidden = rejected.some(item => item.hideFromUser);

  // Menoridade encerra a conta: o usuário recebe só esse motivo (os
  // outros itens não mudam nada e confundiriam a mensagem).
  // Com item sigiloso negado, o usuário recebe só o texto genérico:
  // listar os outros motivos daria pistas do que foi percebido.
  const userMessage = worst.outcome === 'underage'
    ? worst.reason
    : hidden
    ? 'Não foi possível concluir sua verificação.'
    : rejected
      .map(item => {
        const note = parsed.notes[item.id];
        return note ? `${item.reason} (${note})` : item.reason;
      })
      .join(' ')
      .slice(0, 500);

  return { code: OUTCOME_CODE[worst.outcome], userMessage, alert: rejected.some(item => item.alert) };
}
