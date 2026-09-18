// ============================================
// LUMINA — ACEITE DOS TERMOS
// src/screens/Onboarding/TermsAcceptScreen.tsx
//
// Primeiro passo do onboarding, ANTES do perfil: a LGPD
// pede consentimento antes da coleta, e o perfil já coleta
// foto, idade e cidade.
//
// DOIS checkboxes, não um: os Termos são contrato, mas a
// Política envolve documento de identidade e biometria
// facial, que a LGPD trata como dado sensível e exige
// consentimento ESPECÍFICO E DESTACADO (art. 11). Um
// aceite genérico englobando tudo é frágil se contestado.
//
// O botão só habilita depois de rolar cada aba até o fim E
// marcar as duas caixas: aceite de texto que a pessoa não
// teve chance de ler não é consentimento informado.
// ============================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import ScreenContainer from '../../components/ScreenContainer';
import GateHeader from '../../modules/verification/components/GateHeader';
import { acceptTerms } from '../../modules/verification/services/verificationService';
import { APP_TERMS_VERSION } from '../../config/terms';
import {
  LegalDocument, countPlaceholders, getCurrentLegal,
} from '../../config/legal';

type Tab = 'terms' | 'privacy';

// Tolerância de 40px: em telas altas o onScroll nem sempre
// reporta o fim exato, e travar o botão por 3px de diferença
// deixaria a pessoa presa sem entender o motivo.
const SCROLL_END_SLOP = 40;

function reachedEnd(event: NativeSyntheticEvent<NativeScrollEvent>): boolean {
  const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
  return layoutMeasurement.height + contentOffset.y >= contentSize.height - SCROLL_END_SLOP;
}

interface Props {
  /** Chamado após o aceite ser gravado no servidor. */
  onAccepted: () => void;
}

export default function TermsAcceptScreen({ onAccepted }: Props) {
  const legal = getCurrentLegal();

  const [tab, setTab] = useState<Tab>('terms');
  const [readTerms, setReadTerms] = useState(false);
  const [readPrivacy, setReadPrivacy] = useState(false);
  const [checkTerms, setCheckTerms] = useState(false);
  const [checkPrivacy, setCheckPrivacy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doc: LegalDocument = tab === 'terms' ? legal.terms : legal.privacy;
  const placeholders = countPlaceholders(legal.terms) + countPlaceholders(legal.privacy);

  const canAccept = readTerms && readPrivacy && checkTerms && checkPrivacy;

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!reachedEnd(event)) return;
    if (tab === 'terms') setReadTerms(true);
    else setReadPrivacy(true);
  }

  async function handleAccept() {
    if (!canAccept || saving) return;

    setSaving(true);
    setError(null);
    try {
      await acceptTerms(APP_TERMS_VERSION);
      onAccepted();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível registrar o aceite.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenContainer noTop>
      <GateHeader title="Termos e Privacidade" />

      {/* Aviso de rascunho: enquanto os documentos tiverem
          campos [PREENCHER], o aceite não é prova válida.
          Some sozinho quando draft virar false no index. */}
      {legal.draft && (
        <View style={styles.draftBanner}>
          <Text style={styles.draftText}>
            ⚠️ Documento em elaboração — {placeholders} campos pendentes de preenchimento
          </Text>
        </View>
      )}

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'terms' && styles.tabActive]}
          onPress={() => setTab('terms')}
        >
          <Text style={[styles.tabText, tab === 'terms' && styles.tabTextActive]}>
            Termos de Uso {readTerms ? '✓' : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'privacy' && styles.tabActive]}
          onPress={() => setTab('privacy')}
        >
          <Text style={[styles.tabText, tab === 'privacy' && styles.tabTextActive]}>
            Privacidade {readPrivacy ? '✓' : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.docScroll}
        contentContainerStyle={styles.docContent}
        onScroll={handleScroll}
        scrollEventThrottle={200}
        showsVerticalScrollIndicator
      >
        <Text style={styles.docTitle}>{doc.title}</Text>
        <Text style={styles.docMeta}>
          Versão {doc.version} · Vigência: {doc.effectiveDate}
        </Text>

        {doc.sections.map(section => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            {section.body.map((paragraph, i) => (
              <Text key={i} style={styles.paragraph}>{paragraph}</Text>
            ))}
          </View>
        ))}

        <Text style={styles.docEnd}>— fim do documento —</Text>
      </ScrollView>

      <View style={styles.footer}>
        {/* Consentimentos SEPARADOS. O segundo é o do art. 11:
            documento de identidade e biometria facial. */}
        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setCheckTerms(v => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, checkTerms && styles.checkboxOn]}>
            {checkTerms && <Text style={styles.checkMark}>✓</Text>}
          </View>
          <Text style={styles.checkLabel}>
            Li e aceito os <Text style={styles.checkStrong}>Termos de Uso</Text> e
            declaro ter 18 anos ou mais.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setCheckPrivacy(v => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, checkPrivacy && styles.checkboxOn]}>
            {checkPrivacy && <Text style={styles.checkMark}>✓</Text>}
          </View>
          <Text style={styles.checkLabel}>
            Autorizo o tratamento da <Text style={styles.checkStrong}>foto do meu
            documento e da minha imagem facial</Text> para verificação de idade,
            conforme a Política de Privacidade. As imagens são apagadas após a análise.
          </Text>
        </TouchableOpacity>

        {!readTerms || !readPrivacy ? (
          <Text style={styles.hint}>
            Role as duas abas até o fim para continuar
          </Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.acceptBtn, !canAccept && styles.acceptBtnOff]}
          onPress={handleAccept}
          disabled={!canAccept || saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.acceptBtnText}>Aceitar e continuar</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  draftBanner: {
    backgroundColor: colors.error + '22',
    borderBottomWidth: 1,
    borderBottomColor: colors.error,
    padding: spacing.sm,
  },
  draftText: { color: colors.error, fontSize: fonts.sizes.xs, textAlign: 'center' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.grayDark,
  },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabText: { color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  tabTextActive: { color: colors.gold },
  docScroll: { flex: 1 },
  docContent: { padding: spacing.lg, paddingBottom: spacing.xl },
  docTitle: {
    color: colors.white,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  docMeta: {
    color: colors.gray,
    fontSize: fonts.sizes.xs,
    marginBottom: spacing.lg,
  },
  section: { marginBottom: spacing.lg, gap: spacing.sm },
  sectionHeading: {
    color: colors.gold,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
  },
  paragraph: {
    color: colors.grayLight,
    fontSize: fonts.sizes.sm,
    lineHeight: 21,
    textAlign: 'justify',
  },
  docEnd: {
    color: colors.gray,
    fontSize: fonts.sizes.xs,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.grayDark,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
  },
  checkRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.gray,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOn: { borderColor: colors.gold, backgroundColor: colors.gold },
  checkMark: { color: colors.background, fontSize: 14, fontWeight: 'bold' },
  checkLabel: {
    flex: 1,
    color: colors.grayLight,
    fontSize: fonts.sizes.xs,
    lineHeight: 18,
  },
  checkStrong: { color: colors.white, fontWeight: 'bold' },
  hint: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center' },
  error: { color: colors.error, fontSize: fonts.sizes.sm, textAlign: 'center' },
  acceptBtn: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  acceptBtnOff: { backgroundColor: colors.grayDark },
  acceptBtnText: {
    color: colors.background,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});