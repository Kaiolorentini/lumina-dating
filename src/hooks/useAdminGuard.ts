// ============================================
// useAdminGuard — GUARD DE SEGURANÇA ADMIN
//
// Valida isSuperAdmin internamente em cada tela.
// Bloqueia acesso direto via navigation.navigate()
// mesmo que a tab esteja oculta.
//
// Uso:
//   const { blocked, loading } = useAdminGuard();
//   if (loading || blocked) return null;
// ============================================

import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useUserPermissions } from './useUserPermissions';

interface UseAdminGuardReturn {
  loading: boolean;
  blocked: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
}

export function useAdminGuard(): UseAdminGuardReturn {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { isSuperAdmin, isAdmin, loading } = useUserPermissions(user?.uid);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigation.goBack();
      return;
    }

    // Bloqueia acesso se não for admin ou superadmin
    if (!isAdmin && !isSuperAdmin) {
      Alert.alert(
        'Acesso negado',
        'Você não tem permissão para acessar esta área.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [loading, user, isAdmin, isSuperAdmin]);

  const blocked = !loading && (!user || (!isAdmin && !isSuperAdmin));

  return { loading, blocked, isSuperAdmin, isAdmin };
}

// Guard restrito apenas a SuperAdmin
// Para telas financeiras e de bloqueio de usuários
export function useSuperAdminGuard(): UseAdminGuardReturn {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { isSuperAdmin, isAdmin, loading } = useUserPermissions(user?.uid);

  useEffect(() => {
    if (loading) return;

    if (!user || !isSuperAdmin) {
      Alert.alert(
        'Acesso negado',
        'Esta área é restrita a SuperAdmins.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [loading, user, isSuperAdmin]);

  const blocked = !loading && (!user || !isSuperAdmin);

  return { loading, blocked, isSuperAdmin, isAdmin };
}