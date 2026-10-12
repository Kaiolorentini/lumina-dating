// ============================================
// LUMINA — QUESTIONÁRIO DE MODERAÇÃO DE PRODUTO (SERVIDOR)
// functions/src/config/productChecklist.ts
//
// FONTE DA VERDADE dos itens que o admin precisa responder antes de
// aprovar ou recusar um produto (12/10/2026). O app tem o espelho com
// os textos completos de ajuda em src/config/moderation/productChecklist.ts.
//
// AO MUDAR UM ITEM:
//   1. troque aqui E no espelho do app (mesmos ids e mesma versão);
//   2. suba PRODUCT_CHECKLIST_VERSION;
//   3. deploy das functions ANTES do eas update.
// O servidor recusa questionário de outra versão: registrar análise
// de uma lista que não está no ar seria prova falsa.
//
// O preço (mínimo R$ 19,99 ou grátis) NÃO é item respondido pelo
// admin: o servidor confere sozinho (marketplacePricing).
// ============================================

export const PRODUCT_CHECKLIST_VERSION = 1;

export type ChecklistAnswer = 'approved' | 'rejected';

export interface ChecklistItemDef {
  id: string;
  /** Título curto — vai para o registro e para o painel. */
  title: string;
  /** Motivo enviado ao criador quando o item é negado. */
  reason: string;
  /**
   * Item de proteção de menores: negar gera alerta interno para
   * revisar a conta do criador.
   */
  childSafety?: boolean;
}

export const PRODUCT_CHECKLIST_ITEMS: readonly ChecklistItemDef[] = [
  // A. Quem criou
  { id: 'creator_status', title: 'Criador em situação regular',
    reason: 'Sua conta tem uma pendência que impede publicar produtos. Fale com o suporte.' },
  { id: 'only_creator', title: 'Só o próprio criador aparece',
    reason: 'Por enquanto, só você pode aparecer nos seus conteúdos. Remova os arquivos em que aparece outra pessoa.' },
  // B. Proteção de menores
  { id: 'adult_appearance', title: 'Ninguém aparenta ter menos de 18 anos', childSafety: true,
    reason: 'O conteúdo foi recusado pela política de proteção de menores.' },
  { id: 'no_minor_themes', title: 'Nada sexualiza infância ou adolescência', childSafety: true,
    reason: 'Elementos que remetem a menores de idade não são permitidos, nem como fantasia.' },
  // C. Conteúdo proibido
  { id: 'own_consensual', title: 'Conteúdo próprio, não vazado nem de terceiros',
    reason: 'O conteúdo parece ter origem em outra plataforma ou em outra pessoa. Envie apenas conteúdo produzido por você.' },
  { id: 'no_prohibited_themes', title: 'Sem violência, abuso ou temas proibidos',
    reason: 'O conteúdo contém tema proibido pelas regras do Lumina.' },
  { id: 'no_external_contact', title: 'Sem venda de encontro e sem contato fora do app',
    reason: 'Não é permitido oferecer encontros nem divulgar contatos ou pagamentos fora do Lumina.' },
  { id: 'no_third_party_rights', title: 'Sem material protegido de terceiros',
    reason: 'O produto usa material protegido por direitos autorais de terceiros.' },
  { id: 'no_personal_data', title: 'Sem dados pessoais à mostra',
    reason: 'Aparecem dados pessoais (documento, endereço, placa ou similar). Remova ou cubra essas informações.' },
  // D. Capa e prévias
  { id: 'cover_rules', title: 'Capa segue a regra da vitrine',
    reason: 'A capa mostra conteúdo explícito. Escolha uma capa sem nudez explícita (veja as regras de capa).' },
  { id: 'previews_rules', title: 'Prévias seguem a regra da vitrine',
    reason: 'Uma ou mais prévias mostram conteúdo explícito. Use prévias dentro das regras da vitrine.' },
  { id: 'cover_matches', title: 'Capa e prévias correspondem ao conteúdo',
    reason: 'A capa ou as prévias não correspondem ao conteúdo entregue.' },
  // E. Informações do anúncio
  { id: 'title_description', title: 'Título e descrição claros e honestos',
    reason: 'Ajuste o título ou a descrição do produto.' },
  { id: 'category', title: 'Categoria correta',
    reason: 'A categoria escolhida não corresponde ao conteúdo.' },
  { id: 'delivers_announced', title: 'Entrega o que foi anunciado',
    reason: 'A quantidade ou a duração anunciada não bate com os arquivos enviados.' },
  // F. Arquivos
  { id: 'files_quality', title: 'Arquivos abrem e têm qualidade',
    reason: 'Um ou mais arquivos estão com problema (não abrem ou estão com baixa qualidade).' },
  { id: 'files_safe', title: 'Nada suspeito nos arquivos',
    reason: 'Encontramos um arquivo com links ou conteúdo não permitido.' },
  { id: 'complete_content', title: 'Conteúdo completo',
    reason: 'O produto precisa entregar o conteúdo completo dentro do Lumina.' },
] as const;

const ITEM_IDS = new Set(PRODUCT_CHECKLIST_ITEMS.map(item => item.id));
const NOTE_MAX = 300;

export interface ParsedChecklist {
  version: number;
  answers: Record<string, ChecklistAnswer>;
  /** Observação do admin por item negado (vai junto do motivo). */
  notes: Record<string, string>;
  rejectedIds: string[];
  allApproved: boolean;
}

export class ChecklistError extends Error {}

/**
 * Valida o questionário enviado pelo app: versão atual, TODOS os
 * itens respondidos, nenhum item desconhecido, observações curtas.
 * Lança ChecklistError com mensagem pronta para o admin.
 */
export function parseProductChecklist(raw: unknown): ParsedChecklist {
  if (typeof raw !== 'object' || raw === null) {
    throw new ChecklistError('Responda o questionário de moderação antes de concluir.');
  }
  const data = raw as { version?: unknown; answers?: unknown; notes?: unknown };

  if (data.version !== PRODUCT_CHECKLIST_VERSION) {
    throw new ChecklistError('O questionário foi atualizado. Atualize o app e responda de novo.');
  }
  if (typeof data.answers !== 'object' || data.answers === null) {
    throw new ChecklistError('Questionário sem respostas.');
  }

  const rawAnswers = data.answers as Record<string, unknown>;
  for (const key of Object.keys(rawAnswers)) {
    if (!ITEM_IDS.has(key)) throw new ChecklistError('Questionário com item desconhecido.');
  }

  const answers: Record<string, ChecklistAnswer> = {};
  for (const item of PRODUCT_CHECKLIST_ITEMS) {
    const value = rawAnswers[item.id];
    if (value !== 'approved' && value !== 'rejected') {
      throw new ChecklistError(`Responda todos os itens. Falta: "${item.title}".`);
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

  const rejectedIds = PRODUCT_CHECKLIST_ITEMS
    .filter(item => answers[item.id] === 'rejected')
    .map(item => item.id);

  return { version: PRODUCT_CHECKLIST_VERSION, answers, notes, rejectedIds, allApproved: rejectedIds.length === 0 };
}

/** Texto do motivo enviado ao criador, montado pelo SERVIDOR. */
export function buildRejectionReason(parsed: ParsedChecklist): string {
  const lines = PRODUCT_CHECKLIST_ITEMS
    .filter(item => parsed.answers[item.id] === 'rejected')
    .map(item => {
      const note = parsed.notes[item.id];
      return note ? `• ${item.reason} (${note})` : `• ${item.reason}`;
    });
  return lines.join('\n').slice(0, 1500);
}

export function hasChildSafetyRejection(parsed: ParsedChecklist): boolean {
  return PRODUCT_CHECKLIST_ITEMS.some(item => item.childSafety && parsed.answers[item.id] === 'rejected');
}
