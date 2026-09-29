// ============================================
// LUMINA — REDEFINIÇÃO DE SENHA
// src/modules/auth/services/passwordResetService.ts
//
// E-mail de redefinição enviado pelo Firebase Auth. O link abre a
// página segura do Firebase, onde a pessoa define a senha nova.
//
// Não revela se o e-mail tem conta: "usuário não encontrado" responde
// igual ao sucesso. Só erros que a pessoa pode resolver (e-mail
// inválido, sem internet, muitas tentativas) viram mensagem.
// ============================================

import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../../services/firebase';

export type ResetResult = { ok: true } | { ok: false; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestPasswordReset(email: string): Promise<ResetResult> {
  const clean = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(clean)) {
    return { ok: false, message: 'Digite um e-mail válido.' };
  }

  try {
    // E-mail em português (o modelo é editado no Console do Firebase).
    auth.languageCode = 'pt';
    await sendPasswordResetEmail(auth, clean);
    return { ok: true };
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code ?? '';
    switch (code) {
      case 'auth/invalid-email':
        return { ok: false, message: 'Digite um e-mail válido.' };
      case 'auth/too-many-requests':
        return { ok: false, message: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' };
      case 'auth/network-request-failed':
        return { ok: false, message: 'Sem conexão. Verifique sua internet e tente de novo.' };
      default:
        // 'auth/user-not-found' e demais: mesma resposta do sucesso.
        return { ok: true };
    }
  }
}