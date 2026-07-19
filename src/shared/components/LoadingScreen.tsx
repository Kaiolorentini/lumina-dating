import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../theme/tokens';

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
        color={COLORS.gold}
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
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  logo: {
    fontSize: 40,
    color: COLORS.gold,
  },
  spinner: {
    marginTop: SPACING.sm,
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.body,
    textAlign: 'center',
  },
});