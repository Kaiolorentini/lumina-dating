import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { onAppOpen } from '../services/engagementService';

// Componente invisível que inicializa o engajamento
// Adicione dentro do AppNavigator após o login
export default function EngagementInitializer() {
  const { user } = useAuth();
  const initialized = useRef(false);

  useEffect(() => {
    if (!user || initialized.current) return;
    initialized.current = true;

    // Pequeno delay para não sobrecarregar na abertura
    setTimeout(() => {
      onAppOpen(user.uid).catch(console.error);
    }, 2000);
  }, [user]);

  return null; // Componente invisível
}