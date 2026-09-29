// ============================================
// LUMINA — QUESTIONÁRIO DO SUPORTE
// src/modules/support/supportQuestionnaire.ts
//
// A pessoa responde TOCANDO nas opções. Texto livre só em:
//   • qualquer opção 'other' (Outro) — pede a descrição na hora;
//   • categorias com requiresText (ideia e outro assunto).
//
// Os ids marcados como URGENTES precisam bater com URGENT_OPTIONS
// em functions/src/support/supportTickets.ts: pay_not_received,
// pay_double, acc_hacked, rep_minor, rep_nonconsensual, rep_threat.
//
// Dúvidas: cada tema tem uma resposta pronta (faq). A pessoa lê
// antes de abrir chamado e só segue se não resolveu.
// ============================================

export type SupportCategoryId =
  | 'bug' | 'payment' | 'economy' | 'account' | 'social' | 'marketplace'
  | 'creator' | 'report' | 'privacy' | 'idea' | 'question' | 'other';

export interface SupportOption {
  id:    string;
  label: string;
}

export interface SupportCondition {
  questionId: string;
  optionIds:  string[];
}

export interface SupportQuestion {
  id:       string;
  text:     string;
  multi?:   boolean;
  options:  SupportOption[];
  showIf?:  SupportCondition;
}

export interface SupportInfo {
  showIf: SupportCondition;
  text:   string;
  action?: { label: string; route: 'MyPurchases' | 'MyEarnings' | 'PaymentSetup' | 'ProfileSetup' };
  tone?:  'info' | 'danger';
}

export interface SupportCategory {
  id:           SupportCategoryId;
  icon:         string;
  label:        string;
  description:  string;
  questions:    SupportQuestion[];
  info?:        SupportInfo[];
  requiresText?: boolean;
  textPrompt?:  string;
  suggestAttachment?: string;
  pickReportedUser?: boolean;
  /** Resposta pronta por opção da PRIMEIRA pergunta (só em Dúvida). */
  faq?:         Record<string, string>;
}

const OTHER: SupportOption = { id: 'other', label: 'Outro' };

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  {
    id: 'bug', icon: '🐞', label: 'Algo não está funcionando',
    description: 'Erros, travamentos, telas que não carregam',
    suggestAttachment: 'Um print da tela com o problema ajuda muito a encontrar a causa.',
    questions: [
      {
        id: 'where', text: 'Onde acontece?',
        options: [
          { id: 'feed', label: 'Descobrir' },
          { id: 'sintonize', label: 'Sintonize' },
          { id: 'other_profile', label: 'Perfil de outra pessoa' },
          { id: 'my_profile', label: 'Meu perfil e fotos' },
          { id: 'chat', label: 'Conversas' },
          { id: 'notifications', label: 'Notificações' },
          { id: 'store', label: 'Loja de cristais e impulsos' },
          { id: 'rewards', label: 'Cofre, missões e recompensas' },
          { id: 'destiny', label: 'Carta do Destino e Faísca' },
          { id: 'marketplace', label: 'Marketplace' },
          { id: 'payment', label: 'Pagamento' },
          { ...OTHER, label: 'Outro lugar' },
        ],
      },
      {
        id: 'what', text: 'O que acontece?',
        options: [
          { id: 'crash', label: 'O app fecha sozinho' },
          { id: 'loading', label: 'Fica carregando para sempre' },
          { id: 'error_msg', label: 'Aparece uma mensagem de erro' },
          { id: 'button', label: 'Um botão não faz nada' },
          { id: 'layout', label: 'Algo aparece errado ou desalinhado' },
          { id: 'value', label: 'Um valor ou saldo está errado' },
          { id: 'no_notification', label: 'Não recebi uma notificação' },
          { id: 'slow', label: 'Está muito lento' },
          OTHER,
        ],
      },
      {
        id: 'frequency', text: 'Com que frequência?',
        options: [
          { id: 'always', label: 'Sempre' },
          { id: 'sometimes', label: 'Às vezes' },
          { id: 'once', label: 'Aconteceu uma vez' },
        ],
      },
      {
        id: 'since', text: 'Desde quando?',
        options: [
          { id: 'today', label: 'Hoje' },
          { id: 'week', label: 'Esta semana' },
          { id: 'after_update', label: 'Depois de uma atualização' },
          { id: 'always', label: 'Sempre foi assim' },
          { id: 'unknown', label: 'Não sei' },
        ],
      },
      {
        id: 'tried', text: 'O que você já tentou?', multi: true,
        options: [
          { id: 'reopen', label: 'Fechar e abrir o app' },
          { id: 'reboot', label: 'Reiniciar o celular' },
          { id: 'relogin', label: 'Sair e entrar na conta' },
          { id: 'nothing', label: 'Nada ainda' },
        ],
      },
    ],
  },
  {
    id: 'payment', icon: '💳', label: 'Pagamentos e compras',
    description: 'Pix, cobranças, compras e reembolsos',
    suggestAttachment: 'Se tiver, anexe o comprovante do Pix.',
    questions: [
      {
        id: 'purchase', text: 'Sobre qual compra?',
        options: [
          { id: 'crystals', label: 'Pacote de cristais' },
          { id: 'galaxia', label: 'Galáxia Plus' },
          { id: 'content', label: 'Conteúdo do marketplace' },
        ],
      },
      {
        id: 'issue', text: 'O que houve?',
        options: [
          { id: 'pay_not_received', label: 'Paguei e não recebi' },
          { id: 'pay_double', label: 'Fui cobrado duas vezes' },
          { id: 'pix_failed', label: 'O Pix não foi gerado ou expirou' },
          { id: 'refund', label: 'Quero cancelar ou pedir reembolso' },
          { id: 'unknown_charge', label: 'Não reconheço uma cobrança' },
          { id: 'less', label: 'Recebi menos que o anunciado' },
          OTHER,
        ],
      },
      {
        id: 'when', text: 'Quando você pagou?',
        options: [
          { id: 'today', label: 'Hoje' },
          { id: 'yesterday', label: 'Ontem' },
          { id: 'last7', label: 'Nos últimos 7 dias' },
          { id: 'older', label: 'Há mais de 7 dias' },
        ],
      },
    ],
    info: [
      {
        showIf: { questionId: 'issue', optionIds: ['refund'] },
        text: 'Reembolso de conteúdo do marketplace é pedido direto em Minhas Compras, em até 7 dias após o pagamento — é mais rápido. Se for outro caso, pode seguir com o chamado.',
        action: { label: 'Ir para Minhas Compras', route: 'MyPurchases' },
      },
    ],
  },
  {
    id: 'economy', icon: '💎', label: 'Cristais, fragmentos e recompensas',
    description: 'Saldo, Cofre, missões, conquistas e impulsos',
    questions: [
      {
        id: 'topic', text: 'Sobre o quê?',
        options: [
          { id: 'daily', label: 'Recompensa diária' },
          { id: 'faisca', label: 'Faísca do Destino' },
          { id: 'missions', label: 'Missões' },
          { id: 'vault', label: 'Cofre de Sintonia' },
          { id: 'convert', label: 'Conversão de fragmentos' },
          { id: 'achievements', label: 'Conquistas e coleções' },
          { id: 'xp', label: 'XP, níveis e Árvore' },
          { id: 'ranking', label: 'Ranking semanal' },
          { id: 'prestige', label: 'Prestígio' },
          { id: 'cosmetics', label: 'Molduras, badges e títulos' },
          { id: 'boosts', label: 'Impulsos (Turbo, Impulso, Destaque)' },
          { id: 'galaxia', label: 'Benefícios da Galáxia Plus' },
          OTHER,
        ],
      },
      {
        id: 'issue', text: 'O que houve?',
        options: [
          { id: 'not_received', label: 'Não recebi o que deveria' },
          { id: 'less', label: 'Recebi menos que o esperado' },
          { id: 'balance_gone', label: 'Meu saldo sumiu ou diminuiu' },
          { id: 'cant_use', label: 'Não consigo usar ou ativar' },
          { id: 'dont_understand', label: 'Não entendi como funciona' },
          OTHER,
        ],
      },
    ],
  },
  {
    id: 'account', icon: '👤', label: 'Minha conta e acesso',
    description: 'Login, verificação, bloqueio e dados da conta',
    questions: [
      {
        id: 'issue', text: 'O que houve?',
        options: [
          { id: 'cant_login', label: 'Não consigo entrar' },
          { id: 'forgot_password', label: 'Esqueci a senha' },
          { id: 'verification', label: 'Verificação de idade' },
          { id: 'change_email', label: 'Quero mudar meu e-mail' },
          { id: 'blocked', label: 'Minha conta foi bloqueada ou suspensa' },
          { id: 'acc_hacked', label: 'Acho que alguém entrou na minha conta' },
          { id: 'photos', label: 'Problema com minhas fotos' },
          { id: 'delete', label: 'Quero excluir minha conta' },
          OTHER,
        ],
      },
      {
        id: 'verification', text: 'Qual a situação da verificação?',
        showIf: { questionId: 'issue', optionIds: ['verification'] },
        options: [
          { id: 'waiting', label: 'Está em análise há muito tempo' },
          { id: 'rejected', label: 'Foi rejeitada e não entendi' },
          { id: 'camera', label: 'Não consigo tirar as fotos' },
          OTHER,
        ],
      },
      {
        id: 'block_reason', text: 'Você recebeu o motivo do bloqueio?',
        showIf: { questionId: 'issue', optionIds: ['blocked'] },
        options: [
          { id: 'yes', label: 'Recebi o motivo' },
          { id: 'no', label: 'Não recebi o motivo' },
        ],
      },
    ],
    info: [
      {
        showIf: { questionId: 'issue', optionIds: ['acc_hacked'] },
        text: 'Troque sua senha agora e não compartilhe códigos de acesso com ninguém. Seu chamado entra como urgente.',
        tone: 'danger',
      },
    ],
  },
  {
    id: 'social', icon: '💬', label: 'Conexões e conversas',
    description: 'Mensagens, curtidas, sintonias e descoberta',
    questions: [
      {
        id: 'issue', text: 'O que houve?',
        options: [
          { id: 'not_receiving', label: 'Não recebo mensagens' },
          { id: 'not_delivered', label: 'Minhas mensagens não chegam' },
          { id: 'chat_gone', label: 'Uma conversa sumiu' },
          { id: 'cant_like', label: 'Não consigo curtir ou sintonizar' },
          { id: 'sintonia_gone', label: 'Uma sintonia sumiu' },
          { id: 'no_people', label: 'Não aparecem pessoas' },
          { id: 'wrong_people', label: 'Aparecem pessoas fora da minha preferência ou região' },
          { id: 'requests', label: 'Solicitações de conexão' },
          OTHER,
        ],
      },
    ],
  },
  {
    id: 'marketplace', icon: '🛍️', label: 'Marketplace (compras)',
    description: 'Conteúdos que você comprou',
    questions: [
      {
        id: 'issue', text: 'O que houve?',
        options: [
          { id: 'cant_open', label: 'Não consigo abrir um conteúdo que comprei' },
          { id: 'different', label: 'O conteúdo é diferente do anunciado' },
          { id: 'gone', label: 'Um conteúdo sumiu' },
          { id: 'refund', label: 'Pedido de reembolso' },
          { id: 'screenshot', label: 'Recebi aviso de captura de tela' },
          OTHER,
        ],
      },
    ],
    info: [
      {
        showIf: { questionId: 'issue', optionIds: ['refund'] },
        text: 'O reembolso é pedido em Minhas Compras, pelo botão ↩ do produto, em até 7 dias após o pagamento.',
        action: { label: 'Ir para Minhas Compras', route: 'MyPurchases' },
      },
    ],
  },
  {
    id: 'creator', icon: '🎨', label: 'Sou criador',
    description: 'Produtos, vendas, saques e chave Pix',
    questions: [
      {
        id: 'topic', text: 'Sobre o quê?',
        options: [
          { id: 'become', label: 'Quero ser criador' },
          { id: 'review_slow', label: 'Produto em análise há muito tempo' },
          { id: 'rejected', label: 'Produto ou alteração rejeitada' },
          { id: 'edit', label: 'Editar ou tirar produto da venda' },
          { id: 'sales', label: 'Vendas e comissão' },
          { id: 'withdrawal_late', label: 'Saque atrasado' },
          { id: 'pix', label: 'Chave Pix' },
          { id: 'debt', label: 'Pendência por reembolso' },
          { id: 'coupons', label: 'Cupons' },
          OTHER,
        ],
      },
    ],
    info: [
      {
        showIf: { questionId: 'topic', optionIds: ['pix'] },
        text: 'A chave Pix é cadastrada em Perfil → Configurar Pagamentos.',
        action: { label: 'Configurar Pagamentos', route: 'PaymentSetup' },
      },
    ],
  },
  {
    id: 'report', icon: '🚨', label: 'Denunciar alguém ou algo',
    description: 'Assédio, golpe, perfil falso, conteúdo impróprio',
    pickReportedUser: true,
    suggestAttachment: 'Um print da conversa ou do perfil ajuda a moderação a agir mais rápido.',
    questions: [
      {
        id: 'what', text: 'O que você quer denunciar?',
        options: [
          { id: 'fake', label: 'Perfil falso' },
          { id: 'rep_threat', label: 'Assédio ou ameaça' },
          { id: 'rep_nonconsensual', label: 'Conteúdo íntimo sem consentimento' },
          { id: 'rep_minor', label: 'Possível menor de idade' },
          { id: 'scam', label: 'Golpe ou pedido de dinheiro' },
          { id: 'spam', label: 'Spam ou propaganda' },
          { id: 'hate', label: 'Discurso de ódio' },
          { id: 'marketplace', label: 'Conteúdo do marketplace' },
          OTHER,
        ],
      },
      {
        id: 'where', text: 'Onde aconteceu?',
        options: [
          { id: 'chat', label: 'Conversa' },
          { id: 'profile', label: 'Perfil' },
          { id: 'marketplace', label: 'Marketplace' },
          { id: 'outside', label: 'Fora do app' },
        ],
      },
    ],
    info: [
      {
        showIf: { questionId: 'what', optionIds: ['rep_minor', 'rep_nonconsensual', 'rep_threat'] },
        text: 'Sua denúncia entra como urgente. Se houver risco imediato, ligue 190. Violações contra crianças e adolescentes também podem ser denunciadas no Disque 100.',
        tone: 'danger',
      },
    ],
  },
  {
    id: 'privacy', icon: '🔒', label: 'Privacidade e meus dados',
    description: 'Seus direitos pela LGPD',
    questions: [
      {
        id: 'request', text: 'O que você quer?',
        options: [
          { id: 'copy', label: 'Uma cópia dos meus dados' },
          { id: 'correct', label: 'Corrigir meus dados' },
          { id: 'delete', label: 'Excluir meus dados' },
          { id: 'revoke', label: 'Revogar um consentimento' },
          { id: 'understand', label: 'Entender como vocês usam meus dados' },
          OTHER,
        ],
      },
    ],
  },
  {
    id: 'idea', icon: '💡', label: 'Tenho uma ideia',
    description: 'Sugestões para melhorar o Lumina',
    requiresText: true,
    textPrompt: 'Conte sua ideia. Quanto mais detalhes, melhor.',
    questions: [
      {
        id: 'area', text: 'Sobre qual parte do app?',
        options: [
          { id: 'discover', label: 'Descobrir e Sintonize' },
          { id: 'chat', label: 'Conversas' },
          { id: 'gamification', label: 'Gamificação e recompensas' },
          { id: 'store', label: 'Loja e impulsos' },
          { id: 'galaxia', label: 'Galáxia Plus' },
          { id: 'marketplace', label: 'Marketplace' },
          { id: 'design', label: 'Visual e design' },
          OTHER,
        ],
      },
      {
        id: 'kind', text: 'Que tipo de ideia?',
        options: [
          { id: 'new', label: 'Algo novo' },
          { id: 'improve', label: 'Melhorar algo que existe' },
          { id: 'change', label: 'Mudar algo que incomoda' },
        ],
      },
    ],
  },
  {
    id: 'question', icon: '❓', label: 'Tenho uma dúvida',
    description: 'Como algo funciona no Lumina',
    questions: [
      {
        id: 'topic', text: 'Sobre o quê?',
        options: [
          { id: 'sintonia', label: 'Como a Sintonia funciona' },
          { id: 'crystals', label: 'Cristais gratuitos e premium' },
          { id: 'fragments', label: 'Fragmentos e Cofre' },
          { id: 'galaxia', label: 'Galáxia Plus' },
          { id: 'boosts', label: 'Impulsos' },
          { id: 'destiny', label: 'Carta do Destino' },
          { id: 'missions', label: 'Missões e recompensas' },
          { id: 'creator', label: 'Como ser criador' },
          { id: 'refund', label: 'Reembolsos' },
          { id: 'safety', label: 'Segurança e privacidade' },
          OTHER,
        ],
      },
    ],
    faq: {
      sintonia: 'A Sintonia é uma porcentagem de compatibilidade calculada a partir do que vocês dois informaram no perfil — preferências, idade, região e interesses. Ela ajuda a descobrir pessoas, mas não é uma garantia de afinidade.',
      crystals: 'Cristais gratuitos vêm da recompensa diária, da Faísca, de missões e da conversão de fragmentos. Cristais premium são comprados (pacotes ou Galáxia Plus). Nos itens que aceitam os dois, os gratuitos são usados primeiro. Alguns itens aceitam só premium, como a Carta do Destino paga, molduras, badges da loja, Turbo e Fertilizante.',
      fragments: 'Fragmentos vêm de missões, conquistas, ranking e níveis. O Cofre recebe fragmentos quando visitam, curtem ou sintonizam com você; depois do prazo do ciclo você saca para a carteira (com Galáxia Plus, na hora). Cada 100 fragmentos viram 1 cristal gratuito, na quantidade que você escolher. Fragmentos não expiram.',
      galaxia: 'A Galáxia Plus dá 30 dias de benefícios por um pagamento único, sem renovação automática. Comprar de novo antes de acabar soma mais 30 dias. Os benefícios de cada contratação aparecem na tela da Galáxia Plus.',
      boosts: 'Impulsos colocam seu perfil em mais evidência por um tempo: o Turbo leva você aos primeiros perfis do Sintonize e do Em Alta; o Destaque Regional destaca você na sua cidade, quando ela tem gente suficiente. Ao terminar, você recebe um relatório com as visitas e curtidas que o impulso trouxe.',
      destiny: 'A Carta do Destino mostra duas pessoas por dia, e a que você escolher vira uma conexão com conversa liberada. A primeira carta do dia é grátis; trocar de carta custa cristais premium, com preço crescente. Com Galáxia Plus, as cartas do dia são todas grátis.',
      missions: 'As missões do dia são registradas automaticamente quando você faz a ação — não precisa resgatar. Elas pagam fragmentos, e a missão especial paga cristais, dentro de um limite diário.',
      creator: 'Em Perfil → Ser Criador você envia o pedido. Aprovado, cria produtos, que passam por análise antes de ir à venda. De cada venda, 80% é seu e 20% fica com a plataforma. O saque vai para a chave Pix cadastrada, a partir de R$ 10,00, em até 2 dias úteis.',
      refund: 'Conteúdo do marketplace pode ser reembolsado em até 7 dias após o pagamento, pedindo em Minhas Compras com uma chave Pix para receber. Cristais e itens virtuais, em regra, não são reembolsáveis, ressalvados os direitos garantidos por lei.',
      safety: 'Você pode bloquear qualquer pessoa pelo perfil dela, e denunciar pelo suporte. Nos primeiros encontros, prefira lugares públicos, avise alguém de confiança e nunca envie dinheiro a quem conheceu no app.',
    },
  },
  {
    id: 'other', icon: '✍️', label: 'Outro assunto',
    description: 'Algo que não está nas opções',
    requiresText: true,
    textPrompt: 'Descreva o que você precisa.',
    questions: [
      {
        id: 'confirm', text: 'Como podemos ajudar?',
        options: [
          { id: 'describe', label: 'Quero descrever meu caso' },
        ],
      },
    ],
  },
];

export function categoryById(id: string | null): SupportCategory | null {
  return SUPPORT_CATEGORIES.find(c => c.id === id) ?? null;
}

export function conditionMet(
  cond: SupportCondition | undefined,
  answers: Record<string, { optionIds: string[] }>,
): boolean {
  if (!cond) return true;
  const chosen = answers[cond.questionId]?.optionIds ?? [];
  return chosen.some(o => cond.optionIds.includes(o));
}