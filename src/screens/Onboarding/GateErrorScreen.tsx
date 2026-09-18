// ============================================
// LUMINA — ERRO AO CARREGAR O ACESSO
// src/screens/Onboarding/GateErrorScreen.tsx
//
// Aparece quando o useUserPermissions falha ou estoura o
// timeout de 10s. O gate falha FECHADO de propósito: sem
// saber o status real, mandar a pessoa para a tela de
// verificação faria alguém já aprovado reenviar documento.
// ============================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import ScreenContainer from '../../components/ScreenContainer';
import GateHeader from '../../modules/verification/components/GateHeader';

interface Props {
  onRetry: () => void;
}

export default function GateErrorScreen({ onRetry }: Props) {
  return (
    <ScreenContainer noTop>
      <GateHeader title="Sem conexão" />
      <View style={styles.content}>
        <Text style={styles.icon}>📡</Text>
        <Text style={styles.heading}>Não conseguimos carregar sua conta</Text>
        <Text style={styles.body}>
          Verifique sua internet e tente de novo. Seus dados estão
          seguros — é só a conexão que falhou.
        </Text>

        <TouchableOpacity style={styles.btn} onPress={onRetry}>
          <Text style={styles.btnText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  icon: { fontSize: 56 },
  heading: {
    color: colors.white,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  body: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  btnText: {
    color: colors.background,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});