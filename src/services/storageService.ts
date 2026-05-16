const IMGBB_API_KEY = '463f2111239a0e3f6971229849de12b6';

// Detecta se é base64 ou URI e converte para base64
async function toBase64(uri: string): Promise<string> {
  // Se já for base64 (começa com data:image)
  if (uri.startsWith('data:image')) {
    return uri.split(',')[1];
  }

  // Se for URI local, converte para base64
  const response = await fetch(uri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function uploadImagem(
  userId: string,
  uri: string,
): Promise<string> {
  try {
    console.log('📤 Convertendo imagem...');
    const base64 = await toBase64(uri);
    console.log('📤 Fazendo upload para ImgBB...');

    const formData = new FormData();
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', base64);
    formData.append('name', `lumina_${userId}_${Date.now()}`);

    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    console.log('📦 Resposta ImgBB:', data);

    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || 'Erro no upload');
    }

    console.log('✅ Upload realizado:', data.data.url);
    return data.data.url;
  } catch (error) {
    console.error('❌ Erro no upload ImgBB:', error);
    throw error;
  }
}

export async function uploadFotoPerfil(
  userId: string,
  uri: string
): Promise<string> {
  return await uploadImagem(userId, uri);
}

export async function uploadMidia(
  userId: string,
  uri: string,
): Promise<string> {
  return await uploadImagem(userId, uri);
}