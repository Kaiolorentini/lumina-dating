import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import {
  estaBloqueado,
  bloquearUsuario,
  desbloquearUsuario,
  getBloqueados,
  Block,
} from '../services/blockService';

// ============================================
// useBlock
//
// Gerencia bloqueios de usuários.
// Screen não precisa saber nada sobre Firebase.
// ============================================

interface UseBlockReturn {
  blocked: boolean;
  loading: boolean;
  block: () => Promise<void>;
}

interface UseBlockListReturn {
  blockedList: Block[];
  loading: boolean;
  unblock: (block: Block) => Promise<void>;
}

// Hook para verificar/bloquear um usuário específico
export function useBlock(
  targetUserId: string,
  targetUserName: string,
  targetUserPhoto: string,
  onBlocked?: () => void
): UseBlockReturn {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      if (!user) return;
      const isBlocked = await estaBloqueado(user.uid, targetUserId);
      setBlocked(isBlocked);
      setLoading(false);
    }
    check();
  }, [user, targetUserId]);

  async function block() {
    if (!user) return;

    Alert.alert(
      '🚫 Bloquear usuário',
      `Deseja bloquear ${targetUserName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: async () => {
            await bloquearUsuario(
              user.uid,
              targetUserId,
              targetUserName,
              targetUserPhoto
            );
            setBlocked(true);
            onBlocked?.();
          },
        },
      ]
    );
  }

  return { blocked, loading, block };
}

// Hook para listar e desbloquear usuários
export function useBlockList(): UseBlockListReturn {
  const { user } = useAuth();
  const [blockedList, setBlockedList] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const list = await getBloqueados(user.uid);
      setBlockedList(list);
      setLoading(false);
    }
    load();
  }, [user]);

  async function unblock(block: Block) {
    if (!user) return;

    Alert.alert(
      'Desbloquear',
      `Deseja desbloquear ${block.blockedName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desbloquear',
          onPress: async () => {
            await desbloquearUsuario(user.uid, block.blockedId);
            setBlockedList(prev => prev.filter(b => b.id !== block.id));
          },
        },
      ]
    );
  }

  return { blockedList, loading, unblock };
}