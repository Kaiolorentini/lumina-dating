import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  getConnection,
  registerVisit,
  registerTimeSpent,
} from '../services/sintoniaService';
import { getSintoniaMilestone } from '../../../shared/utils/sintonia';

// ============================================
// useSintonia
//
// Hook reutilizável para qualquer tela
// que precise da Sintonia dinâmica com uma IA.
// ============================================

interface UseSintoniaReturn {
  sintonia: number;
  milestone: string;
  toastMessage: string;
  toastVisible: boolean;
  hideToast: () => void;
}

export function useSintonia(
  profileId: string,
  initialSintonia: number
): UseSintoniaReturn {
  const { user } = useAuth();
  const [sintonia, setSintonia] = useState(initialSintonia);
  const [milestone, setMilestone] = useState(
    getSintoniaMilestone(initialSintonia)
  );
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Registra visita ao montar o componente
  useEffect(() => {
    if (!user) return;

    async function handleVisit() {
      try {
        const result = await registerVisit(user!.uid, profileId);
        setSintonia(result.sintonia);
        setMilestone(getSintoniaMilestone(result.sintonia));

        if (result.message) {
          setToastMessage(result.message);
          setToastVisible(true);
          setTimeout(() => setToastVisible(false), 4000);
        }
      } catch (error) {
        console.error('useSintonia visit error:', error);
      }
    }

    handleVisit();
  }, [user, profileId]);

  // Registra tempo ao desmontar
  useEffect(() => {
    return () => {
      if (!user) return;
      const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (seconds > 5) {
        registerTimeSpent(user.uid, profileId, seconds).catch(console.error);
      }
    };
  }, [user, profileId]);

  // Carrega Sintonia atual do Firestore
  useEffect(() => {
    if (!user) return;

    async function loadSintonia() {
      try {
        const conn = await getConnection(user!.uid, profileId);
        setSintonia(conn.sintonia);
        setMilestone(conn.milestone);
      } catch (error) {
        console.error('useSintonia load error:', error);
      }
    }

    loadSintonia();
  }, [user, profileId]);

  return {
    sintonia,
    milestone,
    toastMessage,
    toastVisible,
    hideToast: () => setToastVisible(false),
  };
}