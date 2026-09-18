// ============================================
// LUMINA — CAPTURA DA VERIFICAÇÃO
// src/screens/Onboarding/AgeVerificationScreen.tsx
//
// TRÊS ETAPAS com instrução própria em cada: frente do
// documento, verso, selfie segurando. Verificação é onde
// as pessoas mais erram e desistem — instrução clara
// reduz rejeição por foto ilegível, que custa tempo de
// moderação e uma das 3 tentativas.
//
// SÓ CÂMERA, nunca galeria: foto de galeria pode ser
// imagem de outra pessoa baixada da internet.
//
// As imagens só sobem ao Storage no envio final, não a
// cada etapa: quem desiste na etapa 2 não deixa imagem de
// documento órfã no servidor.
// ============================================

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import ScreenContainer from '../../components/ScreenContainer';
import GateHeader from '../../modules/verification/components/GateHeader';
import { useAgeVerification } from '../../modules/verification/hooks/useAgeVerification';
import {
  STEP_COPY, VERIFICATION_STEPS, MAX_ATTEMPTS,
} from '../../config/verification';

interface Props {
  /** Chamado quando o envio é aceito pelo servidor. */
  onSubmitted: () => void;
}

export default function AgeVerificationScreen({ onSubmitted }: Props) {
  const {
    stepIndex, currentStep, captures, isComplete,
    submitting, progress, error, cameraDenied,
    capture, retake, goToStep, submit,
  } = useAgeVerification();

  const copy = STEP_COPY[currentStep];
  const currentImage = captures[currentStep];

  async function handleSubmit() {
    const ok = await submit();
    if (ok) onSubmitted();
  }

  function openSettings() {
    // A permissão negada só volta pelas configurações do
    // sistema: o ImagePicker não pergunta duas vezes.
    if (Platform.OS === 'ios') Linking.openURL('app-settings:');
    else Linking.openSettings();
  }

  return (
    <ScreenContainer noTop>
      <GateHeader title="Verificação de idade" />

      {/* Progresso das etapas */}
      <View style={styles.stepsBar}>
        {VERIFICATION_STEPS.map((step, i) => {
          const done = !!captures[step];
          const active = i === stepIndex;
          return (
            <TouchableOpacity
              key={step}
              style={styles.stepPill}
              onPress={() => goToStep(i)}
              disabled={submitting}
            >
              <View
                style={[
                  styles.stepDot,
                  done && styles.stepDotDone,
                  active && styles.stepDotActive,
                ]}
              >
                <Text style={styles.stepDotText}>{done ? '✓' : i + 1}</Text>
              </View>
              <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>
                {STEP_COPY[step].title.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.instruction}>{copy.instruction}</Text>

        <View style={styles.tipsCard}>
          {copy.tips.map(tip => (
            <Text key={tip} style={styles.tip}>• {tip}</Text>
          ))}
        </View>

        {/* Prévia ou área de captura */}
        {currentImage ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: currentImage.uri }} style={styles.preview} />
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={() => retake(currentStep)}
              disabled={submitting}
            >
              <Text style={styles.retakeBtnText}>Tirar outra foto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.captureArea}
            onPress={capture}
            disabled={submitting}
          >
            <Text style={styles.captureIcon}>📷</Text>
            <Text style={styles.captureText}>Abrir a câmera</Text>
          </TouchableOpacity>
        )}

        {cameraDenied && (
          <View style={styles.deniedCard}>
            <Text style={styles.deniedTitle}>Câmera bloqueada</Text>
            <Text style={styles.deniedBody}>
              Sem acesso à câmera não é possível verificar seu documento.
              Libere a permissão nas configurações do aparelho.
            </Text>
            <TouchableOpacity style={styles.deniedBtn} onPress={openSettings}>
              <Text style={styles.deniedBtnText}>Abrir configurações</Text>
            </TouchableOpacity>
          </View>
        )}

        {error && !cameraDenied ? (
          <Text style={styles.error}>{error}</Text>
        ) : null}

        {/* Envio só com as três prontas */}
        {isComplete && (
          <View style={styles.submitCard}>
            <Text style={styles.submitTitle}>Tudo pronto</Text>
            <Text style={styles.submitBody}>
              Confira as três fotos tocando nas etapas acima. Ao enviar,
              nossa equipe analisa e sua conta é liberada.
            </Text>

            {submitting ? (
              <View style={styles.progressWrap}>
                <ActivityIndicator color={colors.gold} />
                <Text style={styles.progressText}>Enviando… {progress}%</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                <Text style={styles.submitBtnText}>Enviar para análise</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>🔒 O que fazemos com suas fotos</Text>
          <Text style={styles.privacyBody}>
            As imagens são vistas apenas pela equipe de moderação e
            APAGADAS depois da análise, aprovada ou não. Guardamos só a
            confirmação de que você é maior de 18 anos. Você tem até{' '}
            {MAX_ATTEMPTS} tentativas.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stepsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayDark,
  },
  stepPill: { alignItems: 'center', gap: spacing.xs },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.grayDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { borderColor: colors.gold },
  stepDotDone: { backgroundColor: colors.success + '33', borderColor: colors.success },
  stepDotText: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  stepLabel: { color: colors.gray, fontSize: fonts.sizes.xs },
  stepLabelActive: { color: colors.gold, fontWeight: 'bold' },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  title: {
    color: colors.white,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  instruction: {
    color: colors.grayLight,
    fontSize: fonts.sizes.md,
    lineHeight: 22,
  },
  tipsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
    padding: spacing.md,
    gap: spacing.xs,
  },
  tip: { color: colors.grayLight, fontSize: fonts.sizes.sm, lineHeight: 20 },
  captureArea: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.gold,
    borderStyle: 'dashed',
    paddingVertical: spacing.xl * 1.5,
    alignItems: 'center',
    gap: spacing.sm,
  },
  captureIcon: { fontSize: 44 },
  captureText: {
    color: colors.gold,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  previewWrap: { gap: spacing.sm },
  preview: {
    width: '100%',
    height: 240,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold + '55',
    resizeMode: 'cover',
  },
  retakeBtn: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.grayDark,
    padding: spacing.sm,
    alignItems: 'center',
  },
  retakeBtnText: { color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  deniedCard: {
    backgroundColor: colors.error + '11',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.md,
    gap: spacing.sm,
  },
  deniedTitle: { color: colors.error, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  deniedBody: { color: colors.grayLight, fontSize: fonts.sizes.sm, lineHeight: 20 },
  deniedBtn: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.sm,
    alignItems: 'center',
  },
  deniedBtnText: { color: colors.error, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  error: { color: colors.error, fontSize: fonts.sizes.sm, textAlign: 'center' },
  submitCard: {
    backgroundColor: colors.gold + '11',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.md,
    gap: spacing.sm,
  },
  submitTitle: { color: colors.gold, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  submitBody: { color: colors.grayLight, fontSize: fonts.sizes.sm, lineHeight: 20 },
  submitBtn: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  submitBtnText: {
    color: colors.background,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  progressWrap: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  progressText: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
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
});
