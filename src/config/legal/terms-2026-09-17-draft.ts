// ============================================
// LUMINA — TERMOS DE USO
// src/config/legal/terms-2026-09-17-draft.ts
//
// RASCUNHO. Os campos [PREENCHER] precisam de dados reais
// antes do lançamento — a tela de aceite exibe aviso
// enquanto draft: true no index.ts.
//
// Uma seção por item do documento. Editar uma não mexe nas
// outras, e a tela conta as seções para detectar a rolagem
// até o fim.
//
// Seção 9 (comissão 80/20) confirmada no código:
// calculateCommission usa 0.20 de taxa padrão e é chamado
// só pelo createAsaasPayment, sem sobrescrever.
//
// Seção 12 (Galáxia Plus): a assinatura NÃO existe no app
// ainda. Mantida com preço a preencher — remover esta
// seção se o lançamento acontecer antes da funcionalidade.
// ============================================

import { LegalDocument } from './index';

export const TERMS_2026_09_17_DRAFT: LegalDocument = {
  title: 'Termos de Uso',
  version: '2026-09-17-draft',
  effectiveDate: '[PREENCHER: data de vigência]',
  sections: [
    {
      heading: '1. Identificação da Plataforma e do Operador',
      body: [
        'A Lumina ("Lumina", "Plataforma" ou "Serviço") é uma plataforma digital de relacionamento destinada exclusivamente a pessoas maiores de 18 (dezoito) anos, que disponibiliza funcionalidades de relacionamento, comunicação entre usuários, recursos de personalização e gamificação, além de marketplace para comercialização de conteúdo digital destinado ao público adulto.',
        'A Lumina é operada por: [PREENCHER: nome ou razão social], inscrita sob [PREENCHER: CNPJ ou CPF], com endereço em [PREENCHER: endereço completo].',
        'E-mail de atendimento: [PREENCHER: e-mail]. E-mail jurídico: [PREENCHER: e-mail jurídico]. Encarregado de Dados (DPO): [PREENCHER: nome], contato [PREENCHER: e-mail do DPO].',
        'Ao criar uma conta, acessar ou utilizar a Lumina, o usuário declara que leu, compreendeu e concorda com estes Termos de Uso e com a Política de Privacidade vigente. Caso o usuário não concorde com estes Termos, não deverá criar conta ou utilizar a Plataforma.',
      ],
    },
    {
      heading: '2. Elegibilidade e restrição etária',
      body: [
        'A Lumina é destinada exclusivamente a pessoas com 18 (dezoito) anos ou mais. É proibido criar, manter ou utilizar conta na Lumina quando o usuário for menor de 18 anos.',
        'A Lumina poderá solicitar mecanismos de verificação de idade e identidade, inclusive documento oficial e selfie, para confirmar que o usuário possui idade mínima para utilização do Serviço. Quando houver verificação documental, os arquivos utilizados para essa finalidade serão tratados conforme a Política de Privacidade.',
        'A declaração do usuário de que possui 18 anos ou mais não impede a Lumina de realizar verificações adicionais de idade ou identidade sempre que necessárias à segurança, prevenção de fraude e cumprimento da legislação aplicável.',
        'O fornecimento de informação falsa sobre idade, identidade ou documentos constitui violação grave destes Termos. A Lumina poderá, conforme a gravidade do caso, suspender ou encerrar a conta, bloquear funcionalidades, cancelar transações ainda não liquidadas quando juridicamente permitido, preservar registros necessários para investigação ou cumprimento de obrigação legal, e comunicar fatos às autoridades competentes quando houver indícios de ilícito.',
        'É absolutamente proibido publicar, solicitar, armazenar, vender, comprar, compartilhar, transmitir ou facilitar qualquer conteúdo sexual envolvendo criança ou adolescente.',
        'Também são proibidos conteúdos que sexualizem, erotizem ou explorem menores, mesmo quando apresentados como ficção, simulação, montagem ou material gerado digitalmente, quando sua disponibilização for proibida pela legislação aplicável. A identificação de conteúdo dessa natureza poderá resultar em remoção imediata, preservação de evidências e comunicação às autoridades competentes.',
      ],
    },
    {
      heading: '3. Cadastro e conta',
      body: [
        'O usuário deverá fornecer informações verdadeiras, atualizadas e compatíveis com sua identidade.',
        'Salvo autorização expressa da Lumina, cada pessoa poderá manter apenas uma conta. É proibido criar contas adicionais para contornar bloqueios, restrições, sistemas de segurança, limitações comerciais ou medidas disciplinares.',
        'O usuário é responsável por manter suas credenciais de acesso protegidas e não deverá compartilhar senha, código de autenticação ou outros mecanismos de acesso com terceiros.',
        'A conta é pessoal e não poderá ser vendida, cedida, alugada ou transferida para outra pessoa.',
      ],
    },
    {
      heading: '4. Perfil e funcionalidades de relacionamento',
      body: [
        'O usuário poderá criar perfil contendo, conforme as funcionalidades disponíveis: nome; idade ou data de nascimento; cidade e estado; gênero; preferências de relacionamento; biografia; fotografia; e outras informações voluntariamente disponibilizadas.',
        'O usuário reconhece que determinadas informações de perfil poderão ser exibidas a outros usuários da Plataforma de acordo com as configurações e funcionalidades disponíveis.',
        'A Lumina poderá utilizar o recurso denominado "Sintonia", que calcula compatibilidade entre usuários a partir de informações disponíveis nos respectivos perfis, preferências, interações e outros critérios técnicos definidos pela Plataforma. O resultado da Sintonia é uma ferramenta de descoberta e não constitui garantia de compatibilidade pessoal, afetiva, sexual, emocional ou de qualquer outra natureza.',
        'Quando dois usuários demonstrarem interesse mútuo por meio das funcionalidades disponibilizadas, poderá ser criada uma conexão entre eles, que poderá permitir o acesso ao chat ou a outras funcionalidades.',
        'Usuários conectados poderão trocar mensagens conforme as funcionalidades da Plataforma. É proibido utilizar mensagens para assediar; ameaçar; perseguir ou intimidar; praticar discriminação ilícita; enviar spam; praticar fraude; solicitar ou distribuir conteúdo ilegal; praticar extorsão ou chantagem; divulgar conteúdo íntimo sem autorização; ou praticar qualquer conduta ilícita.',
        'A Lumina poderá registrar a visita de um usuário ao perfil de outro usuário. Quando disponível, a identidade de visitantes poderá ser revelada mediante utilização de Cristais ou outro recurso previsto pela Plataforma.',
      ],
    },
    {
      heading: '5. Notificações',
      body: [
        'A Lumina poderá enviar notificações relacionadas a novas conexões; mensagens; curtidas; visitas; atividades da conta; segurança; transações; recompensas; funcionalidades da Plataforma; e alterações relevantes nos Serviços.',
        'O usuário poderá controlar as notificações não essenciais por meio das configurações disponíveis no aplicativo ou dispositivo. Notificações necessárias à segurança, transações, autenticação ou funcionamento essencial poderão continuar sendo enviadas quando necessárias.',
      ],
    },
    {
      heading: '6. Marketplace de conteúdo adulto',
      body: [
        'A Lumina poderá disponibilizar um marketplace no qual usuários aprovados como "Criadores" poderão oferecer conteúdo digital destinado exclusivamente ao público adulto.',
        'Observada a legislação brasileira e estes Termos, poderão ser comercializados, conforme aprovação da Lumina: fotografias; vídeos; cursos; materiais em PDF; conteúdos educativos relacionados à sexualidade; e outros conteúdos digitais adultos permitidos pela Plataforma.',
        'É proibido oferecer, vender, publicar ou distribuir: conteúdo envolvendo menores; exploração sexual; tráfico ou exploração de pessoas; conteúdo sexual não consensual; conteúdo íntimo de terceiros sem autorização; conteúdo obtido mediante invasão de privacidade; material que viole direitos autorais, de imagem ou outros direitos de terceiros; conteúdo que incentive prática criminosa; conteúdo cuja comercialização seja proibida pela legislação; material fraudulento ou enganoso; e conteúdo que contenha dados pessoais de terceiros sem base jurídica adequada.',
        'O Criador é integralmente responsável pela legalidade do conteúdo que publica e comercializa, e declara possuir todos os direitos, autorizações e licenças necessários para utilizar sua própria imagem; imagem, voz ou nome de terceiros; músicas; fotografias; vídeos; textos; obras intelectuais; marcas; e qualquer outro material de terceiros.',
        'Caso terceiros apareçam em conteúdo publicado pelo Criador, o Criador deverá possuir autorização válida para utilização e comercialização da respectiva imagem e demais direitos envolvidos. A Lumina poderá solicitar comprovação dessas autorizações.',
        'O conteúdo enviado ao marketplace poderá passar por análise humana e/ou automatizada antes da publicação. A aprovação não representa declaração da Lumina de que o conteúdo possui todos os direitos necessários ou de que está livre de qualquer vício jurídico.',
        'Mesmo após aprovação, a Lumina poderá remover conteúdo quando houver denúncia; surgir informação de violação de direitos; forem identificados riscos legais ou de segurança; houver violação destes Termos; houver determinação administrativa ou judicial; ou houver necessidade de proteção dos usuários ou da Plataforma.',
      ],
    },
    {
      heading: '7. Proteção contra capturas de tela',
      body: [
        'A Lumina poderá utilizar mecanismos técnicos para detectar ou tentar detectar capturas de tela, gravações ou comportamentos semelhantes, quando tecnicamente disponíveis.',
        'A detecção poderá gerar advertência, registro de ocorrência ou outras medidas de segurança. Em caso de reincidência, a Lumina poderá restringir ou suspender a conta, observadas as regras de proporcionalidade e contestação.',
        'Nenhuma tecnologia de detecção garante identificação de todas as formas de captura, gravação ou reprodução externa. O usuário permanece proibido de reproduzir ou redistribuir conteúdo adquirido sem autorização.',
      ],
    },
    {
      heading: '8. Compra de conteúdo',
      body: [
        'O comprador poderá adquirir conteúdos individuais disponibilizados no marketplace mediante os meios de pagamento disponibilizados pela Lumina.',
        'A compra concede ao comprador apenas o direito de acessar e utilizar o conteúdo para fins pessoais, dentro dos limites definidos pelo Criador e pela Plataforma. A compra não transfere propriedade intelectual sobre o conteúdo.',
        'É proibido compartilhar o arquivo; vender o conteúdo; redistribuí-lo; disponibilizá-lo gratuitamente a terceiros; publicar o conteúdo em outras plataformas; criar cópias destinadas à exploração comercial; remover mecanismos de proteção; e contornar limitações técnicas de acesso.',
        'As regras de cancelamento, arrependimento, reembolso e demais direitos do consumidor serão observadas nos limites da legislação aplicável, inclusive o Código de Defesa do Consumidor. A previsão de que determinado saldo ou item seja "não reembolsável" não afasta direitos que sejam legalmente indisponíveis. O CDC prevê, em determinadas contratações realizadas fora do estabelecimento comercial, direito de arrependimento de 7 dias.',
      ],
    },
    {
      heading: '9. Criadores e repasses',
      body: [
        'A condição de Criador depende da aprovação da Lumina e do cumprimento dos requisitos de cadastro, identidade, segurança e documentação estabelecidos pela Plataforma.',
        'Do valor efetivamente recebido em uma venda, o Criador receberá 80% (oitenta por cento) e a Lumina retém 20% (vinte por cento) a título de comissão da Plataforma. A base de cálculo é apresentada ao Criador antes da publicação ou venda do conteúdo.',
        'Os valores elegíveis para saque serão disponibilizados em até 2 (dois) dias úteis contados da solicitação. Poderão existir períodos de retenção destinados à prevenção de fraude, chargebacks, estornos, disputas e cumprimento de obrigações legais.',
        'O valor mínimo para solicitação de saque será de [PREENCHER: valor mínimo de saque].',
        'O Criador deverá fornecer dados bancários válidos para recebimento dos valores, sendo sua a responsabilidade pela exatidão desses dados.',
        'Cada Criador é responsável pelos tributos incidentes sobre sua atividade, sem prejuízo das obrigações legais de retenção, informação ou recolhimento que possam ser atribuídas à Lumina. Quando exigido por lei, poderão ocorrer retenções tributárias.',
      ],
    },
    {
      heading: '10. Economia virtual',
      body: [
        'Os Cristais Gratuitos são unidades virtuais disponibilizadas pela Plataforma em razão de determinadas atividades ou critérios de engajamento.',
        'Os Cristais Premium são unidades virtuais adquiridas mediante pagamento ou disponibilizadas conforme regras comerciais específicas.',
        'Os Fragmentos são unidades virtuais que poderão ser convertidas em Cristais conforme as regras vigentes na Plataforma. A taxa de conversão será de [PREENCHER: taxa de conversão Fragmentos para Cristais].',
        'Cristais, Fragmentos e demais unidades virtuais não constituem moeda oficial; não constituem depósito bancário; não constituem valor mobiliário; não constituem investimento; não constituem criptoativo; não representam participação societária; não constituem dinheiro eletrônico; e não possuem valor monetário fora da Plataforma.',
        'A aquisição ou recebimento de unidades virtuais concede ao usuário uma licença limitada, pessoal, revogável e não transferível para utilização dentro da Plataforma. O usuário não adquire propriedade sobre o sistema econômico da Lumina.',
        'É proibida a venda, troca, doação, cessão ou transferência de Cristais ou Fragmentos entre usuários, salvo funcionalidade expressamente disponibilizada pela Lumina.',
        'Cristais e Fragmentos não poderão ser convertidos diretamente em dinheiro pelo usuário.',
        'As unidades virtuais são, em regra, não reembolsáveis, ressalvados direitos legalmente assegurados ao consumidor e situações expressamente determinadas pela Lumina.',
        'A Lumina poderá modificar preços, taxas, formas de obtenção, funcionalidades ou regras de utilização das unidades virtuais, desde que respeitados direitos adquiridos, contratos vigentes e a legislação aplicável.',
      ],
    },
    {
      heading: '11. Itens virtuais',
      body: [
        'A Lumina poderá oferecer molduras de perfil; emblemas; impulsos de visibilidade; recursos de revelação; e outros itens digitais.',
        'Salvo indicação expressa de permanência, molduras e emblemas poderão ser disponibilizados por período determinado de 30 (trinta) dias.',
        'Alguns itens poderão ser classificados como permanentes. A condição de permanente será informada no momento da aquisição.',
        'Itens virtuais não possuem valor monetário fora da Plataforma e não podem ser transferidos entre usuários.',
      ],
    },
    {
      heading: '12. Galáxia Plus',
      body: [
        'A Lumina poderá disponibilizar a assinatura mensal denominada "Galáxia Plus", ao preço de [PREENCHER: preço mensal].',
        'A assinatura concederá os benefícios descritos na tela de contratação vigente no momento da aquisição.',
        'A modalidade de renovação será: [PREENCHER: automática ou manual].',
        'O assinante poderá solicitar o cancelamento pelos mecanismos disponibilizados pela Plataforma. O cancelamento não implica automaticamente restituição proporcional de período já utilizado, sem prejuízo dos direitos previstos na legislação aplicável.',
      ],
    },
    {
      heading: '13. Gamificação',
      body: [
        'A Lumina poderá oferecer recursos de gamificação, incluindo XP; níveis; conquistas; coleções; ranking semanal; recompensas diárias; sequência de utilização ("streak"); e Árvore da Sintonia.',
        'Esses recursos possuem finalidade de entretenimento e engajamento e não representam patrimônio, investimento ou direito adquirido a benefícios futuros, salvo quando expressamente indicado.',
        'A Lumina poderá alterar critérios de pontuação, classificação e recompensas.',
      ],
    },
    {
      heading: '14. Condutas proibidas',
      body: [
        'É proibido utilizar a Lumina para assediar, ameaçar ou intimidar outra pessoa; praticar perseguição ou stalking; divulgar conteúdo íntimo sem consentimento; divulgar informações privadas de terceiros; publicar ou solicitar conteúdo envolvendo menores; explorar sexualmente qualquer pessoa; utilizar conteúdo não consensual.',
        'Também é proibido praticar fraude; manipular transações; explorar falhas econômicas ou técnicas da Plataforma; criar múltiplas contas para obter vantagens; realizar spam; enviar mensagens automatizadas não autorizadas; utilizar bots ou sistemas automatizados sem autorização.',
        'É igualmente proibido redistribuir conteúdo comprado; violar direitos autorais; violar direitos de imagem; utilizar identidade falsa para fraude; comercializar produtos ou serviços ilícitos; tentar burlar sistemas de segurança; interferir no funcionamento da Plataforma; praticar discriminação ilícita; tentar obter acesso à conta de terceiros; e utilizar a Plataforma para qualquer finalidade ilícita.',
      ],
    },
    {
      heading: '15. Moderação, suspensão e banimento',
      body: [
        'A Lumina poderá moderar conteúdos, perfis, mensagens e atividades para proteger usuários, cumprir a legislação e preservar a segurança da Plataforma.',
        'Dependendo da situação, poderão ser aplicadas: advertência; remoção de conteúdo; limitação de funcionalidade; suspensão temporária; suspensão de monetização; retenção preventiva de valores quando juridicamente justificável; encerramento da conta; e banimento.',
        'A medida aplicada considerará, quando possível, a gravidade; a reincidência; o risco de dano; a intenção aparente; o alcance da conduta; e o histórico da conta.',
        'A Lumina poderá suspender imediatamente uma conta quando houver risco relevante à segurança de usuários, indícios de fraude, exploração sexual, conteúdo envolvendo menores, violência, ameaça ou outra situação grave.',
        'O usuário poderá contestar medidas disciplinares pelo canal [PREENCHER: canal de contestação]. A contestação deverá, sempre que possível, apresentar a identificação da conta; a medida contestada; o motivo da contestação; e informações ou documentos relevantes.',
        'A apresentação de contestação não garante reativação da conta. A Lumina analisará a contestação segundo critérios internos, legislação aplicável e evidências disponíveis.',
      ],
    },
    {
      heading: '16. Propriedade intelectual da Lumina',
      body: [
        'A marca Lumina, nome, logotipo, interface, código-fonte, banco de dados, design, textos, elementos gráficos, funcionalidades, algoritmos, sistemas, organização e demais elementos próprios da Plataforma são protegidos pela legislação aplicável.',
        'É proibido copiar, reproduzir, modificar, distribuir, vender, realizar engenharia reversa ou explorar comercialmente elementos da Plataforma sem autorização.',
        'A Lumina concede ao usuário licença limitada, pessoal, não exclusiva, revogável e não transferível para utilizar a Plataforma durante a vigência de sua conta.',
      ],
    },
    {
      heading: '17. Conteúdo do usuário',
      body: [
        'O usuário permanece titular dos direitos que legalmente possuir sobre seus conteúdos.',
        'Ao publicar conteúdo na Lumina, o usuário concede à Plataforma licença limitada, não exclusiva e necessária à hospedagem, armazenamento, processamento, reprodução técnica, exibição e disponibilização do conteúdo dentro das funcionalidades escolhidas pelo próprio usuário.',
        'Quando necessário ao funcionamento da Plataforma, essa licença poderá abranger fornecedores tecnológicos que atuem em nome da Lumina.',
        'A licença não autoriza a Lumina a vender o conteúdo pessoal do usuário como produto independente fora das funcionalidades contratadas.',
      ],
    },
    {
      heading: '18. Interações entre usuários',
      body: [
        'A Lumina é uma plataforma de relacionamento e não garante que os usuários sejam quem afirmam ser, que suas informações sejam completas ou que suas intenções sejam legítimas. O usuário deve utilizar cautela ao interagir com outras pessoas.',
        'A decisão de realizar encontro presencial é exclusivamente do usuário. A Lumina recomenda realizar os primeiros encontros em local público; informar pessoa de confiança; evitar compartilhar dados financeiros; não enviar dinheiro a desconhecidos; e interromper contato diante de comportamento ameaçador ou suspeito.',
        'A Lumina não garante segurança, compatibilidade, honestidade, identidade ou comportamento de outro usuário e não controla acontecimentos ocorridos fora da Plataforma. Essa disposição não exclui responsabilidades que não possam ser legalmente afastadas.',
      ],
    },
    {
      heading: '19. Pagamentos',
      body: [
        'Os pagamentos poderão ser processados por terceiros especializados, incluindo o Asaas, conforme disponibilidade.',
        'O CPF solicitado durante determinadas compras poderá ser encaminhado diretamente ao processador de pagamento, não sendo armazenado pela Lumina, conforme descrito na Política de Privacidade.',
        'Dados de pagamento poderão ser tratados pelo respectivo processador de acordo com seus próprios termos e políticas.',
      ],
    },
    {
      heading: '20. Disponibilidade do serviço',
      body: [
        'A Lumina buscará manter o Serviço disponível, mas não garante funcionamento ininterrupto.',
        'Poderão ocorrer indisponibilidades decorrentes de manutenção; falhas de infraestrutura; problemas de internet; indisponibilidade de terceiros; ataques cibernéticos; eventos de força maior; e determinações administrativas ou judiciais.',
      ],
    },
    {
      heading: '21. Limitação de responsabilidade',
      body: [
        'Na máxima extensão permitida pela legislação, a Lumina não será responsável por atos ilícitos praticados independentemente por usuários.',
        'A Lumina não garante que todos os perfis sejam autênticos; que haverá compatibilidade entre usuários; que uma conexão resultará em relacionamento; que encontros presenciais serão seguros; que conteúdos publicados por terceiros sejam verdadeiros; ou que conteúdo comprado não seja indevidamente capturado por meios externos.',
        'Nada neste documento limita direitos de consumidores ou responsabilidades que sejam inderrogáveis por lei.',
      ],
    },
    {
      heading: '22. Rescisão e encerramento da conta',
      body: [
        'O usuário poderá solicitar o encerramento da conta pelo mecanismo disponibilizado pela Plataforma.',
        'A Lumina poderá encerrar a conta em caso de violação destes Termos; fraude; risco de segurança; obrigação legal ou judicial; uso ilícito; ou reincidência em violações.',
        'Com o encerramento, o acesso às funcionalidades poderá ser interrompido; itens virtuais poderão deixar de estar disponíveis; conteúdos publicados poderão ser removidos; valores devidos poderão ser tratados conforme as regras aplicáveis; e dados poderão ser mantidos quando houver fundamento legal para retenção.',
        'O encerramento de conta de Criador não elimina automaticamente valores legitimamente devidos ao Criador, ressalvadas situações de fraude, chargeback, disputa, obrigação legal ou outras hipóteses juridicamente justificadas.',
      ],
    },
    {
      heading: '23. Alterações destes Termos',
      body: [
        'A Lumina poderá atualizar estes Termos para refletir mudanças legais; incluir ou remover funcionalidades; alterar regras comerciais; melhorar segurança; ou corrigir erros.',
        'Alterações relevantes serão comunicadas de maneira adequada. A versão vigente será identificada pelo número e pela data de atualização.',
      ],
    },
    {
      heading: '24. Comunicações eletrônicas',
      body: [
        'O usuário concorda que comunicações relacionadas à conta, transações, segurança e funcionamento da Plataforma poderão ser realizadas eletronicamente por e-mail; notificações no aplicativo; mensagens dentro da Plataforma; e outros canais cadastrados.',
      ],
    },
    {
      heading: '25. Legislação aplicável e foro',
      body: [
        'Estes Termos são regidos pelas leis da República Federativa do Brasil.',
        'Fica eleito o foro de [PREENCHER: cidade/UF], observadas as regras legais de competência e, nas relações de consumo, os direitos legalmente assegurados ao consumidor quanto ao foro competente.',
      ],
    },
    {
      heading: '26. Disposições finais',
      body: [
        'Caso alguma disposição destes Termos seja considerada inválida, as demais permanecerão em vigor na máxima extensão permitida pela legislação.',
        'A eventual tolerância da Lumina quanto ao descumprimento de uma obrigação não constitui renúncia de direito.',
        'A Política de Privacidade integra estes Termos de Uso.',
        'Ao utilizar a Lumina, o usuário declara que possui pelo menos 18 anos; fornecerá informações verdadeiras; respeitará os demais usuários; não utilizará a Plataforma para finalidade ilícita; não distribuirá conteúdo comprado; respeitará direitos autorais, de imagem e privacidade; e cumprirá estes Termos.',
      ],
    },
  ],
};