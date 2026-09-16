// ============================================
// LUMINA — ENGAGEMENT SERVICE v5.2
// src/services/engagementService.ts
//
// v5.2 — CORREÇÕES DE XP:
// 1. 'START_CONVERSATION' não existe em XP_ACTION_VALUES — a
//    action correta é 'START_CONVO'. Toda chamada de onMessageSent
//    falhava com invalid-argument, silenciada pelo catch.
// 2. actionId era omitido. O earnXP monta a chave de idempotência
//    como `${uid}_${actionId}` — sem ele, virava `${uid}_undefined`
//    e o usuário ganhava XP UMA vez na vida.
// 3. START_CONVO exige minMessages: 2. Sem messageCount, o earnXP
//    rejeitava com failed-precondition.
//
// safeAddCoins REMOVIDO — créditos via Cloud Function
// ============================================

import { getFunctions, httpsCallable } from 'firebase/functions';
import { createNotification } from '../modules/notifications/services/notificationService';
import { todayBr } from '../utils/dateBr';

const functions = getFunctions();

function getDailyKey(userId: string, suffix: string): string {
  // Chave comparada contra o dia que o earnCoins calcula (BRT).
  return `${userId}_${todayBr()}_${suffix}`;
}

// actionId precisa ser único por EVENTO, não por par de usuários.
// O limite de 1x/dia por alvo já é garantido pelo `perUser` do
// earnXP, que usa chave própria com a data.
function newActionId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
    const fn = httpsCallable<
      { action: string; targetUid: string; actionId: string },
      { success: boolean }
    >(functions, 'earnXP');

    await fn({
      action:    'UNLOCK_ACHIEVEMENT',
      targetUid: profileId,
      actionId:  newActionId(`unlock_${profileId}`),
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
// Conversa iniciada — XP só após troca real de mensagens
// ------------------------------------------
export async function onMessageSent(
  userId: string,
  targetUserId: string,
  messageCount: number = 2,
): Promise<void> {
  try {
    const fn = httpsCallable<
      { action: string; targetUid: string; actionId: string; messageCount: number },
      { success: boolean }
    >(functions, 'earnXP');

    await fn({
      // 'START_CONVO' — o nome antigo ('START_CONVERSATION') não
      // existe na tabela e derrubava a chamada inteira.
      action:       'START_CONVO',
      targetUid:    targetUserId,
      actionId:     newActionId(`convo_${targetUserId}`),
      // START_CONVO tem minMessages: 2. O earnXP rejeita abaixo disso.
      messageCount,
    });
  } catch (error: unknown) {
    const e = error as { code?: string; message?: string };
    // perUserDuplicate e limitReached são retornos normais, não erros.
    console.error('[engagementService] onMessageSent error:', e?.code, e?.message);
  }
}