// ============================================
// LUMINA — CONTRATO DO CRIADOR
// src/screens/marketplace/CreatorAgreementScreen.tsx
//
// 12/10/2026. Aberta antes do primeiro produto (CreateProduct manda
// para cá quando o contrato vigente não foi aceito) e de novo quando
// a versão do contrato muda.
//
// Como no aceite dos Termos: o botão só libera depois de ROLAR o
// texto até o fim e MARCAR a caixa — aceite de texto que a pessoa não
// teve chance de ler não é consentimento informado. O aceite é gravado
// pelo servidor (acceptCreatorContract) com versão, hash do texto,
// versão do app e data.
// ============================================

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import ScreenContainer from '../../components/ScreenContainer';
import {
  CREATOR_CONTRACT_SECTIONS, CREATOR_CONTRACT_TITLE, CREATOR_CONTRACT_VERSION,
} from '../../config/legal/creatorAgreement';
import {
  acceptCreatorContract, agreementErrorMessage, hasAcceptedCurrentContract,
} from '../../services/marketplace/creatorAgreementService';

type NavProp    = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'CreatorAgreement'>;

// Mesma tolerância da tela de Termos.
const SCROLL_END_SLOP = 40;

function reachedEnd(event: NativeSyntheticEvent<NativeScrollEvent>): boolean {
  const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
  return layoutMeasurement.height + contentOffset.y >= contentSize.height - SCROLL_END_SLOP;
}

export default function CreatorAgreementScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteProps>();
  const { user } = useAuth();

  const [checking, setChecking] = useState(true);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  const [readToEnd, setReadToEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewHeight, setViewHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  // Tela grande (tablet): o texto inteiro cabe e não há rolagem —
  // sem isto o botão nunca liberaria.
  useEffect(() => {
    if (viewHeight > 0 && contentHeight > 0 && contentHeight <= viewHeight + SCROLL_END_SLOP) setReadToEnd(true);
  }, [viewHeight, contentHeight]);

  // Quem já aceitou a versão vigente vê o contrato só para consulta.
  useEffect(() => {
    let active = true;
    if (!user) { setChecking(false); return; }
    hasAcceptedCurrentContract(user.uid)
      .then(ok => { if (active) setAlreadyAccepted(ok); })
      .catch(() => { /* sem leitura: mostra o aceite; o servidor é idempotente */ })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [user]);

  function continueAfterAccept() {
    if (params?.next === 'CreateProduct') navigation.replace('CreateProduct');
    else navigation.goBack();
  }

  async function handleAccept() {
    if (!readToEnd || !checked || saving) return;
    setSaving(true);
    setError(null);
    try {
      await acceptCreatorContract();
      continueAfterAccept();
    } catch (e) {
      setError(agreementErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const canAccept = readToEnd && checked && !saving;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <Text style={styles.headerBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Contrato do Criador</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('MainTabs')}
          accessibilityRole="button"
          accessibilityLabel="Ir para o início"
        >
          <Text style={styles.headerHome}>🏠</Text>
        </TouchableOpacity>
      </View>

      {!alreadyAccepted && (
        <View style={styles.intro}>
          <Text style={styles.introText}>
            Antes do seu primeiro produto, leia e aceite o contrato. Ele vale para todos os seus produtos;
            se mudar, pedimos um novo aceite.
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.doc}
        contentContainerStyle={styles.docContent}
        onScroll={e => { if (!readToEnd && reachedEnd(e)) setReadToEnd(true); }}
        onLayout={e => setViewHeight(e.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => setContentHeight(h)}
        scrollEventThrottle={200}
        showsVerticalScrollIndicator
      >
        <Text style={styles.docTitle}>{CREATOR_CONTRACT_TITLE}</Text>
        <Text style={styles.docMeta}>Versão {CREATOR_CONTRACT_VERSION}</Text>
        {CREATOR_CONTRACT_SECTIONS.map(section => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            {section.paragraphs.map((paragraph, i) => (
              <Text key={i} style={styles.paragraph}>{paragraph}</Text>
            ))}
          </View>
        ))}
        <Text style={styles.docEnd}>— fim do contrato —</Text>
      </ScrollView>

      <View style={styles.footer}>
        {checking ? (
          <ActivityIndicator color={colors.gold} />
        ) : alreadyAccepted ? (
          <>
            <Text style={styles.acceptedText}>✅ Você já aceitou esta versão do contrato.</Text>
            <TouchableOpacity style={styles.acceptBtn} onPress={continueAfterAccept} accessibilityRole="button">
              <Text style={styles.acceptText}>{params?.next === 'CreateProduct' ? 'Continuar' : 'Voltar'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setChecked(v => !v)}
              disabled={saving}
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled: saving }}
            >
              <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                {checked && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>
                Li e aceito o <Text style={styles.checkStrong}>Contrato do Criador</Text>. Declaro que só eu apareço
                nos meus conteúdos e que tenho todos os direitos sobre eles.
              </Text>
            </TouchableOpacity>

            {!readToEnd && <Text style={styles.hint}>Role o contrato até o fim para continuar</Text>}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.acceptBtn, !canAccept && styles.acceptBtnOff]}
              onPress={handleAccept}
              disabled={!canAccept}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canAccept }}
            >
              {saving
                ? <ActivityIndicator color={colors.background} />
                : <Text style={styles.acceptText}>Aceitar e continuar</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  headerBtn: { color: colors.gold, fontSize: 28, width: 40 },
  headerHome: { fontSize: 22, width: 40, textAlign: 'right' },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  intro: { padding: spacing.md, backgroundColor: colors.gold + '11' },
  introText: { color: colors.gold, fontSize: fonts.sizes.sm, textAlign: 'center', lineHeight: 19 },
  doc: { flex: 1 },
  docContent: { padding: spacing.lg, paddingBottom: spacing.xl },
  docTitle: { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold', marginBottom: spacing.xs },
  docMeta: { color: colors.gray, fontSize: fonts.sizes.xs, marginBottom: spacing.lg },
  section: { marginBottom: spacing.lg, gap: spacing.sm },
  sectionHeading: { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  paragraph: { color: colors.grayLight, fontSize: fonts.sizes.sm, lineHeight: 21 },
  docEnd: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center', marginTop: spacing.lg },
  footer: {
    borderTopWidth: 1, borderTopColor: colors.grayDark, backgroundColor: colors.surface,
    padding: spacing.md, gap: spacing.md,
  },
  acceptedText: { color: colors.success, fontSize: fonts.sizes.sm, textAlign: 'center', fontWeight: 'bold' },
  checkRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: colors.gray,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkboxOn: { borderColor: colors.gold, backgroundColor: colors.gold },
  checkMark: { color: colors.background, fontSize: 14, fontWeight: 'bold' },
  checkLabel: { flex: 1, color: colors.grayLight, fontSize: fonts.sizes.xs, lineHeight: 18 },
  checkStrong: { color: colors.white, fontWeight: 'bold' },
  hint: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center' },
  error: { color: colors.error, fontSize: fonts.sizes.sm, textAlign: 'center' },
  acceptBtn: { backgroundColor: colors.gold, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' },
  acceptBtnOff: { backgroundColor: colors.grayDark },
  acceptText: { color: colors.background, fontSize: fonts.sizes.md, fontWeight: 'bold', letterSpacing: 1 },
});
