import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../core/firebase';
import { COLLECTIONS } from '../core/constants';
import { UserPermissions, UserRole } from '../shared/types/marketplace';

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

    // ✅ Timeout de segurança — 10s máximo
    // Evita loading infinito se Firestore não responder
    const timeoutId = setTimeout(() => {
      if (!mountedRef.current) return;
      if (currentUidRef.current !== capturedUid) return;
      console.warn('[useUserPermissions] Timeout — liberando loading');
      setPermissions(null);
      setLoading(false);
    }, 10000);
      console.log('[PERMISSIONS] iniciando listener uid:', capturedUid, 'COLLECTIONS.USERS:', COLLECTIONS.USERS);
    const unsubscribe = onSnapshot(
      ref,
      snap => {
        if (!mountedRef.current) return;
        if (currentUidRef.current !== capturedUid) return;

        clearTimeout(timeoutId); // ← cancela timeout ao receber dados

        if (!snap.exists()) {
          console.log('[PERMISSIONS] documento não existe para uid:', capturedUid);
          setPermissions({
            uid: capturedUid,
            role: 'user',
            isBlocked: false,
          });
          setLoading(false);
          return;
        }

        const data = snap.data();
          console.log('[PERMISSIONS] snapshot recebido, role:', data?.role, 'isBlocked:', data?.isBlocked);
        setPermissions({
          uid: capturedUid,
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

        clearTimeout(timeoutId); // ← cancela timeout ao receber erro

        console.warn('[useUserPermissions] Erro no listener:', error);
        setPermissions(null);
        setLoading(false);
      }
    );

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId); // ← limpa timeout no unmount
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