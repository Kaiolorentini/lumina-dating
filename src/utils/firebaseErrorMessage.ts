// ============================================
// LUMINA — MENSAGEM DE ERRO AMIGÁVEL (FIREBASE)
// src/utils/firebaseErrorMessage.ts
//
// 13/10/2026 (backlog item 13). O app mostrava o texto técnico do
// Firebase em inglês ("Missing or insufficient permissions").
// Aqui o código do erro vira uma frase em português que diz o que
// fazer; o detalhe técnico vai só para o log.
//
// Erros das Cloud Functions com texto próprio (HttpsError com
// mensagem em português, ex.: limite de curtidas) continuam com o
// texto do servidor — ele já é escrito para a pessoa.
// ============================================

const FRIENDLY: Record<string, string> = {
  'permission-denied':
    'Não foi possível salvar. Atualize o app (feche e abra de novo) e tente outra vez. Se continuar, fale com o suporte.',
  unauthenticated: 'Sua sessão expirou. Entre de novo na sua conta.',
  unavailable: 'Sem conexão com o servidor agora. Verifique sua internet e tente de novo.',
  'deadline-exceeded': 'A conexão demorou demais. Verifique sua internet e tente de novo.',
  'network-request-failed': 'Sem internet. Verifique sua conexão e tente de novo.',
  'resource-exhausted': 'Muitas tentativas seguidas. Espere um pouco e tente de novo.',
  'not-found': 'Não encontramos esse dado. Atualize a tela e tente de novo.',
  'storage/unauthorized': 'Não foi possível enviar o arquivo. Atualize o app e tente de novo.',
  'storage/canceled': 'Envio cancelado.',
  'storage/retry-limit-exceeded': 'O envio falhou por instabilidade na internet. Tente de novo.',
};

const GENERIC = 'Algo deu errado. Tente de novo em instantes.';

/** Código do erro sem prefixo ("firestore/permission-denied" → "permission-denied"). */
function codeOf(error: unknown): string {
  const raw = (error as { code?: unknown } | null)?.code;
  if (typeof raw !== 'string') return '';
  if (raw.startsWith('storage/')) return raw;
  const slash = raw.lastIndexOf('/');
  return slash >= 0 ? raw.slice(slash + 1) : raw;
}

/** true quando a mensagem veio de uma Cloud Function, escrita para a pessoa. */
function isServerMessage(error: unknown, code: string): boolean {
  const raw = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : '';
  // HttpsError chega como "functions/<código>" com a mensagem do servidor.
  return typeof raw === 'string' && raw.startsWith('functions/') && !!message &&
    !/^(internal|INTERNAL)$/.test(message) && code !== 'internal';
}

/**
 * Frase para mostrar à pessoa. `context` entra no log para achar a
 * origem (ex.: 'profile.save').
 */
export function friendlyErrorMessage(error: unknown, context: string): string {
  const code = codeOf(error);
  console.warn(`[${context}] erro`, JSON.stringify({
    code: code || null,
    message: error instanceof Error ? error.message : String(error),
  }));
  if (isServerMessage(error, code)) return (error as Error).message;
  return FRIENDLY[code] ?? GENERIC;
}
