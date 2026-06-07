// ============================================
// useUserPermissions — HOOK
//
// Escuta role e isBlocked em tempo real via onSnapshot.
// COMPLETAMENTE INDEPENDENTE do AuthContext.
// NÃO modifica UserProfile.
// NÃO modifica AuthContext.
//
// HARDENING:
// - currentUidRef previne stale data entre usuários
// - capturedUid valida closure no callback
// - mountedRef previne setState após unmount
// - uid nunca vazio quando recebido válido
// - whitelist de roles válidas
// - fail-safe em erro de rede
// ============================================

import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../core/firebase';
import { COLLECTIONS } from '../core/constants';
import { UserPermissions, UserRole } from '../shared/types/marketplace';

// Whitelist de roles válidas — proteção contra valores inválidos no Firestore
const VALID_ROLES: UserRole[] = ['user', 'creator', 'admin', 'superadmin'];

function sanitizeRole(raw: unknown): UserRole {
  if (typeof raw === 'string' && VALID_ROLES.includes(raw as UserRole)) {
    return raw as UserRole;
  }
  return 'user';
}

interface UseUserPermissionsReturn {
  permissions: UserPermissions | null;
  loading: boolean;
  role: UserRole;
  isBlocked: boolean;
  isUser: boolean;
  isCreator: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  acceptedTermsVersion: string | null;
}

export function useUserPermissions(
  uid: string | undefined
): UseUserPermissionsReturn {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const currentUidRef = useRef<string | undefined>(uid);

  useEffect(() => {
    mountedRef.current = true;
    currentUidRef.current = uid;

    // CORREÇÃO 3: reseta loading ao trocar usuário
    setLoading(true);

    if (!uid) {
      setPermissions(null);
      setLoading(false);
      return () => {
        mountedRef.current = false;
        currentUidRef.current = undefined;
      };
    }

    const capturedUid = uid;
    const ref = doc(db, COLLECTIONS.USERS, capturedUid);

    const unsubscribe = onSnapshot(
      ref,
      snap => {
        if (!mountedRef.current) return;
        if (currentUidRef.current !== capturedUid) return;

        if (!snap.exists()) {
          setPermissions({
            uid: capturedUid,
            role: 'user',
            isBlocked: false,
          });
          setLoading(false);
          return;
        }

        const data = snap.data();

        setPermissions({
          uid: capturedUid,
          // CORREÇÃO 1: whitelist de roles válidas
          role: sanitizeRole(data.role),
          isBlocked: data.isBlocked === true,
          blockedReason: typeof data.blockedReason === 'string' ? data.blockedReason : undefined,
          blockedAt: data.blockedAt?.toDate(),
          blockedBy: typeof data.blockedBy === 'string' ? data.blockedBy : undefined,
          acceptedMarketplaceTermsVersion: typeof data.acceptedMarketplaceTermsVersion === 'string'
            ? data.acceptedMarketplaceTermsVersion
            : undefined,
          acceptedMarketplaceTermsAt: data.acceptedMarketplaceTermsAt?.toDate(),
        });

        setLoading(false);
      },
      error => {
        if (!mountedRef.current) return;
        if (currentUidRef.current !== capturedUid) return;

        console.warn('[useUserPermissions] Erro no listener:', error);

        // CORREÇÃO 5: fail-safe — sem permissões liberadas por falha de rede
        setPermissions(null);
        setLoading(false);
      }
    );

    return () => {
      mountedRef.current = false;
      // CORREÇÃO 4: unsubscribe antes de limpar ref
      unsubscribe();
      currentUidRef.current = undefined;
    };
  }, [uid]);

  const role = permissions?.role ?? 'user';
  const isBlocked = permissions?.isBlocked === true;

  const creatorRoles: UserRole[] = ['creator', 'admin', 'superadmin'];
  const adminRoles: UserRole[] = ['admin', 'superadmin'];

  return {
    permissions,
    loading,
    role,
    isBlocked,
    isUser: role === 'user' && !isBlocked,
    isCreator: creatorRoles.includes(role) && !isBlocked,
    isAdmin: adminRoles.includes(role) && !isBlocked,
    isSuperAdmin: role === 'superadmin' && !isBlocked,
    acceptedTermsVersion: permissions?.acceptedMarketplaceTermsVersion ?? null,
  };
}