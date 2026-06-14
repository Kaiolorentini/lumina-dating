// ============================================
// UTILITÁRIOS DE STRING
// Funções reutilizáveis de texto
// ============================================

// Capitaliza primeira letra
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Trunca texto com reticências
export function truncate(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

// Gera ID de chat entre dois usuários
// Sempre o mesmo independente da ordem
export function generateChatId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join('_');
}



// Valida email
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Formata número de visitas
export function formatVisitCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}