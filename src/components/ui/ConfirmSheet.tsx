import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../theme/tokens';

interface ConfirmSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'success' | 'danger' | 'ghost';
  onConfirm: () => void;
}

export function ConfirmSheet({
  visible,
  onClose,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'primary',
  onConfirm,
}: ConfirmSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.container}>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Button
          label={confirmLabel}
          variant={confirmVariant}
          onPress={() => {
            onClose();
            onConfirm();
          }}
        />
        <Button label={cancelLabel} variant="ghost" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
});
