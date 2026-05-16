import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { onAppOpen } from '../services/engagementService';

// ============================================
// HOOK DE ENGAJAMENTO
//
// Inicializa o ciclo de engajamento quando
// o usuário abre o app.
//
// Como usar:
// Adicione useEngagement() no App.tsx ou
// em qualquer tela principal.
// ============================================

export function useEngagement() {
  const { user } = useAuth();
  const initialized = useRef(false);

  useEffect(() => {
    // Garante que só executa uma vez por sessão
    if (!user || initialized.current) return;
    initialized.current = true;

    onAppOpen(user.uid).catch(console.error);
  }, [user]);
}