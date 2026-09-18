// ============================================
// LUMINA — ACCESS GATE
// src/navigation/accessGate.ts
//
// Função pura que decide em qual etapa de acesso o
// usuário está. Fica fora do AppNavigator para que a
// regra seja legível, testável e única.
//
// IMPORTANTE: isto é UX, não segurança. A barreira real
// vive nas Firestore/Storage Rules e nas Cloud Functions.
// ============================================

import { AccessGateState } from '../shared/types/verification.types';

export type AccessGateStep =
  | 'error'
  | 'blocked'
  | 'terms'
  | 'profile'
  | 'verification'
  | 'pending'
  | 'rejected'
  | 'app';

export interface AccessGateInput {
  hasProfile: boolean;
  isBlocked: boolean;
  isSuperAdmin: boolean;
  loadError: boolean;
  accessGate: AccessGateState;
  currentTermsVersion: string;
}

export function resolveAccessGate(input: AccessGateInput): AccessGateStep {
  const { hasProfile, isBlocked, isSuperAdmin, loadError, accessGate, currentTermsVersion } = input;

  // Falha FECHADA: sem dados confiáveis, ninguém passa —
  // mas também ninguém é jogado na tela errada.
  if (loadError) return 'error';

  // Primeiro passo: conta bloqueada não vê mais nada.
  // Defesa dupla: rejeição por menoridade bloqueia mesmo
  // que o isBlocked não tenha chegado ao documento.
  if (isBlocked) return 'blocked';
  if (
    accessGate.ageVerificationStatus === 'rejected' &&
    accessGate.ageRejectionReason === 'UNDERAGE'
  ) {
    return 'blocked';
  }

  // Superadmins não passam por termos nem verificação —
  // sem isso ninguém conseguiria aprovar a fila.
  // isSuperAdmin já chega falso quando a conta está bloqueada.
  if (isSuperAdmin) return hasProfile ? 'app' : 'profile';

  // LGPD: aceite antes de qualquer coleta de dados do perfil.
  if (accessGate.acceptedAppTermsVersion !== currentTermsVersion) return 'terms';

  if (!hasProfile) return 'profile';

  if (accessGate.ageVerified) return 'app';

  switch (accessGate.ageVerificationStatus) {
    case 'pending':  return 'pending';
    case 'rejected': return 'rejected';
    default:         return 'verification';
  }
}