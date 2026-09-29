// ============================================
// LUMINA — REGRAS DE ARQUIVO DE PRODUTO (app)
// src/utils/productFileRules.ts
//
// Usadas na criação e na edição de produtos. O servidor confere de
// novo pelos metadados do Storage — aqui é o aviso rápido.
// ============================================

const MB = 1024 * 1024;

export const BLOCKED_MIME_TYPES = [
  'application/x-msdownload', 'application/x-executable', 'text/x-shellscript',
];

export function getMaxSize(mimeType: string): number {
  if (mimeType.startsWith('image/')) return 20 * MB;
  if (mimeType.startsWith('video/')) return 500 * MB;
  if (mimeType === 'application/pdf') return 100 * MB;
  return 500 * MB;
}

export function getProductFileType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'imagem';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'outro';
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('zip')) return '📦';
  return '📁';
}

/** Mensagem de erro, ou null se o arquivo pode ser adicionado. */
export function validateProductFile(
  mimeType: string, size: number, name: string, existingNames: string[],
): string | null {
  if (BLOCKED_MIME_TYPES.includes(mimeType)) return 'Este tipo de arquivo não é aceito.';
  const max = getMaxSize(mimeType);
  if (size > max) return `Limite para este tipo: ${formatBytes(max)}. Seu arquivo: ${formatBytes(size)}.`;
  if (existingNames.includes(name)) return `"${name}" já está na lista.`;
  return null;
}