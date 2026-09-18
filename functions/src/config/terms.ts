// ============================================
// LUMINA — VERSÃO DOS TERMOS
// functions/src/config/terms.ts
//
// FONTE DA VERDADE da versão vigente. O cliente
// envia a versão que exibiu; o servidor só aceita
// se for igual a esta. Assim ninguém registra
// aceite de um texto que não está no ar.
//
// AO PUBLICAR UMA VERSÃO NOVA:
//   1. Adicione o texto novo em src/config/legal/ (cliente)
//   2. Troque APP_TERMS_VERSION aqui e no espelho do cliente
//   3. Deploy das functions ANTES do eas update
//   4. Todos os usuários passam pelo aceite outra vez
//
// Formato de data: deixa óbvio na auditoria qual
// texto a pessoa leu, sem precisar de tabela externa.
// ============================================

// Sufixo -draft enquanto os textos tiverem campos
// [PREENCHER]: a versão final terá outro valor, e a troca
// força todos a aceitar de novo — que é o comportamento
// correto, já que o documento será materialmente diferente.
export const APP_TERMS_VERSION = "2026-09-17-draft";

/** Versões já publicadas, da mais recente para a mais antiga. */
export const KNOWN_TERMS_VERSIONS = ["2026-09-17-draft"] as const;