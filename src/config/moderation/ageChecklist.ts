// ============================================
// LUMINA — QUESTIONÁRIO DA VERIFICAÇÃO DE IDADE (APP)
// src/config/moderation/ageChecklist.ts
//
// ESPELHO de functions/src/config/ageChecklist.ts, com os textos de
// ajuda completos (o que olhar, exemplos de pode / não pode). Os ids
// e a versão PRECISAM ser iguais aos do servidor — ele recusa
// questionário de outra versão. O motivo e o texto enviado ao usuário
// são decididos pelo servidor; os daqui servem para o admin ver o que
// vai acontecer antes de confirmar.
//
// Documento de referência: claude/moderacao-questionarios.md (12/10/2026).
// ============================================

export const AGE_CHECKLIST_VERSION = 1;

export type AgeChecklistAnswer = 'approved' | 'rejected';
export type AgeItemOutcome = 'underage' | 'mismatch' | 'illegible' | 'resubmit';

export interface AgeChecklistItem {
  id: string;
  title: string;
  /** O que olhar para decidir. */
  look: string;
  /** Exemplos que PODEM. */
  ok: string[];
  /** Exemplos que NÃO PODEM. */
  notOk: string[];
  /** Texto enviado ao usuário se o item for negado. */
  reason: string;
  outcome: AgeItemOutcome;
  /** Motivo e observação NÃO vão para o usuário (não ensinar a fraudar). */
  hideFromUser?: boolean;
  /** Negar avisa os superadmins (segunda revisão da conta). */
  alert?: boolean;
}

export interface AgeChecklistGroup {
  id: string;
  title: string;
  warning?: string;
  items: AgeChecklistItem[];
}

export const AGE_CHECKLIST: AgeChecklistGroup[] = [
  {
    id: 'document',
    title: 'A. Documento',
    items: [
      {
        id: 'doc_type',
        title: 'É um documento aceito',
        look: 'Veja o tipo de documento na frente e no verso. Precisa ser documento oficial com foto e data de nascimento.',
        ok: [
          'RG antigo ou novo (CIN).',
          'CNH física ou CNH digital mostrada no app oficial.',
          'Passaporte.',
          'CRNM / RNE.',
          'Carteira profissional com foto (OAB, CRM, CREA etc.).',
        ],
        notOk: [
          'Carteira de estudante.',
          'Crachá de empresa.',
          'Certidão de nascimento.',
          'Título de eleitor.',
          'CNH digital impressa em papel.',
        ],
        reason: 'Esse documento não é aceito. Envie RG, CNH, passaporte ou CRNM.',
        outcome: 'resubmit',
      },
      {
        id: 'doc_legible',
        title: 'Frente e verso legíveis e inteiros',
        look: 'Abra a frente e o verso em tela cheia. Nome, foto, data de nascimento e número precisam estar nítidos, com os 4 cantos aparecendo.',
        ok: ['Documento inteiro, nítido, sem reflexo em cima dos dados.'],
        notOk: [
          'Cantos cortados.',
          'Reflexo de luz em cima da foto ou da data.',
          'Desfocado ou escuro demais.',
          'Só a frente (verso faltando ou repetido).',
        ],
        reason: 'Não deu para ler o documento. Envie de novo, com boa luz e os 4 cantos aparecendo.',
        outcome: 'illegible',
      },
      {
        id: 'doc_original',
        title: 'Documento original, não cópia ou tela',
        look: 'Procure listras ou pixels de tela (efeito moiré), borda de monitor ou celular, aparência de papel impresso, xerox ou "foto de foto".',
        ok: ['Foto do documento físico, em cima de uma mesa ou na mão.'],
        notOk: [
          'Foto da tela de outro celular ou computador.',
          'Xerox ou impressão colorida.',
          'Foto de uma foto do documento.',
        ],
        reason: 'Envie a foto do documento original, não de uma tela ou cópia.',
        outcome: 'resubmit',
      },
      {
        id: 'doc_untampered',
        title: 'Sem sinal de adulteração',
        look: 'Compare fontes, alinhamento e nitidez dos campos. A foto do documento deve ser parte dele, não colada. Frente e verso precisam ser do mesmo documento.',
        ok: ['Documento uniforme, com todos os campos no mesmo padrão.'],
        notOk: [
          'Fontes diferentes no mesmo campo.',
          'Letras ou números desalinhados.',
          'Foto que parece colada ou com borda estranha.',
          'Data com cor ou nitidez diferente do resto.',
          'Frente e verso de documentos diferentes.',
          'Dados que não combinam entre si.',
        ],
        reason: 'Não foi possível validar seu documento.',
        outcome: 'mismatch',
        hideFromUser: true,
        alert: true,
      },
      {
        id: 'doc_valid',
        title: 'Documento dentro da validade',
        look: 'Veja a data de validade, quando o documento tiver. RG sem data de validade está OK.',
        ok: ['RG sem validade.', 'CNH válida ou vencida há até 30 dias.', 'Passaporte ou CRNM dentro da validade.'],
        notOk: ['CNH vencida há mais de 30 dias.', 'Passaporte vencido.', 'CRNM vencido.'],
        reason: 'Seu documento está vencido. Envie um documento válido.',
        outcome: 'resubmit',
      },
      {
        id: 'age_18',
        title: 'Data de nascimento dá 18 anos ou mais',
        look: 'Digite acima a data de nascimento EXATAMENTE como está no documento — o app calcula a idade. Confira dia, mês e ano duas vezes.',
        ok: ['Idade calculada de 18 anos ou mais.'],
        notOk: ['Idade calculada abaixo de 18 anos — negar ENCERRA A CONTA.'],
        reason: 'O documento indica que você tem menos de 18 anos.',
        outcome: 'underage',
      },
      {
        id: 'name_matches',
        title: 'Nome compatível com o perfil',
        look: 'Compare o nome do perfil com o nome do documento.',
        ok: [
          'Nome igual ou parte do nome ("Ana" para "Ana Paula Souza").',
          'Nome social no perfil.',
          'Apelido comum do primeiro nome ("Bia" para "Beatriz").',
        ],
        notOk: ['Nome totalmente diferente, que indica documento de outra pessoa.'],
        reason: 'Os dados do documento não correspondem aos da sua conta.',
        outcome: 'mismatch',
      },
    ],
  },
  {
    id: 'selfie',
    title: 'B. Selfie',
    items: [
      {
        id: 'selfie_live',
        title: 'Selfie real, feita na hora',
        look: 'A selfie precisa mostrar o rosto inteiro, de frente, segurando o documento.',
        ok: ['Rosto inteiro, iluminado, segurando o documento.'],
        notOk: [
          'Foto de foto ou de tela.',
          'Filtro ou efeito de beleza forte.',
          'Óculos escuros, máscara ou boné escondendo o rosto.',
          'Rosto cortado ou muito escuro.',
          'Sem o documento na mão.',
        ],
        reason: 'Envie uma selfie nova, com o rosto inteiro, segurando o documento, sem filtro, óculos escuros ou boné.',
        outcome: 'resubmit',
      },
      {
        id: 'selfie_matches_doc',
        title: 'Mesma pessoa da foto do documento',
        look: 'Compare formato do rosto, distância entre os olhos, nariz, orelhas e linha do queixo. Cabelo, barba e peso mudam com o tempo e NÃO servem para comparar — a foto do RG pode ter mais de 10 anos.',
        ok: ['Mesmos traços do rosto, mesmo com cabelo, barba ou peso diferentes.'],
        notOk: [
          'Traços claramente diferentes (outra pessoa).',
          'Dúvida forte: negue o item "Selfie real" para pedir reenvio, em vez deste.',
        ],
        reason: 'A pessoa da selfie não corresponde ao documento enviado.',
        outcome: 'mismatch',
      },
      {
        id: 'profile_photo_matches',
        title: 'Mesma pessoa da foto de perfil',
        look: 'A foto de perfil do app (mostrada acima) deve ser da mesma pessoa da selfie.',
        ok: ['Mesma pessoa, mesmo com roupa, cabelo ou ângulo diferentes.'],
        notOk: [
          'Foto de famoso ou de banco de imagens.',
          'Foto de outra pessoa.',
          'Desenho, paisagem ou objeto no lugar do rosto.',
        ],
        reason: 'Sua foto de perfil precisa ser sua. Troque a foto e envie a verificação de novo.',
        outcome: 'resubmit',
      },
      {
        id: 'adult_appearance',
        title: 'Aparência compatível com 18 anos ou mais',
        look: 'O documento diz 18 ou mais, mas a pessoa da selfie parece claramente menor? Pode ser documento de irmão ou parente.',
        ok: ['Aparência compatível com a idade do documento.'],
        notOk: ['Pessoa que parece claramente ter menos de 18 anos.'],
        reason: 'Não foi possível concluir sua verificação.',
        outcome: 'mismatch',
        hideFromUser: true,
        alert: true,
      },
    ],
  },
  {
    id: 'account',
    title: 'C. Conta',
    items: [
      {
        id: 'no_duplicate',
        title: 'Sem sinal de conta duplicada',
        look: 'Lembra desta selfie ou deste documento em outra análise recente? Nome e foto iguais a outra conta já verificada ou banida?',
        ok: ['Nada parecido com outra conta.'],
        notOk: [
          'Mesma selfie ou mesmo documento de outra análise.',
          'Mesma pessoa de uma conta banida.',
        ],
        reason: 'Não foi possível concluir sua verificação.',
        outcome: 'mismatch',
        hideFromUser: true,
        alert: true,
      },
    ],
  },
];

export const AGE_CHECKLIST_ITEMS: AgeChecklistItem[] = AGE_CHECKLIST.flatMap(group => group.items);

export interface AgeChecklistPayload {
  version: number;
  answers: Record<string, AgeChecklistAnswer>;
  notes: Record<string, string>;
}

export const OUTCOME_LABEL: Record<AgeItemOutcome, string> = {
  underage: 'Menor de idade — ENCERRA A CONTA',
  mismatch: 'Não corresponde / suspeita',
  illegible: 'Ilegível — pode reenviar',
  resubmit: 'Corrigir e reenviar',
};

const OUTCOME_RANK: Record<AgeItemOutcome, number> = { underage: 4, mismatch: 3, illegible: 2, resubmit: 1 };

/** Prévia do que o servidor vai decidir (o servidor decide de verdade). */
export function previewAgeRejection(answers: Record<string, AgeChecklistAnswer>): {
  outcome: AgeItemOutcome;
  hidden: boolean;
  alert: boolean;
} | null {
  const rejected = AGE_CHECKLIST_ITEMS.filter(item => answers[item.id] === 'rejected');
  if (rejected.length === 0) return null;
  const worst = rejected.reduce((a, b) => (OUTCOME_RANK[b.outcome] > OUTCOME_RANK[a.outcome] ? b : a));
  return {
    outcome: worst.outcome,
    hidden: worst.outcome !== 'underage' && rejected.some(item => item.hideFromUser),
    alert: rejected.some(item => item.alert),
  };
}
