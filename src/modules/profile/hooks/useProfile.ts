import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getProfile } from '../services/profileService';
import { UserProfile } from '../../../shared/types';

// ============================================
// useProfile
//
// Busca e mantém o perfil do usuário logado.
// Reutilizável em qualquer tela que precise
// dos dados do perfil.
// ============================================

interface UseProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProfile(): UseProfileReturn {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user]);

  async function loadProfile() {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getProfile(user.uid);
      setProfile(data);
    } catch (err) {
      setError('Erro ao carregar perfil');
      console.error('useProfile error:', err);
    } finally {
      setLoading(false);
    }
  }

  return {
    profile,
    loading,
    error,
    refresh: loadProfile,
  };
}