import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../theme';

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
        return colors.success + '88';
      case 'withdrawal_rejected':
        return colors.error + '88';
      case 'refund_processed':
        return colors.gray + '88';
      default:
        return colors.gold + '66';
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
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gold + '66',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gold + '22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold + '44',
  },
  icon: { fontSize: 18 },
  textContainer: { flex: 1 },
  title: {
    color: colors.white,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
  },
  message: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    marginTop: 2,
  },
  closeButton: { padding: spacing.xs },
  closeText: { color: colors.gray, fontSize: fonts.sizes.sm },
  progressBar: { height: 2, backgroundColor: colors.grayDark },
  progressFill: { height: 2, backgroundColor: colors.gold, width: '100%' },
});