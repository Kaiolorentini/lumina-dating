import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { onAppOpen } from '../services/engagementService';

// Componente invisível que inicializa o engajamento ao login
export default function EngagementInitializer() {
  const { user } = useAuth();
  const initialized = useRef(false);

  useEffect(() => {
    if (!user || initialized.current) return;
    initialized.current = true;
    setTimeout(() => {
      onAppOpen(user.uid).catch(console.error);
    }, 2000);
  }, [user]);

  return null;
}