// ============================================
// LUMINA — CPF PROMPT MODAL
// src/components/CpfPromptModal.tsx
//
// Pede o CPF no momento da compra e devolve os dígitos
// para quem chamou. NUNCA persiste: o valor vive apenas
// no state deste componente e é descartado no unmount.
//
// LGPD — minimização (Art. 6º, III): o CPF é exigido pelo
// Banco Central para cobrança Pix, mas não há razão para
// o Lumina armazená-lo. Ele trafega app → Cloud Function
// → Asaas e não toca o Firestore.
//
// Usado por: ProductDetailScreen (produtos) e
// StoreScreen (cristais).
// ============================================

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../theme';
import { maskCpf, isValidCpf, onlyDigits } from '../utils/cpf';

interface CpfPromptModalProps {
  visible: boolean;
  /** Trava os controles enquanto a cobrança é criada. */
  loading?: boolean;
  /** Recebe os 11 dígitos, sem máscara. */
  onConfirm: (cpfDigits: string) => void;
  onCancel: () => void;
}

export default function CpfPromptModal({
  visible,
  loading = false,
  onConfirm,
  onCancel,
}: CpfPromptModalProps) {
  const [cpf, setCpf] = useState('');
  const [touched, setTouched] = useState(false);

  const digits = onlyDigits(cpf);
  const isComplete = digits.length === 11;
  const isValid = isComplete && isValidCpf(cpf);
  const showError = touched && isComplete && !isValid;

  function handleChange(value: string) {
    setCpf(maskCpf(value));
    if (!touched) setTouched(true);
  }

  function handleConfirm() {
    if (!isValid || loading) return;
    onConfirm(digits);
  }

  function handleCancel() {
    if (loading) return;
    setCpf('');
    setTouched(false);
    onCancel();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Confirme seu CPF</Text>

            <Text style={styles.body}>
              O CPF é exigido pelo Banco Central para emitir cobranças
              via Pix. Sem ele, o pagamento não pode ser gerado.
            </Text>

            <Text style={styles.body}>
              Não guardamos seu CPF. Ele é enviado direto ao processador
              de pagamento e não fica salvo no Lumina — por isso pedimos
              a cada compra.
            </Text>

            <TextInput
              style={[styles.input, showError && styles.inputError]}
              placeholder="000.000.000-00"
              placeholderTextColor={colors.gray}
              value={cpf}
              onChangeText={handleChange}
              keyboardType="numeric"
              maxLength={14}
              editable={!loading}
              autoFocus
              accessibilityLabel="Digite seu CPF"
            />

            {showError ? (
              <Text style={styles.errorText}>
                CPF inválido. Confira os números digitados.
              </Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (!isValid || loading) && styles.confirmBtnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!isValid || loading}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.confirmBtnText}>Continuar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancel}
              disabled={loading}
              accessibilityRole="button"
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold + '44',
    padding: spacing.lg,
    maxHeight: '85%',
  },
  title: {
    color: colors.gold,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  body: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.background,
    color: colors.white,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.grayDark,
    padding: spacing.md,
    fontSize: fonts.sizes.lg,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: fonts.sizes.xs,
    marginTop: spacing.xs,
  },
  confirmBtn: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: fonts.sizes.md,
  },
  cancelBtn: {
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  cancelBtnText: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
  },
});
