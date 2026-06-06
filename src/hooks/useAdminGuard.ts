// ============================================
// useAdminGuard — verifica role admin/superadmin
// Leitura de users/{uid}.role via onSnapshot
// ============================================

import { useUserPermissions } from './useUserPermissions';

export function useAdminGuard(uid: string | undefined) {
  const { role, isAdmin, isSuperAdmin, loading } = useUserPermissions(uid);
  return {
    canAccessAdmin: isAdmin || isSuperAdmin,
    isAdmin,
    isSuperAdmin,
    role,
    loading,
  };
}