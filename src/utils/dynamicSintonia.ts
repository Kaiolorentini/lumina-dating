// ============================================
// LUMINA — DYNAMIC SINTONIA v5.1
// src/utils/dynamicSintonia.ts
//
// CORREÇÃO: sintoniaService de IA removido.
// Agora usa diretamente sintoniaCalculator.
// ============================================

import { calcularSintonia } from '../modules/ai/services/sintoniaCalculator';
import { UserProfile }      from '../shared/types';

export { calcularSintonia };

// Registra mensagem para cálculo de sintonia dinâmica
export async function registerMessage(
  userId: string,
  targetId: string
): Promise<void> {
  try {
    // Lógica de registro de mensagem para sintonia
    // Implementação via Cloud Function earnXP
    console.log('[dynamicSintonia] registerMessage:', userId, targetId);
  } catch (error) {
    console.error('[dynamicSintonia] registerMessage error:', error);
  }
}

// Calcula sintonia entre dois usuários
export function getSintonia(
  userA: UserProfile,
  userB: UserProfile
): number {
  const result = calcularSintonia(userA, userB);
  return result.score;
}