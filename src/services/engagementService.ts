// ============================================
// LUMINA — ENGAGEMENT SERVICE v5.1
// src/services/engagementService.ts
//
// CORREÇÃO: onContentUnlocked e onMessageSent
// adicionados (eram esperados por outros arquivos)
// safeAddCoins REMOVIDO — créditos via Cloud Function
// ============================================

import { getFunctions, httpsCallable } from 'firebase/functions';
import { createNotification } from '../modules/notifications/services/notificationService';

const functions = getFunctions();

function getDailyKey(userId: string, suffix: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${userId}_${today}_${suffix}`;
}

// ------------------------------------------
// Login diário — credita via Cloud Function
// ------------------------------------------
export async function onAppOpen(userId: string): Promise<void> {
  try {
    await createNotification(
      userId,
      'sintonia',
      'Bem-vindo de volta! Confira perfis compatíveis ✦'
    );

    const fn = httpsCallable<
      { origin: string; amount: number; idempotencyKey: string },
      { success: boolean; amount?: number }
    >(functions, 'earnCoins');

    await fn({
      origin:         'LOGIN_DIARIO',
      amount:         10,
      idempotencyKey: getDailyKey(userId, 'LOGIN_DIARIO'),
    });

    console.log('✅ Login diário enviado para CF');
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === 'already-exists') {
      console.log('[engagementService] Login diário já resgatado hoje.');
      return;
    }
    console.error('[engagementService] Erro no onAppOpen:', error);
  }
}

// ------------------------------------------
// Conteúdo desbloqueado — registra XP e notificação
// ------------------------------------------
export async function onContentUnlocked(
  userId: string,
  profileId: string,
  level: number
): Promise<void> {
  try {
    // XP por desbloquear conteúdo via CF
    const fn = httpsCallable<
      { action: string; targetUid: string },
      { success: boolean }
    >(functions, 'earnXP');

    await fn({
      action:    'UNLOCK_ACHIEVEMENT',
      targetUid: profileId,
    });

    await createNotification(
      userId,
      'sintonia',
      `🔓 Você desbloqueou conteúdo exclusivo nível ${level}!`
    );
  } catch (error) {
    console.error('[engagementService] onContentUnlocked error:', error);
  }
}

// ------------------------------------------
// Mensagem enviada — registra XP de conversa
// Só gera XP após resposta do outro usuário (REGRA 11)
// Chamado pelo backend quando condição é satisfeita
// ------------------------------------------
export async function onMessageSent(
  userId: string,
  targetUserId: string
): Promise<void> {
  try {
    const fn = httpsCallable<
      { action: string; targetUid: string },
      { success: boolean }
    >(functions, 'earnXP');

    await fn({
      action:    'START_CONVERSATION',
      targetUid: targetUserId,
    });
  } catch (error) {
    console.error('[engagementService] onMessageSent error:', error);
  }
}