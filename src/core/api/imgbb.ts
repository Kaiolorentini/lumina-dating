import { Platform } from 'react-native';

const IMGBB_API_KEY = '463f2111239a0e3f6971229849de12b6';
const IMGBB_API_URL = 'https://api.imgbb.com/1/upload';

export interface ImgBBResponse {
  url: string;
  deleteUrl: string;
  thumbUrl: string;
}

// Converte URI para base64 — funciona em web e mobile
async function toBase64(uri: string): Promise<string> {
  // Já é base64
  if (uri.startsWith('data:image')) {
    return uri.split(',')[1];
  }

  // No mobile, usa fetch normalmente
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

// Converte URI para base64 no React Native (mobile)
async function uriToBase64Mobile(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function uploadToImgBB(
  uri: string,
  name: string
): Promise<ImgBBResponse> {
  try {
    let base64: string;

    if (uri.startsWith('data:image')) {
      // Já é base64 (vem do web)
      base64 = uri.split(',')[1];
    } else {
      // URI local (vem do mobile ou web)
      base64 = await uriToBase64Mobile(uri);
    }

    const formData = new FormData();
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', base64);
    formData.append('name', name);

    const response = await fetch(IMGBB_API_URL, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || 'Erro no upload ImgBB');
    }

    return {
      url: data.data.url,
      deleteUrl: data.data.delete_url,
      thumbUrl: data.data.thumb?.url || data.data.url,
    };
  } catch (error) {
    console.error('ImgBB upload error:', error);
    throw error;
  }
}