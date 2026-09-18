// ============================================
// LUMINA — AGUARDANDO VERIFICAÇÃO
// src/screens/Onboarding/VerificationPendingScreen.tsx
//
// Cobre três estados, porque os três são "esperar ou
// reagir" e dividir em telas separadas duplicaria o
// carrossel:
//   pending  → carrossel + prazo
//   rejected → motivo, tentativas restantes, reenviar
//   esgotado → contato com o suporte
//
// NÃO tem botão de atualizar: o useUserPermissions escuta
// users/{uid} com onSnapshot, então a árvore troca sozinha
// no instante em que o admin aprova.
//
// O prazo é "normalmente em até 2 horas" com a ressalva do
// horário comercial: a análise depende de alguém abrir o
// painel, e prometer o que não se controla gera reclamação.
// ============================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import ScreenContainer from '../../components/ScreenContainer';
import GateHeader from '../../modules/verification/components/GateHeader';
import WaitingCarousel from '../../modules/verification/components/WaitingCarousel';
import { REJECTION_TEXT, MAX_ATTEMPTS } from '../../config/verification';

interface Props {
  /** Abre a tela de captura para reenviar. */
  onResubmit: () => void;
}

export default function VerificationPendingScreen({ onResubmit }: Props) {
  const { user } = useAuth();
  const { accessGate } = useUserPermissions(user?.uid);

  const isRejected = accessGate.ageVerificationStatus === 'rejected';
  const reason = accessGate.ageRejectionReason;
  const note = accessGate.ageRejectionNote;

  // UNDERAGE nunca chega aqui: o gate manda para a tela de
  // conta encerrada. Qualquer outro motivo permite reenvio
  // enquanto houver tentativa.
  if (isRejected) {
    return (
      <ScreenContainer noTop>
        <GateHeader title="Verificação não aprovada" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.bigIcon}>⚠️</Text>
          <Text style={styles.heading}>Precisamos de novas fotos</Text>

          <View style={styles.reasonCard}>
            <Text style={styles.reasonText}>
              {reason ? REJECTION_TEXT[reason] ?? REJECTION_TEXT.OTHER : REJECTION_TEXT.OTHER}
            </Text>
            {note ? <Text style={styles.noteText}>{note}</Text> : null}
          </View>

          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Para dar certo desta vez</Text>
            <Text style={styles.tip}>• Documento inteiro dentro do quadro</Text>
            <Text style={styles.tip}>• Ambiente bem iluminado, sem reflexo</Text>
            <Text style={styles.tip}>• Documento original, não fotocópia</Text>
            <Text style={styles.tip}>• Seu rosto e o documento na mesma foto</Text>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={onResubmit}>
            <Text style={styles.primaryBtnText}>Enviar novas fotos</Text>
          </TouchableOpacity>

          <Text style={styles.attempts}>
            Você tem até {MAX_ATTEMPTS} tentativas no total.
          </Text>

          {/* LEMBRETE: preencher o e-mail do suporte aqui */}
          <Text style={styles.support}>
            Acha que houve um erro na análise? Escreva para{'\n'}
            [PREENCHER: e-mail do suporte]
          </Text>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer noTop>
      <GateHeader title="Analisando seu documento" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statusCard}>
          <Text style={styles.statusIcon}>🔍</Text>
          <Text style={styles.statusTitle}>Estamos conferindo</Text>
          <Text style={styles.statusBody}>
            Suas fotos chegaram e nossa equipe já está analisando.
            Normalmente leva até 2 horas.
          </Text>
          <Text style={styles.statusFine}>
            Fora do horário comercial pode demorar um pouco mais.
            Você não precisa fazer nada: assim que for aprovado,
            o app abre sozinho e você recebe uma notificação.
          </Text>
        </View>

        <Text style={styles.carouselIntro}>
          Enquanto isso, conheça o que espera por você
        </Text>

        <WaitingCarousel />

        <View style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>🔒 Suas fotos são apagadas</Text>
          <Text style={styles.privacyBody}>
            Depois da análise, as imagens do seu documento e a sua
            foto são eliminadas dos nossos servidores. Guardamos
            apenas a confirmação de que você é maior de 18 anos.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  bigIcon: { fontSize: 56, textAlign: 'center' },
  heading: {
    color: colors.white,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gold + '44',
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusIcon: { fontSize: 40 },
  statusTitle: {
    color: colors.white,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  statusBody: {
    color: colors.grayLight,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  statusFine: {
    color: colors.gray,
    fontSize: fonts.sizes.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  carouselIntro: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  privacyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
    padding: spacing.md,
    gap: spacing.xs,
  },
  privacyTitle: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  privacyBody: { color: colors.gray, fontSize: fonts.sizes.xs, lineHeight: 18 },
  reasonCard: {
    backgroundColor: colors.error + '11',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.md,
    gap: spacing.xs,
  },
  reasonText: { color: colors.white, fontSize: fonts.sizes.md, lineHeight: 22 },
  noteText: { color: colors.grayLight, fontSize: fonts.sizes.sm, lineHeight: 20 },
  tipsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
    padding: spacing.md,
    gap: spacing.xs,
  },
  tipsTitle: {
    color: colors.gold,
    fontSize: fonts.sizes.sm,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  tip: { color: colors.grayLight, fontSize: fonts.sizes.sm, lineHeight: 20 },
  primaryBtn: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.background,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  attempts: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center' },
  support: {
    color: colors.gray,
    fontSize: fonts.sizes.xs,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.md,
  },
});