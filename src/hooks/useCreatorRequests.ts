// ============================================
// useCreatorRequests — HOOK
//
// Listener em tempo real para status da solicitação.
// Protegido: mountedRef + currentUidRef.
// ============================================

import { useState, useEffect, useRef } from 'react';
import {
  listenToCreatorRequest,
  CreatorRequest,
} from '../services/marketplace/creatorService';

interface UseCreatorRequestsReturn {
  request: CreatorRequest | null;
  loading: boolean;
  isPending: boolean;
  isApproved: boolean;
  isRejected: boolean;
}

export function useCreatorRequests(uid: string | undefined): UseCreatorRequestsReturn {
  const [request, setRequest] = useState<CreatorRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  const currentUidRef = useRef<string | undefined>(uid);

  useEffect(() => {
    mountedRef.current = true;
    currentUidRef.current = uid;

    if (!uid) {
      setRequest(null);
      setLoading(false);
      return () => {
        mountedRef.current = false;
        currentUidRef.current = undefined;
      };
    }

    const capturedUid = uid;

    const unsubscribe = listenToCreatorRequest(capturedUid, updatedRequest => {
      if (!mountedRef.current) return;
      if (currentUidRef.current !== capturedUid) return;

      setRequest(updatedRequest);
      setLoading(false);
    });

    return () => {
      mountedRef.current = false;
      currentUidRef.current = undefined;
      unsubscribe();
    };
  }, [uid]);

  return {
    request,
    loading,
    isPending: request?.status === 'pending',
    isApproved: request?.status === 'approved',
    isRejected: request?.status === 'rejected',
  };
}