import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { auth } from '../../../core/firebase';

// ============================================
// AUTH SERVICE
//
// Responsabilidade única:
// Apenas chama o Firebase Auth.
// Sem lógica de UI, sem navegação, sem estado.
// ============================================

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthError {
  code: string;
  message: string;
}

// Traduz erros do Firebase para português
export function translateAuthError(code: string): string {
  const errors: Record<string, string> = {
    'auth/user-not-found': 'Usuário não encontrado',
    'auth/wrong-password': 'Senha incorreta',
    'auth/invalid-email': 'E-mail inválido',
    'auth/email-already-in-use': 'Este e-mail já está em uso',
    'auth/weak-password': 'Senha muito fraca. Use pelo menos 6 caracteres',
    'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde',
    'auth/invalid-credential': 'Credenciais inválidas. Verifique e-mail e senha',
    'auth/network-request-failed': 'Erro de conexão. Verifique sua internet',
  };
  return errors[code] || 'Erro inesperado. Tente novamente';
}

// Cadastro
export async function registerWithEmail(
  credentials: AuthCredentials
): Promise<User> {
  const { user } = await createUserWithEmailAndPassword(
    auth,
    credentials.email,
    credentials.password
  );
  return user;
}

// Login
export async function loginWithEmail(
  credentials: AuthCredentials
): Promise<User> {
  const { user } = await signInWithEmailAndPassword(
    auth,
    credentials.email,
    credentials.password
  );
  return user;
}

// Logout
export async function logout(): Promise<void> {
  await signOut(auth);
}