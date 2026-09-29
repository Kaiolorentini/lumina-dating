// ============================================
// LUMINA — CAMPO DE SENHA COM "MOSTRAR SENHA"
// src/components/PasswordInput.tsx
//
// Mesmo visual dos campos das telas de acesso, com o olho à direita.
// Ícone em SVG (react-native-svg, já usado pelo CrystalIcon) — sem
// biblioteca nova. Cada campo controla a própria visibilidade.
// ============================================

import React, { forwardRef, useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet, TextInputProps,
} from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { colors, fonts, spacing, borderRadius } from '../theme';

type Props = Omit<TextInputProps, 'secureTextEntry' | 'style'> & {
  /** 'password' no login; 'new-password' no cadastro. */
  autoComplete?: 'password' | 'new-password';
};

function EyeIcon({ open }: { open: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
        stroke={colors.gray}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={3} stroke={colors.gray} strokeWidth={1.8} />
      {!open && (
        <Line x1={3} y1={3} x2={21} y2={21} stroke={colors.gray} strokeWidth={1.8} strokeLinecap="round" />
      )}
    </Svg>
  );
}

const PasswordInput = forwardRef<TextInput, Props>(function PasswordInput(
  { autoComplete = 'password', ...inputProps },
  ref,
) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <TextInput
        ref={ref}
        {...inputProps}
        style={styles.input}
        placeholderTextColor={colors.gray}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        textContentType={autoComplete === 'new-password' ? 'newPassword' : 'password'}
      />
      <TouchableOpacity
        style={styles.eye}
        onPress={() => setVisible(v => !v)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
      >
        <EyeIcon open={visible} />
      </TouchableOpacity>
    </View>
  );
});

export default PasswordInput;

const styles = StyleSheet.create({
  wrap: {
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.white,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    paddingRight: spacing.md + 36,
    fontSize: fonts.sizes.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  eye: {
    position: 'absolute',
    right: spacing.md,
    height: '100%',
    justifyContent: 'center',
  },
});