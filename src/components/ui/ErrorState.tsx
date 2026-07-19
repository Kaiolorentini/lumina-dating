import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Button } from './Button';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../theme/tokens';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: string;
}

/**
 * Estado de erro elegante com ação de tentar novamente.
 * Usado em listas/ telas que falham ao carregar dados.
 */
export function ErrorState({
  title = 'Algo deu errado',
  message = 'Não foi possível carregar. Verifique sua conexão e tente novamente.',
  onRetry,
  retryLabel = 'Tentar novamente',
  icon = '⚠️',
}: ErrorStateProps) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Button label={retryLabel} variant="primary" onPress={onRetry} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  icon: {
    fontSize: 56,
    marginBottom: SPACING.sm,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center',
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
});
