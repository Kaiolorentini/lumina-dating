// ============================================
// LUMINA — ESQUECI MINHA SENHA
// src/modules/auth/components/ForgotPasswordModal.tsx
//
// Janela sobre o Login. Envia o link de redefinição e confirma com uma
// mensagem neutra (não revela se o e-mail tem conta). Reenvio liberado
// depois de 60 segundos.
// ============================================

import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { requestPasswordReset } from '../services/passwordResetService';

const RESEND_SECONDS = 60;

interface Props {
  visible:      boolean;
  initialEmail: string;
  onClose:      () => void;
}

export default function ForgotPasswordModal({ visible, initialEmail, onClose }: Props) {
  const [email, setEmail]       = useState(initialEmail);
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Cada abertura começa do zero, com o e-mail do Login.
  useEffect(() => {
    if (!visible) return;
    setEmail(initialEmail);
    setSent(false);
    setError(null);
  }, [visible, initialEmail]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function send() {
    if (sending || cooldown > 0) return;
    setSending(true);
    setError(null);
    const result = await requestPasswordReset(email);
    setSending(false);
    if (result.ok) {
      setSent(true);
      setCooldown(RESEND_SECONDS);
    } else {
      setError(result.message);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          {sent ? (
            <>
              <Text style={styles.icon}>📬</Text>
              <Text style={styles.title}>Confira seu e-mail</Text>
              <Text style={styles.text}>
                Se houver uma conta com <Text style={styles.bold}>{email.trim()}</Text>, enviamos um link
                para você criar uma senha nova. Pode levar alguns minutos — olhe também a caixa de spam.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={onClose} accessibilityRole="button">
                <Text style={styles.primaryText}>Voltar ao login</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={send}
                disabled={cooldown > 0 || sending}
                accessibilityRole="button"
              >
                <Text style={[styles.linkText, (cooldown > 0 || sending) && styles.linkDisabled]}>
                  {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar link'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.icon}>🔑</Text>
              <Text style={styles.title}>Esqueceu a senha?</Text>
              <Text style={styles.text}>
                Digite o e-mail da sua conta. Vamos enviar um link para você criar uma senha nova.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="seu@email.com"
                placeholderTextColor={colors.gray}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={send}
                autoFocus={!initialEmail}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity
                style={[styles.primaryBtn, (sending || !email.trim()) && styles.disabled]}
                onPress={send}
                disabled={sending || !email.trim()}
                accessibilityRole="button"
              >
                {sending
                  ? <ActivityIndicator color={colors.background} />
                  : <Text style={styles.primaryText}>Enviar link</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={onClose} accessibilityRole="button">
                <Text style={styles.linkText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.gold + '44', padding: spacing.lg,
    alignItems: 'center', gap: spacing.sm,
  },
  icon:  { fontSize: 44 },
  title: { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold', textAlign: 'center' },
  text:  { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center', lineHeight: 20 },
  bold:  { color: colors.white, fontWeight: 'bold' },
  input: {
    alignSelf: 'stretch', backgroundColor: colors.background, color: colors.white,
    borderRadius: borderRadius.sm, padding: spacing.md, fontSize: fonts.sizes.md,
    borderWidth: 1, borderColor: colors.grayDark, marginTop: spacing.xs,
  },
  error: { color: colors.error, fontSize: fonts.sizes.sm, textAlign: 'center' },
  primaryBtn: {
    alignSelf: 'stretch', backgroundColor: colors.gold, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.xs,
  },
  primaryText: { color: colors.background, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  disabled:    { opacity: 0.5 },
  linkBtn:     { padding: spacing.sm },
  linkText:    { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  linkDisabled: { color: colors.gray },
});