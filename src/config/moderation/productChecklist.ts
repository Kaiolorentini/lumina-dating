// ============================================
// LUMINA — QUESTIONÁRIO DE MODERAÇÃO DE PRODUTO (APP)
// src/config/moderation/productChecklist.ts
//
// ESPELHO de functions/src/config/productChecklist.ts, com os textos
// de ajuda completos (o que olhar, exemplos de pode / não pode).
// Os ids e a versão PRECISAM ser iguais aos do servidor — ele recusa
// questionário de outra versão. O motivo enviado ao criador é montado
// pelo servidor; o daqui é só para o admin ver o que vai ser enviado.
//
// Documento de referência: claude/moderacao-questionarios.md (12/10/2026).
// ============================================

export const PRODUCT_CHECKLIST_VERSION = 1;

export type ChecklistAnswer = 'approved' | 'rejected';

export interface ChecklistItem {
  id: string;
  title: string;
  /** O que olhar para decidir. */
  look: string;
  /** Exemplos que PODEM. */
  ok: string[];
  /** Exemplos que NÃO PODEM. */
  notOk: string[];
  /** Motivo enviado ao criador se o item for negado. */
  reason: string;
  /** Item de proteção de menores — negar gera alerta interno. */
  childSafety?: boolean;
}

export interface ChecklistGroup {
  id: string;
  title: string;
  /** Aviso em destaque no topo do grupo. */
  warning?: string;
  items: ChecklistItem[];
}

export const PRODUCT_CHECKLIST: ChecklistGroup[] = [
  {
    id: 'creator',
    title: 'A. Quem criou',
    items: [
      {
        id: 'creator_status',
        title: 'O criador está em situação regular',
        look: 'Abra "Ver perfil completo" do criador: conta verificada (+18), sem ban de marketplace, sem fraude ou denúncia grave em aberto.',
        ok: ['Conta verificada e sem bloqueios.'],
        notOk: ['Ban ativo.', 'Fraude em análise.', 'Denúncia grave sem resposta.'],
        reason: 'Sua conta tem uma pendência que impede publicar produtos. Fale com o suporte.',
      },
      {
        id: 'only_creator',
        title: 'Só o próprio criador aparece',
        look: 'Compare rosto e corpo de quem aparece no conteúdo com a foto de perfil do criador. Qualquer outra pessoa, mesmo de costas ou parcialmente, é negado.',
        ok: ['Fotos e vídeos só com o criador, sozinho.'],
        notOk: [
          'Casal ou grupo.',
          'Outra pessoa aparecendo "de relance".',
          'Mãos, pernas ou voz de outra pessoa em cena íntima.',
          'Rosto sempre escondido, sem como confirmar que é o criador.',
        ],
        reason: 'Por enquanto, só você pode aparecer nos seus conteúdos. Remova os arquivos em que aparece outra pessoa.',
      },
    ],
  },
  {
    id: 'minors',
    title: 'B. Proteção de menores',
    warning: 'Tolerância zero. Na dúvida, NEGUE — mesmo que o criador seja verificado.',
    items: [
      {
        id: 'adult_appearance',
        title: 'Ninguém aparenta ter menos de 18 anos',
        look: 'Rosto e corpo com traços infantis ou muito juvenis, aparência geral e contexto da cena.',
        ok: ['Adulto com aparência claramente adulta.'],
        notOk: [
          'Aparência de adolescente.',
          'Aparelho nos dentes com roupa e cenário juvenis.',
          'Corpo infantilizado de propósito.',
        ],
        reason: 'O conteúdo foi recusado pela política de proteção de menores.',
        childSafety: true,
      },
      {
        id: 'no_minor_themes',
        title: 'Nada sexualiza infância ou adolescência',
        look: 'Roupas, objetos, cenário, textos e títulos.',
        ok: ['Fantasias adultas comuns: enfermeira, policial, lingerie.'],
        notOk: [
          'Uniforme escolar, fantasia de "colegial" ou "aluna".',
          'Chupeta, mamadeira ou pelúcia em cena sensual.',
          'Quarto infantil; maria-chiquinha com roupa infantil.',
          'Palavras: "novinha", "ninfeta", "teen", "colegial", "18 aninhos", "virgem de 18", "menininha".',
        ],
        reason: 'Elementos que remetem a menores de idade não são permitidos, nem como fantasia.',
        childSafety: true,
      },
    ],
  },
  {
    id: 'prohibited',
    title: 'C. Conteúdo proibido',
    items: [
      {
        id: 'own_consensual',
        title: 'Conteúdo próprio, não vazado nem de terceiros',
        look: 'Marca d\'água de outro site; print de outro app; câmera escondida; pessoa que parece não saber que está sendo filmada; arquivos com qualidade e estilo muito diferentes entre si.',
        ok: ['Conteúdo produzido pelo próprio criador para vender aqui.'],
        notOk: [
          'Marca d\'água de OnlyFans, Privacy, Instagram ou TikTok.',
          'Fotos "vazadas" ou baixadas de outro site.',
          'Foto tirada sem a pessoa saber.',
        ],
        reason: 'O conteúdo parece ter origem em outra plataforma ou em outra pessoa. Envie apenas conteúdo produzido por você.',
      },
      {
        id: 'no_prohibited_themes',
        title: 'Sem violência, abuso ou temas proibidos',
        look: 'Toda a cena: ação, objetos, falas e texto.',
        ok: ['Nudez e sexualidade adulta consentida, só com o criador.'],
        notOk: [
          'Violência ou coerção sexual, mesmo encenada; sangue; asfixia.',
          'Pessoa dormindo, desacordada ou embriagada em cena íntima.',
          'Incesto, mesmo encenado ("padrasto", "irmão" etc.).',
          'Animais em contexto sexual; drogas; armas em cena sensual; humilhação extrema.',
        ],
        reason: 'O conteúdo contém tema proibido pelas regras do Lumina.',
      },
      {
        id: 'no_external_contact',
        title: 'Sem venda de encontro e sem contato fora do app',
        look: 'Título, descrição, capa, prévias e o conteúdo — inclusive texto escrito na imagem.',
        ok: ['Conteúdo digital vendido só pelo Lumina.'],
        notOk: [
          '"Faço programa", "encontro presencial", preço por hora.',
          'Telefone, @ de outra rede, link ou QR code.',
          'Chave Pix, "me chama no zap".',
        ],
        reason: 'Não é permitido oferecer encontros nem divulgar contatos ou pagamentos fora do Lumina.',
      },
      {
        id: 'no_third_party_rights',
        title: 'Sem material protegido de terceiros',
        look: 'Trechos de vídeo, música de fundo, imagens e textos usados no produto.',
        ok: ['Produção própria.', 'Música livre de direitos, indicada pelo criador.'],
        notOk: [
          'Trecho de filme, série ou novela.',
          'Música de artista conhecido no vídeo.',
          'Foto de banco de imagens; personagem de desenho.',
          'Curso copiado de outro autor; e-book pirateado.',
        ],
        reason: 'O produto usa material protegido por direitos autorais de terceiros.',
      },
      {
        id: 'no_personal_data',
        title: 'Sem dados pessoais à mostra',
        look: 'Fundo das fotos e vídeos, telas de celular, papéis, carros e fachadas. Vale também para os dados do próprio criador.',
        ok: ['Cenário neutro, sem informação pessoal.'],
        notOk: [
          'Documento, cartão, carta ou boleto aparecendo.',
          'Endereço; placa de carro; fachada que identifica a casa.',
          'Tela de celular com conversas ou números.',
        ],
        reason: 'Aparecem dados pessoais (documento, endereço, placa ou similar). Remova ou cubra essas informações.',
      },
    ],
  },
  {
    id: 'storefront',
    title: 'D. Capa e prévias (o que todos veem na vitrine)',
    warning: 'Regra da vitrine: nudez sensual pode; genitais à mostra, ato sexual e pose explicitamente sexual NÃO.',
    items: [
      {
        id: 'cover_rules',
        title: 'A capa segue a regra da vitrine',
        look: 'A capa inteira, inclusive o fundo e reflexos.',
        ok: [
          'Rosto, corpo vestido, lingerie, biquíni.',
          'Nudez sensual sem genitais: seios cobertos pelas mãos, pose de costas, silhueta.',
        ],
        notOk: [
          'Genitais à mostra; ato sexual; toque sexual explícito.',
          'Fluidos; brinquedo sexual em uso; close em partes íntimas.',
          'Pose de ato sexual, mesmo vestido.',
        ],
        reason: 'A capa mostra conteúdo explícito. Escolha uma capa sem nudez explícita (veja as regras de capa).',
      },
      {
        id: 'previews_rules',
        title: 'As prévias seguem a mesma regra da capa',
        look: 'Cada imagem de prévia, uma por uma.',
        ok: ['Mesmos exemplos permitidos da capa.'],
        notOk: ['Mesmos exemplos proibidos da capa, em qualquer prévia.'],
        reason: 'Uma ou mais prévias mostram conteúdo explícito. Use prévias dentro das regras da vitrine.',
      },
      {
        id: 'cover_matches',
        title: 'Capa e prévias mostram o que o comprador vai receber',
        look: 'Compare capa e prévias com os arquivos do produto.',
        ok: ['Capa tirada do próprio conteúdo ou da mesma sessão.'],
        notOk: [
          'Capa com outra pessoa.',
          'Capa muito mais produzida do que o conteúdo.',
          'Foto da internet; capa de vídeo e só fotos dentro.',
        ],
        reason: 'A capa ou as prévias não correspondem ao conteúdo entregue.',
      },
    ],
  },
  {
    id: 'listing',
    title: 'E. Informações do anúncio',
    items: [
      {
        id: 'title_description',
        title: 'Título e descrição claros e honestos',
        look: 'Leia o título, a descrição e as tags.',
        ok: ['Diz o que é, quantos arquivos e o tipo de conteúdo.'],
        notOk: [
          'Palavras proibidas do grupo B.',
          'Promessa falsa ("o melhor do Brasil", "100% inédito" sem ser).',
          'Tudo em maiúsculas, cheio de emojis, ou impossível de entender.',
          'Contato externo.',
        ],
        reason: 'Ajuste o título ou a descrição do produto.',
      },
      {
        id: 'category',
        title: 'Categoria correta',
        look: 'Fotos em "Fotos", vídeos em "Vídeos", curso em "Cursos", PDF em "PDFs e e-books".',
        ok: ['Categoria igual ao tipo principal dos arquivos.'],
        notOk: ['Vídeos cadastrados como "Fotos"; curso cadastrado como "PDF".'],
        reason: 'A categoria escolhida não corresponde ao conteúdo.',
      },
      {
        id: 'delivers_announced',
        title: 'O que é anunciado é o que é entregue',
        look: 'Se a descrição promete "50 fotos" ou "vídeo de 10 minutos", conte os arquivos e veja a duração.',
        ok: ['Quantidade e duração iguais ou maiores que o anunciado.'],
        notOk: ['Promete 50 fotos e entrega 20.', 'Promete 10 minutos e o vídeo tem 2.'],
        reason: 'A quantidade ou a duração anunciada não bate com os arquivos enviados.',
      },
    ],
  },
  {
    id: 'files',
    title: 'F. Arquivos',
    warning: 'Abra TODOS os arquivos na tela de revisão antes de responder este grupo.',
    items: [
      {
        id: 'files_quality',
        title: 'Todos os arquivos abrem e têm qualidade aceitável',
        look: 'Abra cada arquivo pelo botão "Ver" na revisão do produto.',
        ok: ['Abre normalmente, com imagem e som (se tiver) em boa qualidade.'],
        notOk: ['Arquivo que não abre.', 'Vídeo sem som quando deveria ter.', 'Imagem muito borrada; PDF em branco.'],
        reason: 'Um ou mais arquivos estão com problema (não abrem ou estão com baixa qualidade).',
      },
      {
        id: 'files_safe',
        title: 'Nada suspeito nos arquivos',
        look: 'Links dentro de PDFs, nomes estranhos, tipo diferente do anunciado.',
        ok: ['Arquivos comuns do tipo anunciado.'],
        notOk: ['PDF com links para fora.', 'Documento pedindo para "clicar aqui" ou baixar algo.'],
        reason: 'Encontramos um arquivo com links ou conteúdo não permitido.',
      },
      {
        id: 'complete_content',
        title: 'É o conteúdo completo',
        look: 'O produto entrega tudo dentro do Lumina, sem depender de outro lugar.',
        ok: ['Conteúdo inteiro nos arquivos do produto.'],
        notOk: ['Só as prévias repetidas.', '"A parte 2 eu mando no privado".', 'Conteúdo cortado.'],
        reason: 'O produto precisa entregar o conteúdo completo dentro do Lumina.',
      },
    ],
  },
];

export const PRODUCT_CHECKLIST_ITEMS: ChecklistItem[] = PRODUCT_CHECKLIST.flatMap(group => group.items);

export interface ChecklistPayload {
  version: number;
  answers: Record<string, ChecklistAnswer>;
  notes: Record<string, string>;
}
