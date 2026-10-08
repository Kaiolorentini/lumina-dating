// ============================================
// LUMINA — EXCLUSÃO DE CONTA (app)
// src/modules/profile/services/accountDeletionService.ts
//
// Reautentica com a senha (o servidor exige login de até 5 min) e
// pede a exclusão. O processamento é no servidor — ver
// functions/src/users/accountDeletion.ts.
// ============================================

import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../../../services/firebase';
import app from '../../../core/firebase';

interface DeleteResult {
  success: boolean;
}

const WRONG_PASSWORD = new Set([
  'auth/wrong-password',
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
]);

function friendlyError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (WRONG_PASSWORD.has(code)) return 'Senha incorreta.';
  if (code === 'auth/too-many-requests') return 'Muitas tentativas. Aguarde alguns minutos.';
  if (code === 'auth/network-request-failed') return 'Sem conexão. Verifique sua internet.';
  // Erros da função já vêm com a mensagem para a pessoa.
  if (error instanceof Error && error.message) return error.message;
  return 'Não foi possível excluir a conta. Tente novamente.';
}

export async function deleteMyAccount(password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Sessão expirada. Entre novamente.');

  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    // Token novo com o auth_time da reautenticação.
    await user.getIdToken(true);

    await httpsCallable<void, DeleteResult>(
      getFunctions(app, 'us-central1'),
      'deleteMyAccount',
    )();
  } catch (error) {
    throw new Error(friendlyError(error));
  }
}