import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  ConnectionRequest,
  listenToRequests,
  aceitarSolicitacao,
  rejeitarSolicitacao,
} from '../services/requestsService';
import { getProfile } from '../services/profileService';

// ============================================
// useRequests
//
// Gerencia solicitações de conexão em tempo real.
// Screen não precisa saber nada sobre Firebase.
// ============================================

interface UseRequestsReturn {
  requests: ConnectionRequest[];
  loading: boolean;
  processingId: string | null;
  accept: (request: ConnectionRequest) => Promise<void>;
  reject: (request: ConnectionRequest) => Promise<void>;
  unreadCount: number;
}

export function useRequests(): UseRequestsReturn {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToRequests(user.uid, reqs => {
      setRequests(reqs);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  async function accept(request: ConnectionRequest) {
    if (!user) return;
    setProcessingId(request.id);
    try {
      const myProfile = await getProfile(user.uid);
      await aceitarSolicitacao(
        request.id,
        myProfile?.name || 'Usuário',
        request.fromUserId
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function reject(request: ConnectionRequest) {
    setProcessingId(request.id);
    try {
      await rejeitarSolicitacao(request.id);
    } finally {
      setProcessingId(null);
    }
  }

  return {
    requests,
    loading,
    processingId,
    accept,
    reject,
    unreadCount: requests.length,
  };
}