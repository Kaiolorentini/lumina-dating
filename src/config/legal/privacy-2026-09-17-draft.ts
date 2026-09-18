// ============================================
// LUMINA — POLÍTICA DE PRIVACIDADE
// src/config/legal/privacy-2026-09-17-draft.ts
//
// RASCUNHO. Os campos [PREENCHER] precisam de dados reais
// antes do lançamento — a tela de aceite exibe aviso
// enquanto draft: true no index.ts.
//
// A seção 8 descreve exatamente o que o código faz: três
// imagens (frente, verso, selfie), apagadas na aprovação E
// na rejeição, links assinados de 10 minutos, e só status,
// data e data de nascimento verificada são guardados.
// SE O CÓDIGO MUDAR, ESTA SEÇÃO MUDA JUNTO.
//
// A seção 12.2 (CPF não armazenado) também reflete o
// código: o campo users/{uid}.cpf foi eliminado da base e
// o CPF vai direto ao Asaas a cada compra.
// ============================================

import { LegalDocument } from './index';

export const PRIVACY_2026_09_17_DRAFT: LegalDocument = {
  title: 'Política de Privacidade',
  version: '2026-09-17-draft',
  effectiveDate: '[PREENCHER: data de vigência]',
  sections: [
    {
      heading: '1. Apresentação',
      body: [
        'Esta Política de Privacidade explica como a Lumina coleta, utiliza, armazena, compartilha e protege dados pessoais de seus usuários.',
        'A Lumina reconhece a importância da privacidade e trata dados pessoais de acordo com a Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais ("LGPD"), o Marco Civil da Internet, a legislação de defesa do consumidor e demais normas aplicáveis.',
        'A LGPD estabelece diferentes bases legais para tratamento de dados pessoais, incluindo consentimento, cumprimento de obrigação legal, execução de contrato, exercício regular de direitos, proteção da vida e legítimo interesse.',
      ],
    },
    {
      heading: '2. Controlador',
      body: [
        'O controlador dos dados pessoais é: [PREENCHER: nome ou razão social], inscrito sob [PREENCHER: CNPJ ou CPF], com endereço em [PREENCHER: endereço], e-mail [PREENCHER: e-mail].',
        'Encarregado de Proteção de Dados (DPO): [PREENCHER: nome]. Contato do DPO: [PREENCHER: e-mail do DPO].',
      ],
    },
    {
      heading: '3. Princípios',
      body: [
        'A Lumina busca tratar dados pessoais observando, entre outros, os princípios de finalidade; adequação; necessidade; livre acesso; qualidade dos dados; transparência; segurança; prevenção; não discriminação; e responsabilização e prestação de contas.',
      ],
    },
    {
      heading: '4. Cadastro e identificação',
      body: [
        'Podemos tratar nome; e-mail; data de nascimento; idade; foto de perfil; e credenciais e identificadores de conta.',
        'Esses dados são utilizados para criação e manutenção da conta; autenticação; funcionamento do perfil; comunicação; segurança; e prevenção de fraude.',
        'Base legal, em regra: execução de contrato ou procedimentos preliminares (art. 7º, V, LGPD); cumprimento de obrigação legal (art. 7º, II), quando aplicável; e legítimo interesse (art. 7º, IX), quando adequado e após avaliação de necessidade e balanceamento.',
      ],
    },
    {
      heading: '5. Localização',
      body: [
        'A Lumina poderá tratar cidade; estado; e código do município segundo referência do IBGE. A Lumina não utiliza GPS contínuo para funcionamento normal do Serviço.',
        'A localização aproximada por município poderá ser utilizada para apresentar usuários da mesma região; melhorar a Sintonia; organizar recursos regionais; personalizar funcionalidades; e prevenir fraude e abuso.',
        'A Plataforma poderá consultar dados públicos do IBGE para identificação e padronização de municípios e respectivos códigos.',
        'Base legal: execução do contrato, quando necessária à funcionalidade escolhida pelo usuário, e/ou legítimo interesse, quando aplicável.',
      ],
    },
    {
      heading: '6. Gênero e preferências de relacionamento',
      body: [
        'A Lumina poderá tratar informações relacionadas a gênero e preferências de relacionamento para permitir a personalização da experiência de dating e o cálculo de compatibilidade.',
        'Dependendo do conteúdo efetivamente informado pelo usuário, determinadas informações relacionadas à orientação sexual ou à vida sexual podem constituir dados pessoais sensíveis nos termos da LGPD. A LGPD possui regime específico para dados sensíveis e estabelece hipóteses próprias para seu tratamento no art. 11.',
        'Quando o dado constituir dado pessoal sensível, a Lumina utilizará a hipótese legal apropriada do art. 11 da LGPD. Quando o tratamento depender de consentimento, este será obtido de forma específica e destacada para a finalidade correspondente.',
        'Esses dados serão utilizados para configurar preferências de descoberta; realizar correspondências; calcular Sintonia; e permitir que o usuário encontre perfis compatíveis. A Lumina não deverá utilizar essas informações para publicidade de terceiros.',
      ],
    },
    {
      heading: '7. Fotografias',
      body: [
        'As fotografias fornecidas pelo usuário poderão ser utilizadas para exibição do perfil; identificação visual dentro da Plataforma; moderação; segurança; prevenção de fraude; e funcionamento do marketplace quando o usuário for Criador.',
        'A fotografia de perfil poderá ficar visível para outros usuários conforme as configurações da Plataforma.',
      ],
    },
    {
      heading: '8. Verificação de idade e identidade',
      body: [
        'Para verificar idade e identidade, a Lumina solicita a fotografia da frente e do verso de documento oficial, uma fotografia do usuário segurando o documento e a data de nascimento constante no documento.',
        'O processamento da fotografia do usuário para fins de conferência com o documento pode envolver características biométricas e, nessa medida, constitui tratamento de dado pessoal sensível, sujeito ao art. 11 da LGPD. Por essa razão, o consentimento para esta finalidade é colhido de forma específica e destacada.',
        'Esses dados são tratados exclusivamente para verificar a idade mínima; prevenir fraude; impedir contas de menores; proteger usuários; e atender obrigações legais. Não são utilizados para publicidade.',
        'As imagens do documento e a fotografia enviadas são ELIMINADAS após a análise, tanto em caso de aprovação quanto em caso de rejeição, salvo quando houver fundamento legal específico que exija sua conservação.',
        'A Lumina conserva apenas o status da verificação; a data da análise; a data de nascimento verificada; a identificação de quem realizou a análise; e o motivo, quando houver rejeição.',
        'O acesso às imagens durante a análise é restrito à equipe de moderação autorizada, por meio de links temporários com validade de 10 (dez) minutos. As imagens não ficam acessíveis ao próprio usuário nem a outros usuários em nenhum momento.',
        'Por disponibilizar conteúdo adulto, a Lumina adota mecanismos destinados a impedir o acesso de menores. A legislação brasileira prevê mecanismos confiáveis de verificação de idade para acesso a conteúdo pornográfico e veda a utilização de simples autodeclaração como único mecanismo.',
      ],
    },
    {
      heading: '9. Dados de comportamento e uso',
      body: [
        'A Lumina poderá tratar perfis visitados; curtidas; conexões; mensagens; interações; tempo de uso; itens adquiridos; utilização de recursos; XP; níveis; conquistas; coleções; ranking; streaks; e utilização da Árvore da Sintonia.',
        'Esses dados poderão ser utilizados para fornecer funcionalidades; calcular Sintonia; personalizar recomendações dentro da Plataforma; fornecer gamificação; prevenir fraude; proteger usuários; gerar estatísticas internas; melhorar produtos e funcionalidades; e cumprir obrigações legais.',
        'Base legal, conforme a finalidade concreta: execução de contrato; legítimo interesse; consentimento, quando necessário; exercício regular de direitos; e cumprimento de obrigação legal.',
      ],
    },
    {
      heading: '10. Mensagens',
      body: [
        'As mensagens trocadas pelos usuários poderão ser tratadas para disponibilizar o serviço de comunicação.',
        'Poderão também ser tratadas, dentro dos limites legais, para prevenção de abuso; segurança; investigação de denúncias; cumprimento de ordem judicial; exercício regular de direitos; e cumprimento de obrigações legais.',
        'A Lumina não deverá utilizar o conteúdo privado das mensagens para publicidade de terceiros. O acesso ao conteúdo deverá ser limitado a situações e pessoas autorizadas, segundo controles internos e legislação aplicável.',
        'O Marco Civil da Internet protege o sigilo das comunicações privadas armazenadas, ressalvadas as hipóteses legais, inclusive mediante ordem judicial.',
      ],
    },
    {
      heading: '11. Visitas a perfis',
      body: [
        'A Lumina poderá registrar o perfil visitado; o usuário visitante; a data e hora; e informações técnicas necessárias.',
        'Esses dados poderão ser utilizados para fornecer a funcionalidade de visitantes e, quando disponível, permitir a revelação da identidade do visitante mediante recurso pago.',
      ],
    },
    {
      heading: '12. Compras e pagamentos',
      body: [
        'A Lumina poderá tratar informações relacionadas às transações, como produto adquirido; valor; data; status; usuário comprador; identificadores da transação; e informações necessárias à conciliação.',
        'Quando exigido no processo de compra, o CPF será solicitado e encaminhado diretamente ao Asaas, processador de pagamentos utilizado pela Lumina. A Lumina não armazena o CPF utilizado na compra.',
        'O Asaas poderá tratar dados pessoais conforme suas próprias responsabilidades e políticas aplicáveis.',
        'A Lumina poderá conservar informações sobre a transação pelo tempo necessário para comprovação da operação; contabilidade; prevenção de fraude; defesa de direitos; e cumprimento de obrigações legais.',
      ],
    },
    {
      heading: '13. Dados dos Criadores',
      body: [
        'Criadores poderão fornecer dados cadastrais; dados de identificação; informações fiscais; dados bancários necessários ao pagamento; informações sobre vendas; e informações de saque.',
        'Essas informações são utilizadas para habilitação como Criador; processamento de repasses; prevenção de fraude; cumprimento tributário; prestação de contas; e cumprimento de obrigações legais.',
        'Dados bancários poderão ser compartilhados com instituições financeiras, prestadores de pagamento ou outros fornecedores necessários ao repasse.',
      ],
    },
    {
      heading: '14. Notificações push',
      body: [
        'A Lumina poderá tratar token de notificação push; identificador do dispositivo; e informações necessárias ao envio. O serviço de notificações poderá utilizar infraestrutura da Expo e outros fornecedores tecnológicos necessários.',
        'A finalidade é enviar mensagens; conexões; visitas; alertas de conta; segurança; transações; e outras notificações autorizadas.',
      ],
    },
    {
      heading: '15. Economia virtual e gamificação',
      body: [
        'Poderão ser tratados dados sobre Cristais Gratuitos; Cristais Premium; Fragmentos; itens virtuais; assinaturas; XP; níveis; conquistas; ranking; streaks; e Árvore da Sintonia.',
        'Esses dados são necessários para execução e gerenciamento das funcionalidades correspondentes.',
      ],
    },
    {
      heading: '16. Moderação e segurança',
      body: [
        'A Lumina poderá tratar dados e conteúdos para detectar violações; analisar denúncias; moderar conteúdo; impedir fraude; investigar comportamento abusivo; proteger usuários; detectar tentativa de captura de tela, quando tecnicamente possível; e cumprir obrigações legais.',
        'O tratamento poderá envolver sistemas automatizados e revisão humana. Quando decisões automatizadas produzirem efeitos relevantes sobre o usuário, serão observados os direitos previstos na legislação aplicável.',
      ],
    },
        {
      heading: '17. Bases legais — resumo',
      body: [
        'Cadastro, para criar conta: art. 7º, V. Autenticação, para segurança e acesso: art. 7º, V e IX. Nome e perfil, para relacionamento: art. 7º, V. Cidade e estado, para compatibilidade: art. 7º, V e/ou IX.',
        'Preferências de relacionamento, para a Sintonia: art. 11, conforme a natureza do dado. Verificação de idade, para impedir menores e fraude: art. 11 quando envolver dado sensível, e demais bases aplicáveis. Documento, para verificação: art. 7º ou 11 conforme o tratamento. Selfie e biometria, para autenticação e verificação: art. 11.',
        'Mensagens, para comunicação: art. 7º, V. Visitas, para a funcionalidade de visitantes: art. 7º, V. Compras, para execução da transação: art. 7º, V. Registros fiscais, para cumprimento legal: art. 7º, II.',
        'Segurança, para prevenção de fraude: art. 7º, IX e/ou outras bases aplicáveis. Contestação judicial, para defesa de direitos: art. 7º, VI. Notificações, para funcionamento do serviço: art. 7º, V. Marketing próprio, para divulgação de funcionalidades: art. 7º, IX ou consentimento, conforme o caso. Publicidade de terceiros: não realizada.',
        'A base legal efetivamente utilizada será documentada internamente pelo controlador conforme cada operação de tratamento.',
      ],
    },
    {
      heading: '18. Compartilhamento de dados',
      body: [
        'A Lumina poderá compartilhar dados pessoais com prestadores necessários ao funcionamento da Plataforma.',
        'Google Firebase: utilizado para infraestrutura tecnológica, incluindo autenticação; banco de dados; armazenamento; funções; e infraestrutura relacionada.',
        'Asaas: utilizado para processamento de pagamentos, conforme a operação contratada.',
        'Expo: utilizado para infraestrutura de notificações push.',
        'IBGE: poderá ser consultado para padronização e identificação de municípios.',
        'Autoridades: dados poderão ser fornecidos quando houver obrigação legal, ordem judicial ou outra hipótese juridicamente válida.',
      ],
    },
    {
      heading: '19. Transferência internacional',
      body: [
        'Alguns fornecedores tecnológicos poderão processar ou armazenar dados fora do Brasil. A infraestrutura do Google poderá envolver servidores e processamento internacional, inclusive nos Estados Unidos.',
        'A Lumina adotará mecanismos jurídicos e técnicos adequados para as transferências internacionais, observando a LGPD e a regulamentação da ANPD. A ANPD aprovou em 2024 regulamentação específica sobre transferência internacional de dados e cláusulas-padrão contratuais.',
      ],
    },
    {
      heading: '20. Cookies e tecnologias semelhantes',
      body: [
        'O website da Lumina poderá utilizar cookies e tecnologias semelhantes para autenticação; segurança; funcionamento; preferências; métricas internas; e melhoria da experiência.',
        'A Lumina não utiliza cookies para vender dados pessoais a terceiros. Quando houver cookies não essenciais sujeitos a consentimento, o usuário deverá receber informação adequada e mecanismo apropriado de escolha.',
        'A ANPD possui orientação específica sobre cookies e proteção de dados pessoais.',
      ],
    },
    {
      heading: '21. Publicidade',
      body: [
        'A Lumina NÃO vende dados pessoais de usuários, NÃO comercializa dados pessoais para terceiros e NÃO utiliza dados pessoais para vender publicidade de terceiros.',
        'A Plataforma poderá apresentar comunicações próprias relacionadas a seus serviços, funcionalidades, assinaturas, produtos e recursos.',
      ],
    },
    {
      heading: '22. Retenção dos dados',
      body: [
        'A Lumina manterá os dados pelo período necessário às finalidades para as quais foram coletados, respeitando obrigações legais.',
        'Dados cadastrais: durante a conta mais [PREENCHER: prazo pós-encerramento]. Perfil: durante a conta mais o prazo necessário à defesa de direitos. Fotos: durante a disponibilização mais o prazo legal aplicável.',
        'Documento de verificação e selfie de verificação: ELIMINADOS após a análise, aprovada ou rejeitada, salvo obrigação legal. Status de verificação: [PREENCHER: prazo]. Data de nascimento verificada: durante a conta mais [PREENCHER: prazo].',
        'Mensagens: [PREENCHER: prazo operacional]. Registros de segurança: [PREENCHER: prazo]. Registros de acesso: conforme o Marco Civil e a legislação aplicável.',
        'Dados de transações: [PREENCHER: prazo contábil/fiscal]. Dados de Criadores: [PREENCHER: prazo fiscal/contratual]. Dados bancários: [PREENCHER: prazo]. Token push: enquanto necessário ao envio. Dados de moderação: [PREENCHER: prazo]. Registros de incidentes: conforme obrigação legal aplicável.',
      ],
    },
    {
      heading: '23. Registros de acesso',
      body: [
        'A Lumina poderá estar sujeita ao dever de guardar registros de acesso a aplicações de internet.',
        'O Marco Civil da Internet prevê, para provedores de aplicações constituídos como pessoa jurídica e que exerçam atividade econômica organizada, a guarda sob sigilo e em ambiente controlado dos registros de acesso a aplicações pelo prazo legal de 6 meses.',
        'A retenção poderá ocorrer por período maior quando houver obrigação legal, ordem judicial, investigação, exercício regular de direitos ou outra hipótese juridicamente válida.',
      ],
    },
    {
      heading: '24. Segurança da informação',
      body: [
        'A Lumina adotará medidas técnicas e organizacionais compatíveis com os riscos envolvidos, incluindo, conforme aplicável: controle de acesso; autenticação; princípio do menor privilégio; segregação de funções; registros de atividade; proteção de infraestrutura; backups; monitoramento de segurança; medidas de prevenção contra fraude; proteção das comunicações; e procedimentos internos de resposta a incidentes.',
        'Nenhum sistema conectado à internet pode ser considerado absolutamente seguro.',
      ],
    },
    {
      heading: '25. Incidentes de segurança',
      body: [
        'Em caso de incidente de segurança envolvendo dados pessoais, a Lumina adotará medidas para identificar e conter o incidente; avaliar sua extensão; preservar evidências; reduzir possíveis danos; corrigir vulnerabilidades; documentar o incidente; e comunicar autoridades e titulares quando houver obrigação legal.',
        'A Resolução CD/ANPD nº 15/2024 estabelece regras específicas para comunicação de incidentes capazes de causar risco ou dano relevante, inclusive envolvendo dados sensíveis, financeiros ou de autenticação.',
        'Quando a comunicação for obrigatória, a Lumina observará os prazos legais e regulamentares aplicáveis. A ANPD atualmente informa que, nos casos abrangidos pelo regulamento, a comunicação deve ser realizada em até 3 dias úteis.',
      ],
    },
    {
      heading: '26. Direitos dos titulares',
      body: [
        'Nos termos da LGPD, o titular poderá exercer, conforme aplicável: confirmação da existência de tratamento; acesso aos dados; correção de dados incompletos, inexatos ou desatualizados; anonimização; bloqueio; eliminação de dados desnecessários, excessivos ou tratados em desconformidade; portabilidade; informação sobre compartilhamentos.',
        'O titular também poderá solicitar informação sobre a possibilidade de não fornecer consentimento e suas consequências; revogação do consentimento; eliminação de dados tratados com base em consentimento, ressalvadas hipóteses legais de conservação; oposição a tratamento realizado em determinadas hipóteses; revisão de decisões tomadas unicamente com base em tratamento automatizado, quando aplicável; e demais direitos previstos no art. 18 e dispositivos relacionados da LGPD.',
      ],
    },
    {
      heading: '27. Como exercer os direitos',
      body: [
        'O titular poderá solicitar atendimento pelo canal [PREENCHER: e-mail do DPO/privacidade].',
        'O pedido deverá conter informações suficientes para identificação segura do titular. A Lumina poderá solicitar informações adicionais razoavelmente necessárias para confirmar a identidade do solicitante e evitar fraude.',
        'Solicitações serão analisadas dentro dos prazos previstos na legislação aplicável.',
      ],
    },
    {
      heading: '28. Revogação do consentimento',
      body: [
        'Quando determinado tratamento estiver baseado em consentimento, o titular poderá revogá-lo.',
        'A revogação não prejudica tratamentos realizados anteriormente de forma válida nem impede tratamentos que possuam outra base legal legítima.',
        'Quando o tratamento for indispensável para determinada funcionalidade, sua revogação poderá resultar na impossibilidade de disponibilização dessa funcionalidade.',
      ],
    },
    {
      heading: '29. Exclusão da conta',
      body: [
        'O usuário poderá solicitar o encerramento da conta. A exclusão não necessariamente implicará eliminação imediata de todas as informações.',
        'A Lumina poderá conservar determinados dados quando necessário para cumprimento de obrigação legal; exercício regular de direitos; prevenção à fraude; segurança; cumprimento de ordem judicial; cumprimento de obrigações fiscais, contábeis ou regulatórias; e cumprimento do Marco Civil da Internet.',
        'Após o término do período aplicável, os dados serão eliminados, anonimizados ou submetidos a outra forma legal de conservação.',
      ],
    },
    {
      heading: '30. Dados publicados pelo próprio usuário',
      body: [
        'O usuário deve considerar que determinadas informações disponibilizadas no perfil podem ser visualizadas por outros usuários.',
        'A Lumina não recomenda publicar endereço residencial; documentos; dados bancários; senhas; informações financeiras; ou dados excessivamente pessoais.',
      ],
    },
    {
      heading: '31. Conteúdo adulto e privacidade',
      body: [
        'A Lumina trata o conteúdo adulto publicado por Criadores como conteúdo de usuário e aplica medidas de segurança e moderação.',
        'A Plataforma não garante que um conteúdo visualizado por um comprador jamais seja copiado por meios externos. O comprador é proibido de redistribuir conteúdo adquirido.',
        'Quando houver denúncia de distribuição não autorizada, a Lumina poderá analisar informações relacionadas ao caso e adotar medidas previstas nos Termos de Uso e na legislação.',
      ],
    },
    {
      heading: '32. Dados de terceiros apresentados pelo usuário',
      body: [
        'O usuário não deverá fornecer à Lumina dados pessoais de terceiros sem fundamento jurídico adequado.',
        'Criadores são responsáveis por possuir as autorizações necessárias quando publicarem imagem, voz ou outros dados de pessoas retratadas em seus conteúdos.',
      ],
    },
    {
      heading: '33. Crianças e adolescentes',
      body: [
        'A Lumina é destinada exclusivamente a maiores de 18 anos. Não é permitida a criação de contas por menores.',
        'A Lumina adota mecanismos técnicos e organizacionais destinados a impedir o acesso de menores ao Serviço e especialmente a conteúdos adultos.',
        'A legislação brasileira de 2025 estabeleceu regras específicas para serviços que disponibilizam conteúdo pornográfico, incluindo medidas eficazes de impedimento de acesso e mecanismos confiáveis de verificação de idade.',
        'Caso a Lumina identifique conta pertencente a menor, poderá suspendê-la imediatamente e adotar as providências legais cabíveis.',
      ],
    },
    {
      heading: '34. Encarregado — DPO',
      body: [
        'O Encarregado pelo Tratamento de Dados Pessoais da Lumina é [PREENCHER: nome], [PREENCHER: cargo/identificação], contato [PREENCHER: e-mail do DPO], canal [PREENCHER: canal].',
        'O DPO poderá ser contatado para assuntos relacionados à proteção de dados pessoais e privacidade. A ANPD possui regulamentação específica sobre a atuação do encarregado pelo tratamento de dados pessoais.',
      ],
    },
    {
      heading: '35. Reclamações perante a ANPD',
      body: [
        'O titular poderá procurar a Autoridade Nacional de Proteção de Dados — ANPD quando entender que seus direitos relacionados à proteção de dados não foram adequadamente atendidos.',
        'A Lumina buscará solucionar previamente as solicitações recebidas por seus canais oficiais.',
      ],
    },
    {
      heading: '36. Alterações desta Política',
      body: [
        'Esta Política poderá ser atualizada para refletir alterações legislativas; implementar novas funcionalidades; alterar fornecedores; melhorar segurança; e aperfeiçoar transparência.',
        'Cada versão será identificada por número e data. Alterações relevantes serão comunicadas por meio adequado.',
      ],
    },
    {
      heading: '37. Versionamento',
      body: [
        'Versão atual: 2026-09-17-draft. Data de vigência: [PREENCHER: data]. Resumo das alterações: [PREENCHER: resumo].',
        'O histórico de versões será mantido pela Lumina.',
      ],
    },
    {
      heading: '38. Disposições finais',
      body: [
        'Esta Política integra os Termos de Uso da Lumina. A versão vigente estará disponível no aplicativo e/ou website oficial.',
        'Em caso de conflito entre informações resumidas apresentadas em telas específicas e esta Política, serão observados os princípios da transparência, finalidade, necessidade e legislação aplicável, considerando também a informação apresentada ao titular no momento da coleta.',
      ],
    },
  ],
};