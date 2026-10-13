// ============================================
// LUMINA — ALERT NA WEB (fila e instalação)
// src/utils/webAlert.ts
//
// O react-native-web implementa Alert.alert vazio: na web as 241
// chamadas do app ficavam mudas, inclusive confirmações de ações
// críticas (desbloquear, excluir conta, aprovar saque).
//
// Este módulo guarda os alertas numa fila; o WebAlertHost.web.tsx
// desenha o primeiro da fila como modal. installWebAlert() troca o
// Alert.alert do react-native-web por showWebAlert UMA vez, na
// abertura do site: as chamadas continuam iguais (mesma API).
//
// Só é importado por arquivos .web.tsx — não entra no Android.
// ============================================

import { Alert } from 'react-native';
import type { AlertButton, AlertOptions } from 'react-native';

export interface WebAlertRequest {
  id:       number;
  title:    string;
  message?: string;
  buttons:  AlertButton[];
  options?: AlertOptions;
}

type Listener = (current: WebAlertRequest | null) => void;

const DEFAULT_BUTTONS: AlertButton[] = [{ text: 'OK' }];
/** O Android mostra no máximo 3 botões; a web segue o mesmo limite. */
const MAX_BUTTONS = 3;

const queue: WebAlertRequest[] = [];
const listeners = new Set<Listener>();
let nextId    = 1;
let installed = false;

function notify(): void {
  const current = queue[0] ?? null;
  listeners.forEach(listener => listener(current));
}

/** Mesma assinatura do Alert.alert do React Native. */
export function showWebAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions,
): void {
  const valid = (buttons ?? []).filter(Boolean).slice(0, MAX_BUTTONS);
  queue.push({
    id:      nextId++,
    title:   title == null ? '' : String(title),
    message: message == null ? undefined : String(message),
    buttons: valid.length > 0 ? valid : DEFAULT_BUTTONS,
    options,
  });
  if (queue.length === 1) notify();
}

/**
 * Fecha o alerta atual e roda a ação do botão escolhido — ou o
 * onDismiss, quando fechado sem botão. A ação roda DEPOIS de tirar o
 * alerta da fila: um Alert.alert chamado dentro dela entra na fila e
 * aparece em seguida, como no Android. O id evita toque duplo.
 */
export function resolveWebAlert(id: number, button?: AlertButton): void {
  const current = queue[0];
  if (!current || current.id !== id) return;
  queue.shift();
  notify();
  try {
    if (button) button.onPress?.();
    else current.options?.onDismiss?.();
  } catch (error) {
    console.error('[webAlert] Erro na ação do botão:', error);
  }
}

export function subscribeWebAlert(listener: Listener): () => void {
  listeners.add(listener);
  listener(queue[0] ?? null);
  return () => { listeners.delete(listener); };
}

/** Instala o Alert da web uma única vez. */
export function installWebAlert(): void {
  if (installed) return;
  try {
    (Alert as unknown as { alert: typeof showWebAlert }).alert = showWebAlert;
    installed = true;
  } catch (error) {
    console.error('[webAlert] Não foi possível instalar o Alert da web:', error);
  }
}