// ============================================
// LUMINA — MEUS INTERESSES
// src/modules/profile/screens/InterestsScreen.tsx
//
// 12/10/2026 — Sintonia v2. A pessoa escolhe de 3 a 10 interesses
// numa lista fechada (src/config/sintonia/interestsCatalog.ts).
// Pedido do Kaio: explicar o funcionamento AO LONGO do preenchimento
// — por isso há o quadro "Como funciona", dicas que mudam conforme a
// escolha avança e a prévia do que os outros vão ver.
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
import {
  INTEREST_GROUPS, interestLabel, sanitizeInterests,
} from '../../../config/sintonia/interestsCatalog';
import {
  MAX_INTERESTS, POINTS_PER_COMMON_INTEREST, SINTONIA_WEIGHTS,
} from '../../../config/sintonia/sintoniaFormula';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const MIN_INTERESTS = 3;

/** Dica que acompanha a escolha. */
function progressTip(count: number): string {
  if (count === 0) return 'Comece pelo que você mais gosta de fazer no tempo livre.';
  if (count < MIN_INTERESTS) {
    const left = MIN_INTERESTS - count;
    return `Mais ${left} ${left === 1 ? 'interesse' : 'interesses'} para salvar. Escolha o que você realmente curte.`;
  }
  if (count < MAX_INTERESTS) {
    return 'Ótimo! Pode salvar ou escolher mais. Quanto mais variados, mais chances de ter algo em comum.';
  }
  return `Você chegou ao máximo de ${MAX_INTERESTS}. Para trocar, toque em um escolhido para tirar.`;
}

export default function InterestsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();

  const [selected, setSelected] = useState<string[]>([]);
  const [initial, setInitial] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showHow, setShowHow] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const profile = await getProfile(user.uid);
      const current = sanitizeInterests(profile?.interests);
      setSelected(current);
      setInitial(current);
      // Quem já tem interesses não precisa ver a explicação aberta.
      setShowHow(current.length === 0);
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
  // 0 é permitido (limpar tudo); entre 1 e 2, não.
  const canSave = changed && !saving && (count === 0 || count >= MIN_INTERESTS);

  function toggle(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_INTERESTS) {
        Alert.alert(
          'Máximo de 10 interesses',
          'Toque em um dos escolhidos para tirar e depois escolha outro.',
        );
        return prev;
      }
      return [...prev, id];
    });
  }

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
        {/* Como funciona — aberto na primeira vez. */}
        <View style={styles.howCard}>
          <TouchableOpacity
            style={styles.howHeader}
            onPress={() => setShowHow(v => !v)}
            accessibilityRole="button"
            accessibilityLabel={showHow ? 'Esconder como funciona' : 'Mostrar como funciona'}
          >
            <Text style={styles.howTitle}>💡 Como funcionam os interesses</Text>
            <Text style={styles.howToggle}>{showHow ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showHow && (
            <View style={styles.howBody}>
              <Text style={styles.howText}>
                <Text style={styles.howStrong}>1. Escolha de {MIN_INTERESTS} a {MAX_INTERESTS}</Text> coisas que
                você curte de verdade: música, rolês, esportes, comida…
              </Text>
              <Text style={styles.howText}>
                <Text style={styles.howStrong}>2. Eles entram na sua Sintonia.</Text> Cada interesse em comum com
                outra pessoa vale {POINTS_PER_COMMON_INTEREST} pontos, até {SINTONIA_WEIGHTS.interesses} — 3 em comum
                já dão o máximo deste bloco.
              </Text>
              <Text style={styles.howText}>
                <Text style={styles.howStrong}>3. Aparecem no seu perfil.</Text> Quem tem algo em comum com você vê
                esses interesses em dourado — um jeito fácil de puxar conversa.
              </Text>
              <Text style={styles.howText}>
                <Text style={styles.howStrong}>4. Muda quando quiser.</Text> Volte aqui pelo seu perfil sempre que
                seus gostos mudarem.
              </Text>
              <Text style={styles.howFine}>
                Não pedimos religião, política, saúde nem sexualidade: são assuntos pessoais que ficam fora da lista.
              </Text>
            </View>
          )}
        </View>

        {/* Progresso + dica do momento. */}
        <View style={styles.progressCard}>
          <Text style={styles.progressCount}>
            {count} de {MAX_INTERESTS} escolhidos
            {count > 0 && count < MIN_INTERESTS ? ` · mínimo ${MIN_INTERESTS}` : ''}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.round((count / MAX_INTERESTS) * 100)}%` as const }]} />
          </View>
          <Text style={styles.progressTip}>{progressTip(count)}</Text>
        </View>

        {INTEREST_GROUPS.map(group => (
          <View key={group.id} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.chips}>
              {group.items.map(item => {
                const on = selected.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => toggle(item.id)}
                    disabled={saving}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled: saving }}
                    accessibilityLabel={item.label}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{on ? '✓ ' : ''}{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* Prévia: como aparece no perfil. */}
        {count > 0 && (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>👁️ Assim aparece no seu perfil</Text>
            <View style={styles.chips}>
              {selected.map(id => (
                <View key={id} style={styles.previewChip}>
                  <Text style={styles.previewChipText}>{interestLabel(id)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
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
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },

  howCard: {
    backgroundColor: colors.gold + '11', borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.gold + '55',
  },
  howHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, minHeight: 44,
  },
  howTitle: { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold', flex: 1 },
  howToggle: { color: colors.gold, fontSize: fonts.sizes.sm },
  howBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  howText: { color: colors.grayLight, fontSize: fonts.sizes.sm, lineHeight: 20 },
  howStrong: { color: colors.white, fontWeight: 'bold' },
  howFine: { color: colors.gray, fontSize: fonts.sizes.xs, lineHeight: 17, marginTop: spacing.xs },

  progressCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.grayDark,
    padding: spacing.md, gap: spacing.sm,
  },
  progressCount: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  progressBar: { height: 6, borderRadius: borderRadius.full, backgroundColor: colors.grayDark, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.gold },
  progressTip: { color: colors.gray, fontSize: fonts.sizes.sm, lineHeight: 19 },

  group: { gap: spacing.sm },
  groupTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.grayDark, backgroundColor: colors.surface, minHeight: 40, justifyContent: 'center',
  },
  chipOn: { borderColor: colors.gold, backgroundColor: colors.gold + '22' },
  chipText: { color: colors.grayLight, fontSize: fonts.sizes.sm },
  chipTextOn: { color: colors.gold, fontWeight: 'bold' },

  previewCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.grayDark,
    padding: spacing.md, gap: spacing.sm,
  },
  previewTitle: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  previewChip: {
    backgroundColor: colors.grayDark, borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  previewChipText: { color: colors.grayLight, fontSize: fonts.sizes.sm },

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
