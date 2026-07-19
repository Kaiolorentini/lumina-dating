import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../theme/tokens';

// ============================================
// ERROR SCREEN — COMPARTILHADO
// Tela de erro padrão do app
// ============================================

interface Props {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorScreen({
  title = 'Algo deu errado',
  message = 'Tente novamente em alguns instantes',
  onRetry,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Tentar novamente</Text>
        </TouchableOpacity>
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
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  icon: { fontSize: 60 },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center',
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    backgroundColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  buttonText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHT.bold,
    fontSize: FONT_SIZE.body,
  },
});