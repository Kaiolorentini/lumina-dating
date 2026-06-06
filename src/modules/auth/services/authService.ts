// Compatibilidade — funções centralizadas no AuthContext
export { translateAuthError } from '../../../context/AuthContext';

export async function loginWithEmail(credentials: { email: string; password: string }) {
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  const { auth } = await import('../../../core/firebase');
  const { user } = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
  return user;
}

export async function registerWithEmail(credentials: { email: string; password: string }) {
  const { createUserWithEmailAndPassword } = await import('firebase/auth');
  const { auth } = await import('../../../core/firebase');
  const { user } = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
  return user;
}