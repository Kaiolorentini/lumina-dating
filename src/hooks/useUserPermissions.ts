import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../core/firebase';
import { COLLECTIONS } from '../core/constants';
import { UserPermissions, UserRole } from '../shared/types/marketplace';
import {
  AccessGateState,
  AgeRejectionReason,
  AgeVerificationStatus,
  EMPTY_ACCESS_GATE,
} from '../shared/types/verification.types';

const VALID_ROLES: UserRole[] = ['user', 'creator', 'admin', 'superadmin'];
const VALID_STATUSES: AgeVerificationStatus[] = ['none', 'pending', 'approved', 'rejected'];
const VALID_REASONS: AgeRejectionReason[] = ['UNDERAGE', 'ILLEGIBLE', 'MISMATCH', 'OTHER'];

function sanitizeRole(raw: unknown): UserRole {
  if (typeof raw === 'string' && VALID_ROLES.includes(raw as UserRole)) {
    return raw as UserRole;
  }
  return 'user';
}

function sanitizeStatus(raw: unknown): AgeVerificationStatus {
  if (typeof raw === 'string' && VALID_STATUSES.includes(raw as AgeVerificationStatus)) {
    return raw as AgeVerificationStatus;
  }
  return 'none';
}

function sanitizeReason(raw: unknown): AgeRejectionReason | null {
  if (typeof raw === 'string' && VALID_REASONS.includes(raw as AgeRejectionReason)) {
    return raw as AgeRejectionReason;
  }
  return null;
}

// Campos gravados só pelo Admin SDK. Leitura defensiva:
// ageVerified só vale junto do status 'approved' — se os
// dois divergirem, o usuário é tratado como NÃO verificado.
function readAccessGate(data: DocumentData): AccessGateState {
  const status = sanitizeStatus(data.ageVerificationStatus);
  return {
    ageVerified: data.ageVerified === true && status === 'approved',
    ageVerificationStatus: status,
    ageRejectionReason: status === 'rejected' ? sanitizeReason(data.ageRejectionReason) : null,
    ageRejectionNote:
      status === 'rejected' && typeof data.ageRejectionNote === 'string'
        ? data.ageRejectionNote
        : null,
    acceptedAppTermsVersion:
      typeof data.acceptedAppTermsVersion === 'string' ? data.acceptedAppTermsVersion : null,
  };
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
  /** Estado de acesso ao app (termos + verificação de idade). */
  accessGate: AccessGateState;
  /** true quando o listener falhou ou estourou o timeout. */
  loadError: boolean;
  /** Reabre o listener após erro. */
  retry: () => void;
}

export function useUserPermissions(
  uid: string | undefined
): UseUserPermissionsReturn {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [accessGate, setAccessGate] = useState<AccessGateState>(EMPTY_ACCESS_GATE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mountedRef = useRef(true);
  const currentUidRef = useRef<string | undefined>(uid);

  const retry = useCallback(() => {
    setAttempt(prev => prev + 1);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    currentUidRef.current = uid;
    setLoading(true);
    setLoadError(false);
    // Troca de uid não pode herdar o estado de acesso da conta anterior.
    setAccessGate(EMPTY_ACCESS_GATE);

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
    // Evita loading infinito se Firestore não responder.
    // Marca erro em vez de liberar como usuário comum: o gate
    // de acesso precisa falhar FECHADO, com opção de retry.
    const timeoutId = setTimeout(() => {
      if (!mountedRef.current) return;
      if (currentUidRef.current !== capturedUid) return;
      console.warn('[useUserPermissions] Timeout — liberando loading com erro');
      setPermissions(null);
      setLoadError(true);
      setLoading(false);
    }, 10000);
      console.log('[PERMISSIONS] iniciando listener uid:', capturedUid, 'COLLECTIONS.USERS:', COLLECTIONS.USERS);
    const unsubscribe = onSnapshot(
      ref,
      snap => {
        if (!mountedRef.current) return;
        if (currentUidRef.current !== capturedUid) return;

        clearTimeout(timeoutId); // ← cancela timeout ao receber dados
        // Snapshot atrasado após o timeout corrige o erro sozinho.
        setLoadError(false);

        if (!snap.exists()) {
          console.log('[PERMISSIONS] documento não existe para uid:', capturedUid);
          setPermissions({
            uid: capturedUid,
            role: 'user',
            isBlocked: false,
          });
          setAccessGate(EMPTY_ACCESS_GATE);
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
        setAccessGate(readAccessGate(data));

        setLoading(false);
      },
      error => {
        if (!mountedRef.current) return;
        if (currentUidRef.current !== capturedUid) return;

        clearTimeout(timeoutId); // ← cancela timeout ao receber erro

        console.warn('[useUserPermissions] Erro no listener:', error);
        setPermissions(null);
        setAccessGate(EMPTY_ACCESS_GATE);
        setLoadError(true);
        setLoading(false);
      }
    );

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId); // ← limpa timeout no unmount
      unsubscribe();
      currentUidRef.current = undefined;
    };
  }, [uid, attempt]);

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
    accessGate,
    loadError,
    retry,
  };
}