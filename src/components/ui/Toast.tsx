import React, { useEffect, createContext, useContext, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, alpha } from '../../theme/tokens';
import { useProgressBar } from '../../hooks';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastData {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  visible: boolean;
  action?: ToastAction;
}

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  visible: boolean;
  action?: ToastAction;
  onHide: () => void;
}

function ToastComponent({ message, type, visible, action, onHide }: ToastProps) {
  const progress = useProgressBar();

  useEffect(() => {
    if (visible) {
      progress.animateTo(1, 300);
      const timeout = setTimeout(() => {
        onHide();
        progress.setProgress(0);
      }, action ? 5000 : 3000);

      return () => clearTimeout(timeout);
    }
  }, [visible, action]);

  if (!visible) return null;

  const typeColors = {
    success: COLORS.success,
    error: COLORS.error,
    info: COLORS.secondary,
    warning: COLORS.warning,
  };

  const typeIcon = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '!',
  };

  return (
    <Animated.View
      style={[styles.container, { opacity: progress.progress }]}
    >
      <View style={[styles.toast, { backgroundColor: typeColors[type] }]}>
        <Text style={styles.icon}>{typeIcon[type]}</Text>
        <Text style={styles.message}>{message}</Text>
        {action && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              action.onPress();
              onHide();
              progress.setProgress(0);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.actionText}>{action.label}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[styles.progressBar, { width: `${progress.progress * 100}%` }]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', action?: ToastAction) => {
    setToast({ message, type, visible: true, action });
  };

  const hideToast = () => {
    setToast((prev) => (prev ? { ...prev, visible: false } : null));
    setTimeout(() => setToast(null), 300);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastComponent
        message={toast?.message || ''}
        type={toast?.type || 'info'}
        visible={toast?.visible || false}
        action={toast?.action}
        onHide={hideToast}
      />
    </ToastContext.Provider>
  );
}

export { ToastComponent as Toast };

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: SPACING.xl,
    left: SPACING.lg,
    right: SPACING.lg,
    zIndex: 1000,
  },
  toast: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  message: {
    color: COLORS.surface,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    flex: 1,
  },
  icon: {
    color: COLORS.surface,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  actionButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: alpha(COLORS.surface, 0.18),
  },
  actionText: {
    color: COLORS.surface,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    textTransform: 'uppercase',
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: alpha(COLORS.surface, 0.3),
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
    width: 60,
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.full,
  },
});