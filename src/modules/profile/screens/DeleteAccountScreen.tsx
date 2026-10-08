// ============================================
// LUMINA — EXCLUIR CONTA
// src/modules/profile/screens/DeleteAccountScreen.tsx
//
// Diz com clareza o que some, o que fica anonimizado e que não tem
// volta. Exige a senha (reautenticação) e digitar EXCLUIR — dois
// passos deliberados para uma ação irreversível.
// ============================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import Header from '../../../components/Header';
import PasswordInput from '../../../components/PasswordInput';
import { deleteMyAccount } from '../services/accountDeletionService';

const CONFIRM_WORD = 'EXCLUIR';

const DELETED = [
  'Perfil, fotos e galeria',
  'Conversas, Sintonias e conexões (somem também para a outra pessoa)',
  'Curtidas, visitas, notificações e chamados de suporte',
  'Cristais, fragmentos, conquistas, títulos, molduras e Galáxia Plus',
];

const KEPT = [
  'Registros de compras, vendas e saques, sem identificar você (exigência fiscal)',
  'Suas avaliações de produtos, como "Usuário removido"',
  'O comprovante de aceite dos termos, sem identificar você',
];

export default function DeleteAccountScreen() {
  const { logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const ready = password.length > 0 && confirm.trim().toUpperCase() === CONFIRM_WORD;

  async function handleDelete() {
    if (!ready || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteMyAccount(password);
      Alert.alert(
        'Conta excluída',
        'Seus dados estão sendo apagados. Obrigado por ter feito parte do Lumina.',
        [{ text: 'OK', onPress: () => { logout().catch(() => {}); } }],
        { cancelable: false },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível excluir a conta.');
      setDeleting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Header title="Excluir conta" showBack showHome />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.warning}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningTitle}>Isto não pode ser desfeito</Text>
            <Text style={styles.warningBody}>
              A conta é excluída na hora. Não há como recuperar nada depois.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>O que é apagado</Text>
          {DELETED.map(item => (
            <Text key={item} style={styles.item}>• {item}</Text>
          ))}

          <Text style={styles.sectionTitle}>O que fica, sem identificar você</Text>
          {KEPT.map(item => (
            <Text key={item} style={styles.item}>• {item}</Text>
          ))}

          <Text style={styles.sectionTitle}>Se você é criadora ou criador</Text>
          <Text style={styles.item}>
            • Com saldo a receber ou saque em andamento, a exclusão fica bloqueada até o saque.
          </Text>
          <Text style={styles.item}>
            • Produtos vendidos continuam disponíveis para quem comprou. Os nunca vendidos são apagados.
          </Text>

          <Text style={styles.label}>Sua senha</Text>
          <PasswordInput
            placeholder="Digite sua senha"
            value={password}
            onChangeText={setPassword}
            autoComplete="password"
            editable={!deleting}
          />

          <Text style={styles.label}>Digite {CONFIRM_WORD} para confirmar</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            placeholder={CONFIRM_WORD}
            placeholderTextColor={colors.gray}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!deleting}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.deleteBtn, (!ready || deleting) && styles.deleteBtnDisabled]}
            onPress={handleDelete}
            disabled={!ready || deleting}
            accessibilityRole="button"
            accessibilityLabel="Excluir minha conta definitivamente"
          >
            {deleting
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.deleteText}>Excluir minha conta</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content:   { padding: spacing.md, paddingBottom: spacing.xl * 2, gap: spacing.xs },
  warning: {
    alignItems: 'center', gap: spacing.xs, padding: spacing.lg, marginBottom: spacing.md,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.error,
    backgroundColor: colors.error + '15',
  },
  warningIcon:  { fontSize: 36 },
  warningTitle: { color: colors.error, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  warningBody:  { color: colors.grayLight, fontSize: fonts.sizes.sm, textAlign: 'center' },
  sectionTitle: {
    color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold',
    marginTop: spacing.md, marginBottom: spacing.xs,
  },
  item:  { color: colors.grayLight, fontSize: fonts.sizes.sm, lineHeight: 20 },
  label: { color: colors.grayLight, fontSize: fonts.sizes.sm, marginTop: spacing.lg, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface, color: colors.white, borderRadius: borderRadius.sm,
    padding: spacing.md, fontSize: fonts.sizes.md, borderWidth: 1, borderColor: colors.grayDark,
  },
  error: { color: colors.error, fontSize: fonts.sizes.sm, textAlign: 'center', marginTop: spacing.md },
  deleteBtn: {
    marginTop: spacing.lg, backgroundColor: colors.error, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center',
  },
  deleteBtnDisabled: { opacity: 0.4 },
  deleteText: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
});