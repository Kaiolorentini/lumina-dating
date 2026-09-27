// ============================================
// LUMINA — ENGAGEMENT SERVICE v5.3
// src/services/engagementService.ts
//
// v5.3 (27/09): onContentUnlocked REMOVIDA com a galeria
// progressiva — era a única a pedir UNLOCK_ACHIEVEMENT ao earnXP,
// e o app não pode se dar XP. getDailyKey, sem uso, também saiu.
//
// v5.2 — CORREÇÕES DE XP (START_CONVO, actionId, messageCount).
// Login diário e safeAddCoins REMOVIDOS — créditos via CF.
// ============================================

import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

// actionId único por EVENTO. O servidor ignora e monta a própria
// chave (uid + ação + alvo); mantido para versões antigas.
function newActionId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface StartConvoRequest {
  action:       string;
  targetUid:    string;
  actionId:     string;
  messageCount: number;
}

// ------------------------------------------
// Conversa iniciada — XP só após troca real de mensagens
// (conferida no servidor: mensagem dos DOIS lados)
// ------------------------------------------
export async function onMessageSent(
  userId: string,
  targetUserId: string,
  messageCount: number = 2,
): Promise<void> {
  try {
    const fn = httpsCallable<StartConvoRequest, { success: boolean }>(functions, 'earnXP');
    await fn({
      action:       'START_CONVO',
      targetUid:    targetUserId,
      actionId:     newActionId(`convo_${targetUserId}`),
      messageCount,
    });
  } catch (error: unknown) {
    const e = error as { code?: string; message?: string };
    console.error('[engagementService] onMessageSent error:', e?.code, e?.message);
  }
}