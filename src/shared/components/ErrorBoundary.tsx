import React, { Component, ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../theme/tokens';

// ============================================
// ERROR BOUNDARY — COMPARTILHADO
//
// Captura erros em qualquer componente filho.
// Evita que o app trave completamente.
// Uso: <ErrorBoundary><SeuComponente /></ErrorBoundary>
// ============================================

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Algo deu errado</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'Erro inesperado'}
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.handleReset()}
          >
            <Text style={styles.buttonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
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