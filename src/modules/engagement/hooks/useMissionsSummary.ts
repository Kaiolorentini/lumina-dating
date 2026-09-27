// ============================================
// LUMINA — RESUMO DAS MISSÕES DO DIA
// src/modules/engagement/hooks/useMissionsSummary.ts
//
// Contador em TEMPO REAL para o banner da Home. Lê o documento do
// dia direto (sem CF): as missões agora são registradas pelo
// servidor em segundo plano, e o banner acompanha sozinho.
// A Home mostrava 0/3 fixo no código.
// ============================================

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { todayBr } from '../../../utils/dateBr';

const DEFAULT_TOTAL = 3;

export interface MissionsSummary {
  completed: number;
  total:     number;
}

export function useMissionsSummary(uid: string | undefined): MissionsSummary {
  const [summary, setSummary] = useState<MissionsSummary>({ completed: 0, total: DEFAULT_TOTAL });

  useEffect(() => {
    if (!uid) return;

    const ref = doc(db, 'dailyMissions', `${uid}_${todayBr()}`);
    return onSnapshot(
      ref,
      snap => {
        const missions = (snap.data()?.missions as { completed?: boolean }[] | undefined) ?? [];
        setSummary({
          completed: missions.filter(m => m.completed).length,
          total:     missions.length || DEFAULT_TOTAL,
        });
      },
      error => console.warn('[useMissionsSummary]', error),
    );
  }, [uid]);

  return summary;
}