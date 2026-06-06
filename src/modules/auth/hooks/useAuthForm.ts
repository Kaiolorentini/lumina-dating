import { useState } from 'react';
import { useAuth, translateAuthError } from '../../../context/AuthContext';

interface UseAuthFormProps {
  onSuccess?: () => void;
}

export function useLoginForm({ onSuccess }: UseAuthFormProps = {}) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function validate(): string | null {
    if (!email || !password) return 'Preencha todos os campos';
    if (!email.includes('@')) return 'Digite um e-mail valido';
    if (password.length < 6) return 'Senha deve ter pelo menos 6 caracteres';
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
      await signIn(email, password);
      onSuccess?.();
    } catch (err: any) {
      console.log('Erro login:', err.code);
      setError(translateAuthError(err.code));
    } finally {
      setLoading(false);
    }
  }

  return { email, setEmail, password, setPassword, loading, error, submit };
}

export function useRegisterForm({ onSuccess }: UseAuthFormProps = {}) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function validate(): string | null {
    if (!email || !password || !confirmPassword) return 'Preencha todos os campos';
    if (!email.includes('@')) return 'Digite um e-mail valido';
    if (password.length < 6) return 'Senha deve ter pelo menos 6 caracteres';
    if (password !== confirmPassword) return 'As senhas nao coincidem';
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
      await signUp(email, password);
      onSuccess?.();
    } catch (err: any) {
      console.log('Erro cadastro:', err.code);
      setError(translateAuthError(err.code));
    } finally {
      setLoading(false);
    }
  }

  return {
    email, setEmail,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    loading, error, submit,
  };
}