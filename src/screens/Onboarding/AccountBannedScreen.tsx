// ============================================
// LUMINA — CONTA ENCERRADA
// src/screens/Onboarding/AccountBannedScreen.tsx
//
// Tela TERMINAL: não há reenvio nem recurso dentro do app.
//
// Tom sóbrio, sem punição: a maioria de quem chega aqui é
// menor de idade tentando usar o app, e isso não é crime —
// é só um serviço que não é para essa pessoa. E existe o
// caso do adulto rejeitado por erro de leitura do
// documento, que precisa de um canal.
// ============================================

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import ScreenContainer from '../../components/ScreenContainer';
import GateHeader from '../../modules/verification/components/GateHeader';

export default function AccountBannedScreen() {
  const { user } = useAuth();
  const { accessGate } = useUserPermissions(user?.uid);

  const isUnderage = accessGate.ageRejectionReason === 'UNDERAGE';

  return (
    <ScreenContainer noTop>
      <GateHeader title="Conta encerrada" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.icon}>🔒</Text>

        <Text style={styles.heading}>
          {isUnderage ? 'O Lumina é para maiores de 18 anos' : 'Sua conta foi encerrada'}
        </Text>

        <Text style={styles.body}>
          {isUnderage
            ? 'O documento enviado indica que você ainda não tem 18 anos. Por isso sua conta foi encerrada e não é possível usar o aplicativo.'
            : 'Sua conta foi encerrada por violação dos Termos de Uso e não é possível usar o aplicativo.'}
        </Text>

        {isUnderage && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Por que isso existe</Text>
            <Text style={styles.cardBody}>
              O Lumina disponibiliza conteúdo adulto e a lei exige
              que a plataforma impeça o acesso de menores de idade.
              Não é uma escolha nossa: é uma obrigação.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔒 Suas fotos foram apagadas</Text>
          <Text style={styles.cardBody}>
            As imagens do documento e a sua foto já foram eliminadas
            dos nossos servidores.
          </Text>
        </View>

        {/* LEMBRETE: preencher o e-mail do suporte aqui */}
        <View style={styles.supportCard}>
          <Text style={styles.cardTitle}>Houve um erro na análise?</Text>
          <Text style={styles.cardBody}>
            Se você tem 18 anos ou mais e sua conta foi encerrada por
            engano, escreva para o nosso suporte com seu nome e o
            e-mail cadastrado.
          </Text>
          <Text style={styles.email}>[PREENCHER: e-mail do suporte]</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  icon: { fontSize: 56, textAlign: 'center' },
  heading: {
    color: colors.white,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 30,
  },
  body: {
    color: colors.grayLight,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
    padding: spacing.md,
    gap: spacing.xs,
  },
  supportCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold + '44',
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  cardBody: { color: colors.gray, fontSize: fonts.sizes.sm, lineHeight: 20 },
  email: {
    color: colors.gold,
    fontSize: fonts.sizes.sm,
    fontWeight: 'bold',
    marginTop: spacing.xs,
  },
});