// ============================================
// LUMINA — VALIDAÇÃO GENÉRICA DE QUESTIONÁRIO (SERVIDOR)
// functions/src/config/checklistParser.ts
//
// 12/10/2026. Antes cada questionário (produto e verificação de idade)
// tinha a própria cópia desta validação. Agora os dois usam esta, e
// as regras ficam iguais por construção:
//   • versão igual à que está no ar;
//   • TODOS os itens respondidos com 'approved' ou 'rejected';
//   • nenhum item desconhecido;
//   • observação só em item negado, até 300 letras.
// Cada questionário continua com a própria classe de erro e o próprio
// texto de "questionário vazio" — as mensagens para o admin não mudam.
// ============================================

export type ChecklistAnswerValue = 'approved' | 'rejected';

export interface ParsedChecklistBase {
  version: number;
  answers: Record<string, ChecklistAnswerValue>;
  /** Observação do admin por item negado. */
  notes: Record<string, string>;
  rejectedIds: string[];
  allApproved: boolean;
}

export interface ChecklistParserOptions {
  version: number;
  items: ReadonlyArray<{ id: string; title: string }>;
  /** Mensagem quando o app não manda questionário nenhum. */
  missingMessage: string;
  /** Cria o erro do questionário (ChecklistError, AgeChecklistError...). */
  makeError: (message: string) => Error;
}

export const CHECKLIST_NOTE_MAX = 300;

export function parseChecklistBase(raw: unknown, options: ChecklistParserOptions): ParsedChecklistBase {
  const { version, items, missingMessage, makeError } = options;
  const itemIds = new Set(items.map(item => item.id));

  if (typeof raw !== 'object' || raw === null) throw makeError(missingMessage);
  const data = raw as { version?: unknown; answers?: unknown; notes?: unknown };

  if (data.version !== version) {
    throw makeError('O questionário foi atualizado. Atualize o app e responda de novo.');
  }
  if (typeof data.answers !== 'object' || data.answers === null) {
    throw makeError('Questionário sem respostas.');
  }

  const rawAnswers = data.answers as Record<string, unknown>;
  for (const key of Object.keys(rawAnswers)) {
    if (!itemIds.has(key)) throw makeError('Questionário com item desconhecido.');
  }

  const answers: Record<string, ChecklistAnswerValue> = {};
  for (const item of items) {
    const value = rawAnswers[item.id];
    if (value !== 'approved' && value !== 'rejected') {
      throw makeError(`Responda todos os itens. Falta: "${item.title}".`);
    }
    answers[item.id] = value;
  }

  const notes: Record<string, string> = {};
  if (typeof data.notes === 'object' && data.notes !== null) {
    for (const [key, value] of Object.entries(data.notes as Record<string, unknown>)) {
      if (!itemIds.has(key) || typeof value !== 'string') continue;
      const note = value.trim().slice(0, CHECKLIST_NOTE_MAX);
      if (note && answers[key] === 'rejected') notes[key] = note;
    }
  }

  const rejectedIds = items.filter(item => answers[item.id] === 'rejected').map(item => item.id);
  return { version, answers, notes, rejectedIds, allApproved: rejectedIds.length === 0 };
}
