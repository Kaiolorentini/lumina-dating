// ============================================
// LUMINA — HISTÓRICO DE XP
// src/modules/engagement/hooks/useXPHistory.ts
//
// A coleção `xpLog` é gravada pelo XPService a cada ganho —
// origem, quanto de XP, quanto de treeXP, multiplicador — e
// NUNCA foi lida por ninguém. Todo o histórico de progressão
// da pessoa estava lá, invisível.
//
// Leitura direta e não CF: a rule do xpLog já permite ao dono
// ler os próprios registros, e uma CF só acrescentaria uma
// invocação a cada abertura da aba.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, orderBy, limit, getDocs,
} from 'firebase/firestore';
import { db } from '../../../services/firebase';

/** Últimos N registros. Mais que isso vira rolagem infinita
 *  numa aba que é para olhar, não para vasculhar. */
const HISTORY_SIZE = 30;

export interface XPLogEntry {
  id:             string;
  origem:         string;
  xpRecebido:     number;
  treeXPRecebido: number;
  multiplicador:  number;
  timestamp:      Date | null;
}

/** Texto amigável por ação. O `origem` é a chave técnica do
 *  xpValues; mostrar "GIVE_LIKE" para o usuário seria cru. */
const ACTION_LABEL: Record<string, string> = {
  VISIT_PROFILE:     'Visitou um perfil',
  GIVE_LIKE:         'Curtiu alguém',
  RECEIVE_LIKE:      'Recebeu uma curtida',
  CREATE_SINTONIA:   'Nova Sintonia',
  START_CONVO:       'Iniciou uma conversa',
  MESSAGE_REPLY:     'Respondeu uma mensagem',
  COMPLETE_MISSION:  'Completou uma missão',
  UNLOCK_ACHIEVEMENT:'Desbloqueou uma conquista',
};

export function labelForAction(origem: string): string {
  return ACTION_LABEL[origem] ?? origem;
}

export function useXPHistory(uid: string | undefined) {
  const [entries, setEntries] = useState<XPLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'xpLog'),
        where('uid', '==', uid),
        orderBy('timestamp', 'desc'),
        limit(HISTORY_SIZE),
      );

      const snap = await getDocs(q);

      setEntries(snap.docs.map(d => {
        const data = d.data();
        return {
          id:             d.id,
          origem:         (data.origem as string) ?? '',
          xpRecebido:     (data.xpRecebido as number) ?? 0,
          treeXPRecebido: (data.treeXPRecebido as number) ?? 0,
          multiplicador:  (data.multiplicador as number) ?? 1,
          timestamp:      data.timestamp?.toDate?.() ?? null,
        };
      }));
    } catch (error) {
      // Histórico vazio não é erro: quem nunca ganhou XP não
      // tem registros, e a query também falha se o índice
      // ainda estiver sendo criado.
      console.warn('[useXPHistory] load:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  return { entries, loading, refresh: load };
}