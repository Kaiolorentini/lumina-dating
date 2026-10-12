// ============================================
// LUMINA — CONTRATO DO CRIADOR E DECLARAÇÃO DO PRODUTO (APP)
// src/config/legal/creatorAgreement.ts
//
// ESPELHO de functions/src/config/creatorAgreement.ts (12/10/2026).
// O texto e as versões PRECISAM ser iguais aos do servidor — ele
// recusa aceite de outra versão. Ao mudar, troque nos dois e suba a
// versão (deploy das functions antes do eas update).
// ============================================

export const CREATOR_CONTRACT_VERSION = "2026-10-12";
export const CREATOR_CONTRACT_TITLE = "Contrato do Criador Lumina";

export const CREATOR_CONTRACT_SECTIONS: ReadonlyArray<{ heading: string; paragraphs: readonly string[] }> = [
  {
    heading: "Partes",
    paragraphs: [
      "De um lado, os responsáveis pela Lumina, identificados nos Termos de Uso (\"Lumina\"). De outro, o usuário aprovado como criador (\"Criador\").",
    ],
  },
  {
    heading: "1. O que é este contrato",
    paragraphs: [
      "Define as regras para o Criador vender conteúdo digital no marketplace da Lumina. Complementa os Termos de Uso e a Política de Privacidade.",
    ],
  },
  {
    heading: "2. Declarações do Criador",
    paragraphs: [
      "O Criador declara, sob as penas da lei, que:",
      "(a) tem 18 anos ou mais e passou pela verificação de idade da Lumina;",
      "(b) é a única pessoa que aparece em todo o conteúdo que envia (fotos, vídeos, áudios e imagens de capa e prévia);",
      "(c) produziu o conteúdo por vontade própria, sem coação, e é titular de todos os direitos sobre ele;",
      "(d) o conteúdo não envolve, não sugere e não remete a menores de 18 anos, de nenhuma forma;",
      "(e) o conteúdo não foi copiado, baixado ou \"vazado\" de outra pessoa ou plataforma;",
      "(f) o conteúdo não viola lei brasileira nem direitos de terceiros (imagem, autoral, marca, privacidade).",
    ],
  },
  {
    heading: "3. Autorização de uso e divulgação",
    paragraphs: [
      "3.1. O Criador autoriza a Lumina, de forma gratuita e não exclusiva, a armazenar, processar, exibir e entregar o conteúdo aos compradores, dentro do aplicativo, pelo tempo em que o produto estiver à venda e, depois disso, para quem já comprou.",
      "3.2. O Criador autoriza a Lumina a usar a capa, as prévias, o título, o nome artístico e a foto de perfil para divulgar o produto e o próprio Criador, dentro do aplicativo e nos canais oficiais da Lumina (site, e-mail, redes sociais), sempre dentro das regras da vitrine e de restrição etária. Nunca é usado o conteúdo completo, que é pago.",
      "3.3. O Criador pode pedir, a qualquer momento, que a Lumina pare de usar seu material em novas divulgações. Divulgações já publicadas podem continuar até serem removidas, em prazo razoável.",
      "3.4. O Criador continua dono do conteúdo. Esta autorização não transfere a propriedade.",
    ],
  },
  {
    heading: "4. Moderação",
    paragraphs: [
      "4.1. Todo produto, e toda alteração de capa ou de arquivos, passa por análise humana antes de ir ao ar, seguindo os critérios publicados pela Lumina.",
      "4.2. A Lumina pode recusar, suspender ou remover qualquer produto que descumpra este contrato, os Termos ou a lei, informando o motivo, salvo quando informar prejudicar investigação ou a segurança de terceiros.",
      "4.3. Conteúdo com indício de crime, especialmente envolvendo menores, é removido na hora, e a Lumina comunica as autoridades competentes, preservando os dados necessários, como manda a lei.",
    ],
  },
  {
    heading: "5. Vendas, comissão e saques",
    paragraphs: [
      "5.1. Em cada venda, o Criador recebe 80% do valor pago, e a Lumina fica com 20%.",
      "5.2. Saques são feitos por Pix, para a chave cadastrada pelo Criador, nos termos e prazos dos Termos de Uso, incluindo valor mínimo e prazo de reembolso ao comprador.",
      "5.3. Reembolsos e estornos são descontados do saldo do Criador. Se o saldo não bastar, a diferença vira pendência descontada das vendas seguintes.",
      "5.4. A Lumina pode reter valores enquanto investiga denúncia grave ou indício de fraude, pelo tempo necessário e de forma justificada.",
      "5.5. Cada Criador é responsável pelos próprios tributos.",
    ],
  },
  {
    heading: "6. Responsabilidade",
    paragraphs: [
      "6.1. O Criador é o único responsável pelo conteúdo que envia e pelas declarações deste contrato.",
      "6.2. Se a Lumina for cobrada, processada ou multada por causa de conteúdo enviado pelo Criador em desacordo com este contrato, o Criador reembolsa a Lumina pelos valores e custos, incluindo honorários, e assume a defesa quando possível (direito de regresso).",
    ],
  },
  {
    heading: "7. Pedidos de remoção por terceiros",
    paragraphs: [
      "7.1. Qualquer pessoa que afirme aparecer no conteúdo, ou ter direitos sobre ele, pode pedir a remoção pelo e-mail de atendimento.",
      "7.2. A Lumina analisa em até 7 dias úteis. Se o Criador não comprovar que a declaração do item 2 é verdadeira, o conteúdo é removido.",
    ],
  },
  {
    heading: "8. Guarda de registros",
    paragraphs: [
      "O Criador sabe e concorda que a Lumina guarda, pelo prazo previsto na Política de Privacidade, os registros de aceite deste contrato, das declarações de produto e das análises de moderação, para cumprir obrigações legais e para defesa em processo.",
    ],
  },
  {
    heading: "9. Vigência e encerramento",
    paragraphs: [
      "9.1. Este contrato vale enquanto o usuário for criador.",
      "9.2. O Criador pode deixar de vender a qualquer momento retirando os produtos. Quem já comprou mantém o acesso.",
      "9.3. A Lumina pode encerrar a condição de criador em caso de violação grave, sem prejuízo do pagamento de saldos legítimos.",
    ],
  },
  {
    heading: "10. Disposições gerais",
    paragraphs: [
      "Aplica-se a lei brasileira.",
      "O aceite eletrônico no aplicativo vale como assinatura (MP 2.200-2/2001, art. 10, §2º).",
      "Mudanças neste contrato são avisadas e exigem novo aceite para continuar vendendo.",
    ],
  },
];

export const PRODUCT_DECLARATION_VERSION = "2026-10-12";

export const PRODUCT_DECLARATION_ITEMS: readonly string[] = [
  "Só eu apareço em todas as fotos, vídeos, capa e prévias.",
  "Eu produzi todo o conteúdo, por vontade própria, e tenho todos os direitos sobre ele.",
  "Nada no conteúdo envolve ou sugere menores de 18 anos.",
  "O conteúdo não foi copiado nem obtido de outra pessoa ou plataforma.",
  "Autorizo a Lumina a usar a capa e as prévias deste produto para divulgação, conforme o Contrato do Criador.",
];

/** Texto corrido do contrato — é dele que sai o hash gravado no aceite. */
export function creatorContractPlainText(): string {
  return [
    CREATOR_CONTRACT_TITLE,
    ...CREATOR_CONTRACT_SECTIONS.map(s => [s.heading, ...s.paragraphs].join('\n')),
  ].join('\n\n');
}

/** Texto da declaração com o título do produto — é dele que sai o hash. */
export function productDeclarationPlainText(productTitle: string): string {
  return [
    `Declaro, sob as penas da lei, que neste produto, "${productTitle}":`,
    ...PRODUCT_DECLARATION_ITEMS.map((item, i) => `${i + 1}. ${item}`),
  ].join('\n');
}
