// ============================================
// LUMINA — HOST DE ALERTAS (WEB)
// src/components/web/WebAlertHost.web.tsx
//
// Desenha como modal os Alert.alert do app no navegador (fila em
// utils/webAlert.ts). Regras de segurança:
// - Esc: só aciona o botão "cancel"; com um único botão, fecha.
//   Sem botão de cancelar, só fecha se o alerta for cancelable.
// - Enter: só o botão marcado isPreferred, ou o único botão.
//   Nunca confirma sozinho uma ação com duas opções.
// - Clique fora: só fecha alertas cancelable (padrão do Android).
// ============================================

import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { AlertButton } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import {
  installWebAlert,
  subscribeWebAlert,
  resolveWebAlert,
  WebAlertRequest,
} from '../../utils/webAlert';

// Instala antes de qualquer tela chamar Alert.alert.
installWebAlert();

interface KeyEventLike { key: string; preventDefault(): void }
interface KeyTarget {
  addEventListener(type: 'keydown', listener: (event: KeyEventLike) => void): void;
  removeEventListener(type: 'keydown', listener: (event: KeyEventLike) => void): void;
}
const keyTarget = (globalThis as unknown as { document?: KeyTarget }).document;

type CloseAction = AlertButton | 'dismiss' | null;

function escapeAction(request: WebAlertRequest): CloseAction {
  const cancel = request.buttons.find(b => b.style === 'cancel');
  if (cancel) return cancel;
  if (request.buttons.length === 1) return request.buttons[0];
  if (request.options?.cancelable) return 'dismiss';
  return null;
}

function enterAction(request: WebAlertRequest): AlertButton | null {
  const preferred = request.buttons.find(b => b.isPreferred);
  if (preferred) return preferred;
  return request.buttons.length === 1 ? request.buttons[0] : null;
}

export default function WebAlertHost() {
  const [current, setCurrent] = useState<WebAlertRequest | null>(null);

  useEffect(() => subscribeWebAlert(setCurrent), []);

  const close = useCallback((action: CloseAction) => {
    if (!current || action === null) return;
    resolveWebAlert(current.id, action === 'dismiss' ? undefined : action);
  }, [current]);

  useEffect(() => {
    if (!current || !keyTarget) return;
    const onKey = (event: KeyEventLike) => {
      if (event.key === 'Escape') {
        const action = escapeAction(current);
        if (action) { event.preventDefault(); close(action); }
      } else if (event.key === 'Enter') {
        const action = enterAction(current);
        if (action) { event.preventDefault(); close(action); }
      }
    };
    keyTarget.addEventListener('keydown', onKey);
    return () => keyTarget.removeEventListener('keydown', onKey);
  }, [current, close]);

  if (!current) return null;

  const cancelable = current.options?.cancelable === true;

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={() => close(escapeAction(current))}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={cancelable ? () => close('dismiss') : undefined}
          accessibilityLabel={cancelable ? 'Fechar aviso' : undefined}
          focusable={false}
        />
        <View style={styles.card} role="alertdialog" aria-modal accessibilityLabel={current.title}>
          {!!current.title && <Text style={styles.title}>{current.title}</Text>}
          {!!current.message && (
            <ScrollView style={styles.messageBox} contentContainerStyle={styles.messageContent}>
              <Text style={styles.message}>{current.message}</Text>
            </ScrollView>
          )}
          <View style={styles.buttons}>
            {current.buttons.map((button, index) => (
              <Pressable
                key={`${current.id}-${index}`}
                onPress={() => close(button)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.button,
                  button.style === 'cancel'      && styles.buttonCancel,
                  button.style === 'destructive' && styles.buttonDestructive,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === 'cancel'      && styles.buttonTextCancel,
                    button.style === 'destructive' && styles.buttonTextDestructive,
                  ]}
                >
                  {button.text ?? 'OK'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: spacing.lg, backgroundColor: 'rgba(0,0,0,0.65)',
  },
  card: {
    width: '100%', maxWidth: 400, gap: spacing.md,
    padding: spacing.lg, borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.gold + '55',
  },
  title:          { color: colors.white, fontSize: 18, fontWeight: 'bold' },
  messageBox:     { maxHeight: 360 },
  messageContent: { paddingBottom: spacing.xs },
  message:        { color: colors.white, fontSize: fonts.sizes.md, lineHeight: 22 },
  buttons: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm,
  },
  button: {
    minWidth: 96, alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, backgroundColor: colors.gold,
  },
  buttonCancel: {
    backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.gray,
  },
  buttonDestructive:     { backgroundColor: colors.error },
  buttonPressed:         { opacity: 0.75 },
  buttonText:            { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
  buttonTextCancel:      { color: colors.white },
  buttonTextDestructive: { color: colors.white },
});