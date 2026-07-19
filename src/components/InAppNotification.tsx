import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, alpha } from '../theme/tokens';

// ✅ Tipos expandidos com marketplace
type NotificationType =
  | 'message'
  | 'request'
  | 'default'
  | 'sale_completed'
  | 'purchase_confirmed'
  | 'creator_approved'
  | 'product_approved'
  | 'refund_processed'
  | 'withdrawal_paid'
  | 'withdrawal_rejected';

interface InAppNotificationProps {
  title: string;
  message: string;
  type: NotificationType;
  onPress?: () => void;
  onDismiss: () => void;
}

export default function InAppNotification({
  title,
  message,
  type,
  onPress,
  onDismiss,
}: InAppNotificationProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      dismiss();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  }

  function getIcon(): string {
    switch (type) {
      case 'message':           return '💬';
      case 'request':           return '✦';
      case 'sale_completed':    return '💰';
      case 'purchase_confirmed':return '📦';
      case 'creator_approved':  return '🎨';
      case 'product_approved':  return '✅';
      case 'refund_processed':  return '↩️';
      case 'withdrawal_paid':   return '💸';
      case 'withdrawal_rejected':return '❌';
      default:                  return '🔔';
    }
  }

  function getBorderColor(): string {
    switch (type) {
      case 'sale_completed':
      case 'withdrawal_paid':
      case 'creator_approved':
      case 'product_approved':
        return alpha(COLORS.success, 0.53);
      case 'withdrawal_rejected':
        return alpha(COLORS.error, 0.53);
      case 'refund_processed':
        return alpha(COLORS.textSecondary, 0.53);
      default:
        return alpha(COLORS.gold, 0.4);
    }
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }], opacity, borderColor: getBorderColor() },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={() => {
          dismiss();
          onPress?.();
        }}
        activeOpacity={0.9}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{getIcon()}</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.message} numberOfLines={2}>{message}</Text>
        </View>
        <TouchableOpacity onPress={dismiss} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
      <View style={styles.progressBar}>
        <Animated.View style={styles.progressFill} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 9999,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(31, 31, 37, 0.95)',
    borderWidth: 1,
    borderColor: alpha(COLORS.gold, 0.25),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 16,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: alpha(COLORS.gold, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: alpha(COLORS.gold, 0.2),
  },
  icon: { fontSize: FONT_SIZE.xl },
  textContainer: { flex: 1 },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.bold,
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.caption,
    marginTop: 2,
  },
  closeButton: { padding: SPACING.xs },
  closeText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  progressBar: { height: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  progressFill: { height: 2, backgroundColor: COLORS.gold, width: '100%' },
});