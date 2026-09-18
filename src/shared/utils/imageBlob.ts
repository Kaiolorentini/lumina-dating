// ============================================
// LUMINA — LEITURA DE IMAGEM COMO BLOB
// src/shared/utils/imageBlob.ts
//
// Ponto único de leitura de imagem para upload no Storage.
// Extraído do photoService para a verificação de idade
// reusar em vez de manter uma segunda cópia que divergiria.
//
// HISTÓRICO DAS TENTATIVAS — não repetir:
//   1. fetch(uri).blob()      → registrado como falho no
//      Android em versão antiga do Expo. HOJE FUNCIONA: é o
//      que o uploadProductCover usa em produção.
//   2. Uint8Array direto no uploadBytesResumable → upload
//      entrava em 'running' com 0 de N bytes e ficava
//      pendurado para sempre, sem erro.
//   3. new Blob([bytes]) → "Creating blobs from 'ArrayBuffer'
//      and 'ArrayBufferView' are not supported". O React
//      Native não implementa esse construtor.
//
// Conclusão: no React Native, o Blob precisa vir do fetch.
// O base64 serve de plano B quando a URI local não é
// legível — nesse caso o fetch recebe o próprio data URI,
// que ele lê sem tocar no sistema de arquivos.
// ============================================

/**
 * Lê a imagem como Blob, tentando as fontes em ordem de
 * confiança: a URI local primeiro, o data URI montado a
 * partir do base64 depois.
 *
 * @param uri    URI devolvida pelo ImagePicker (file:// ou data:)
 * @param base64 base64 cru do picker, quando disponível
 * @throws Error legível quando nenhuma fonte funciona
 */
export async function resolveImageBlob(
  uri: string,
  base64: string | null = null,
): Promise<Blob> {
  const attempts: string[] = [];

  if (uri && !uri.startsWith('data:')) attempts.push(uri);
  if (base64) attempts.push(`data:image/jpeg;base64,${base64}`);
  if (uri.startsWith('data:')) attempts.push(uri);

  if (attempts.length === 0) {
    throw new Error('Imagem sem dados. Escolha a foto novamente.');
  }

  let lastError: unknown = null;

  for (const candidate of attempts) {
    try {
      const response = await fetch(candidate);
      const blob = await response.blob();
      if (blob.size > 0) return blob;
      lastError = new Error('Blob vazio');
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Não foi possível ler a imagem. ${
      lastError instanceof Error ? lastError.message : ''
    }`.trim()
  );
}