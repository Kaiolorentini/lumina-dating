import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors, fonts, spacing } from '../../theme';

// ============================================
// LOADING SCREEN — COMPARTILHADO
// Tela de loading padrão do app
// ============================================

interface Props {
  message?: string;
}

export default function LoadingScreen({ message }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>✦</Text>
      <ActivityIndicator
        color={colors.gold}
        size="large"
        style={styles.spinner}
      />
      {message && (
        <Text style={styles.message}>{message}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  logo: {
    fontSize: 40,
    color: colors.gold,
  },
  spinner: {
    marginTop: spacing.sm,
  },
  message: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
  },
});