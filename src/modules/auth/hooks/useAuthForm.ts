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
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});

  function validate(): { general: string | null; fields: typeof fieldErrors } {
    const fields: typeof fieldErrors = {};
    if (!email) fields.email = 'Informe seu e-mail';
    else if (!email.includes('@')) fields.email = 'Digite um e-mail válido';
    if (!password) fields.password = 'Crie uma senha';
    else if (password.length < 6) fields.password = 'Mínimo 6 caracteres';
    if (!confirmPassword) fields.confirmPassword = 'Repita a senha';
    else if (password !== confirmPassword) fields.confirmPassword = 'As senhas não coincidem';

    const general = Object.values(fields).some(Boolean)
      ? 'Corrija os campos em destaque'
      : null;
    return { general, fields };
  }

  async function submit() {
    const { general, fields } = validate();
    if (general) {
      setError(general);
      setFieldErrors(fields);
      return;
    }
    try {
      setLoading(true);
      setError('');
      setFieldErrors({});
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
    loading, error, fieldErrors, submit,
  };
}