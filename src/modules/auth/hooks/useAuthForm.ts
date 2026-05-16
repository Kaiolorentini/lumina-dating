import { useState } from 'react';
import { isValidEmail } from '../../../shared/utils';
import {
  loginWithEmail,
  registerWithEmail,
  translateAuthError,
} from '../services/authService';

interface UseAuthFormProps {
  onSuccess?: () => void;
}

export function useLoginForm({ onSuccess }: UseAuthFormProps = {}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function validate(): string | null {
    if (!email || !password) return 'Preencha todos os campos';
    if (!isValidEmail(email)) return 'Digite um e-mail válido';
    if (password.length < 6) return 'A senha deve ter pelo menos 6 caracteres';
    return null;
  }

  async function submit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError('');
      await loginWithEmail({ email, password });
      onSuccess?.();
    } catch (err: any) {
      console.log('❌ Erro login:', err.code);
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/invalid-login-credentials' ||
        err.code === 'auth/wrong-password'
      ) {
        setError('E-mail ou senha incorretos');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Tente novamente mais tarde');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Erro de conexão. Verifique sua internet');
      } else {
        setError(`Erro ao entrar: ${err.code || 'Tente novamente'}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return {
    email, setEmail,
    password, setPassword,
    loading, error,
    submit,
  };
}

export function useRegisterForm({ onSuccess }: UseAuthFormProps = {}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function validate(): string | null {
    if (!email || !password || !confirmPassword) return 'Preencha todos os campos';
    if (!isValidEmail(email)) return 'Digite um e-mail válido';
    if (password.length < 6) return 'A senha deve ter pelo menos 6 caracteres';
    if (password !== confirmPassword) return 'As senhas não coincidem';
    return null;
  }

  async function submit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError('');
      await registerWithEmail({ email, password });
      onSuccess?.();
    } catch (err: any) {
      console.log('❌ Erro cadastro:', err.code);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido');
      } else if (err.code === 'auth/weak-password') {
        setError('Senha muito fraca. Use pelo menos 6 caracteres');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Erro de conexão. Verifique sua internet');
      } else {
        setError(translateAuthError(err.code));
      }
    } finally {
      setLoading(false);
    }
  }

  return {
    email, setEmail,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    loading, error,
    submit,
  };
}