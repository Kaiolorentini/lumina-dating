// ============================================
// useUserPermissions — HOOK
//
// Escuta role e isBlocked em tempo real via onSnapshot.
// COMPLETAMENTE INDEPENDENTE do AuthContext.
// NÃO modifica UserProfile.
// NÃO modifica AuthContext.
//
// HARDENING FASE 3.4:
// - currentUidRef previne stale data entre usuários
// - capturedUid valida closure no callback
// - mountedRef previne setState após unmount
// - uid nunca vazio quando recebido válido
// ============================================

import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../core/firebase';
import { COLLECTIONS } from '../core/constants';
import { UserPermissions, UserRole } from '../shared/types/marketplace';

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

  // HARDENING: rastreia uid atual — detecta mudança entre ciclos
  const currentUidRef = useRef<string | undefined>(uid);

  useEffect(() => {
    mountedRef.current = true;
    currentUidRef.current = uid; // atualiza síncronamente antes de qualquer async

    if (!uid) {
      setPermissions(null);
      setLoading(false);
      return () => {
        mountedRef.current = false;
        currentUidRef.current = undefined;
      };
    }

    // Captura uid neste closure — imutável para este effect
    const capturedUid = uid;

    const ref = doc(db, COLLECTIONS.USERS, capturedUid);

    const unsubscribe = onSnapshot(
      ref,
      snap => {
        if (!mountedRef.current) return;

        // HARDENING: rejeita callback se uid mudou desde criação do listener
        if (currentUidRef.current !== capturedUid) return;

        if (!snap.exists()) {
          // uid real — nunca string vazia
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
          role: (data.role as UserRole) ?? 'user',
          isBlocked: data.isBlocked ?? false,
          blockedReason: data.blockedReason,
          blockedAt: data.blockedAt?.toDate(),
          blockedBy: data.blockedBy,
          acceptedMarketplaceTermsVersion: data.acceptedMarketplaceTermsVersion,
          acceptedMarketplaceTermsAt: data.acceptedMarketplaceTermsAt?.toDate(),
        });

        setLoading(false);
      },
      error => {
        if (!mountedRef.current) return;
        if (currentUidRef.current !== capturedUid) return;

        console.warn('[useUserPermissions] Erro no listener:', error);

        // Fallback com uid real — nunca vazio
        setPermissions({
          uid: capturedUid,
          role: 'user',
          isBlocked: false,
        });
        setLoading(false);
      }
    );

    return () => {
      mountedRef.current = false;
      currentUidRef.current = undefined;
      unsubscribe();
    };
  }, [uid]);

  const role = permissions?.role ?? 'user';
  const isBlocked = permissions?.isBlocked ?? false;

  // TYPE SAFETY FASE 3.3: cast explícito para UserRole[]
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