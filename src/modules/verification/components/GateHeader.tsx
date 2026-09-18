// ============================================
// LUMINA — HEADER DAS TELAS DO GATE
// src/modules/verification/components/GateHeader.tsx
//
// O Header padrão não serve aqui: ele chama goBack() e
// navega para MainTabs, e nenhuma das duas rotas existe
// na árvore do gate — a pessoa ainda não entrou no app.
//
// Aqui a única saída é sair da conta, com confirmação:
// sair por engano no meio da verificação é frustrante.
// ============================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';

interface Props {
  title: string;
  /** Oculta o botão de sair em telas que já têm o seu. */
  hideLogout?: boolean;
}

export default function GateHeader({ title, hideLogout }: Props) {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();

  async function doLogout() {
    try {
      await logout();
    } catch (error) {
      console.error('[GateHeader] logout falhou:', error);
    }
  }

  function confirmLogout() {
    // Platform.OS === 'web' porque Alert.alert com botões
    // não funciona no navegador — mesmo padrão do ProfileScreen.
    if (Platform.OS === 'web') {
      if ((window as any).confirm('Sair da conta?')) doLogout();
      return;
    }

    Alert.alert('Sair da conta?', 'Você pode entrar novamente quando quiser.', [
      { text: 'Continuar aqui', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: doLogout },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.side} />

      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>

      <View style={styles.side}>
        {!hideLogout && (
          <TouchableOpacity onPress={confirmLogout} hitSlop={10} activeOpacity={0.7}>
            <Text style={styles.logout}>Sair</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayDark,
  },
  side: { width: 60, alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  title: {
    color: colors.white,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  logout: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    fontWeight: 'bold',
  },
});