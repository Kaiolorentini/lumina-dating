// ============================================
// LUMINA — MEUS INTERESSES
// src/modules/profile/screens/InterestsScreen.tsx
//
// 12/10/2026 — Sintonia v2. A pessoa escolhe de 3 a 10 interesses
// numa lista fechada (src/config/sintonia/interestsCatalog.ts). As
// explicações ao longo do preenchimento vêm do InterestsPicker — o
// mesmo usado no cadastro do perfil.
//
// Grava em users/{uid}.interests (regra valida os ids). O gatilho do
// servidor copia para o perfil público, e a Sintonia passa a contar.
// Aberto pelo próprio perfil ("Escolher meus interesses").
// ============================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../context/AuthContext';
import Header from '../../../components/Header';
import { getProfile, saveProfile } from '../services/profileService';
import { sanitizeInterests } from '../../../config/sintonia/interestsCatalog';
import InterestsPicker, { MIN_INTERESTS, isValidInterestCount } from '../components/InterestsPicker';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function InterestsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();

  const [selected, setSelected] = useState<string[]>([]);
  const [initial, setInitial] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const profile = await getProfile(user.uid);
      const current = sanitizeInterests(profile?.interests);
      setSelected(current);
      setInitial(current);
    } catch (e) {
      console.error('[Interests] load:', e);
      setError('Não foi possível carregar seus interesses.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const count = selected.length;
  const changed = useMemo(
    () => count !== initial.length || selected.some(id => !initial.includes(id)),
    [selected, initial, count],
  );
  const canSave = changed && !saving && isValidInterestCount(count);

  async function save() {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      await saveProfile(user.uid, { interests: selected });
      setInitial(selected);
      Alert.alert(
        '✨ Interesses salvos',
        count > 0
          ? 'Eles já aparecem no seu perfil e entram na sua Sintonia com outras pessoas.'
          : 'Seus interesses foram removidos. Nesse bloco, a Sintonia fica neutra.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      console.error('[Interests] save:', e);
      Alert.alert('Não foi possível salvar', 'Verifique sua conexão e tente de novo.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Meus interesses" showBack showHome />
        <View style={styles.center}><ActivityIndicator color={colors.gold} size="large" /></View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Meus interesses" showBack showHome />
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} accessibilityRole="button">
            <Text style={styles.retryText}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Meus interesses" showBack showHome />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Quem já tem interesses não precisa ver a explicação aberta. */}
        <InterestsPicker
          selected={selected}
          onChange={setSelected}
          disabled={saving}
          explainOpen={initial.length === 0}
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnOff]}
          onPress={save}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
        >
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={[styles.saveText, !canSave && styles.saveTextOff]}>
              {!changed
                ? 'Nada mudou ainda'
                : count > 0 && count < MIN_INTERESTS
                  ? `Escolha pelo menos ${MIN_INTERESTS}`
                  : count === 0 ? 'Salvar sem interesses' : '✨ Salvar interesses'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.grayDark, backgroundColor: colors.surface },
  saveBtn: { backgroundColor: colors.gold, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  saveBtnOff: { backgroundColor: colors.grayDark },
  saveText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
  saveTextOff: { color: colors.gray },
  errorIcon: { fontSize: 44 },
  errorText: { color: colors.error, fontSize: fonts.sizes.md, textAlign: 'center' },
  retryBtn: { backgroundColor: colors.gold, borderRadius: borderRadius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryText: { color: colors.background, fontWeight: 'bold' },
});
