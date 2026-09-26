// ============================================
// LUMINA — TELA DE TÍTULOS
// src/modules/engagement/screens/TitlesScreen.tsx
//
// Títulos são conquistados, nunca comprados — por isso não há
// loja aqui, só a coleção. Os bloqueados aparecem esmaecidos
// COM a origem visível: saber o que falta para conseguir é o
// que faz querer.
//
// Um título por vez no card. A lista inteira do que a pessoa
// conquistou aparece no perfil dela.
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Header from '../../../components/Header';
import { TitleSeal } from '../../../components/profile/TitleSeal';
import { allTitles, TITLE_RARITY_COLOR, TitleDef } from '../../../config/titlesCatalog';
import { colors, fonts, spacing, borderRadius } from '../../../theme';

// Genéricos em tipos nomeados: httpsCallable< em fim de linha
// é corrompido ao colar.
interface TitlesStatus {
  available:     string[];
  equippedTitle: string | null;
}

interface EquipPayload {
  titleId: string | null;
}

interface EquipResult {
  success:  boolean;
  equipped: string | null;
}

const RARITY_LABEL: Record<string, string> = {
  COMMON:    'Comum',
  RARE:      'Raro',
  EPIC:      'Épico',
  LEGENDARY: 'Lendário',
  MYTHIC:    'Mítico',
};

export default function TitlesScreen() {
  const [available, setAvailable] = useState<string[]>([]);
  const [equipped,  setEquipped]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const fn = httpsCallable<void, TitlesStatus>(
        getFunctions(),
        'getTitlesStatus',
      );
      const result = await fn();
      setAvailable(result.data.available ?? []);
      setEquipped(result.data.equippedTitle ?? null);
    } catch (error) {
      console.error('[TitlesScreen] load:', error);
      Alert.alert('Erro', 'Não foi possível carregar seus títulos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleEquip(titleId: string | null) {
    if (saving) return;
    setSaving(titleId ?? '__none__');

    // Otimista: a escolha responde na hora, a CF confirma depois.
    const previous = equipped;
    setEquipped(titleId);

    try {
      const fn = httpsCallable<EquipPayload, EquipResult>(
        getFunctions(),
        'equipTitle',
      );
      await fn({ titleId });
    } catch (error) {
      setEquipped(previous);
      Alert.alert('Erro', 'Não foi possível equipar este título.');
    } finally {
      setSaving(null);
    }
  }

  const titles = allTitles();
  const owned  = titles.filter(t => available.includes(t.id));
  const locked = titles.filter(t => !available.includes(t.id));

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Títulos" showBack={true} showHome={true} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Títulos" showBack={true} showHome={true} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          O símbolo do título equipado aparece no seu card, ao lado
          da sua foto. Um por vez.
        </Text>

        {/* Nenhum — sempre disponível */}
        <TouchableOpacity
          style={[styles.row, equipped === null && styles.rowActive]}
          onPress={() => handleEquip(null)}
          activeOpacity={0.85}
        >
          <View style={styles.emptySymbol}>
            <Text style={styles.emptyDash}>—</Text>
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Nenhum</Text>
            <Text style={styles.rowSource}>Não exibir título no card</Text>
          </View>
          {equipped === null && <Text style={styles.check}>✓</Text>}
        </TouchableOpacity>

        {owned.length > 0 && (
          <Text style={styles.section}>Conquistados</Text>
        )}

        {owned.map(title => (
          <TitleRow
            key={title.id}
            title={title}
            active={equipped === title.id}
            busy={saving === title.id}
            onPress={() => handleEquip(title.id)}
          />
        ))}

        {owned.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎖️</Text>
            <Text style={styles.emptyTitle}>Nenhum título ainda</Text>
            <Text style={styles.emptySub}>
              Títulos vêm de conquistas e de coleções completas.
            </Text>
          </View>
        )}

        <Text style={styles.section}>A conquistar</Text>

        {locked.map(title => (
          <TitleRow key={title.id} title={title} locked />
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

interface RowProps {
  title:   TitleDef;
  active?: boolean;
  busy?:   boolean;
  locked?: boolean;
  onPress?: () => void;
}

function TitleRow({ title, active, busy, locked, onPress }: RowProps) {
  const rarityColor = TITLE_RARITY_COLOR[title.rarity];

  return (
    <TouchableOpacity
      style={[
        styles.row,
        active && styles.rowActive,
        locked && styles.rowLocked,
      ]}
      onPress={onPress}
      disabled={locked || busy}
      activeOpacity={0.85}
    >
      <View style={[styles.symbolWrap, { borderColor: rarityColor + '55' }]}>
        <TitleSeal title={title} size={30} />
      </View>

      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle}>{title.label}</Text>
        <Text style={[styles.rowRarity, { color: rarityColor }]}>
          {RARITY_LABEL[title.rarity] ?? title.rarity}
        </Text>
        <Text style={styles.rowSource}>{title.source}</Text>
      </View>

      {busy   && <ActivityIndicator color={colors.gold} size="small" />}
      {active && !busy && <Text style={styles.check}>✓</Text>}
      {locked && <Text style={styles.lock}>🔒</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  intro: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    lineHeight: 19,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  section: {
    color: colors.gold,
    fontSize: fonts.sizes.sm,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  rowActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold + '11',
  },
  rowLocked: {
    opacity: 0.45,
  },
  symbolWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  emptySymbol: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.grayDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDash: {
    color: colors.gray,
    fontSize: fonts.sizes.lg,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: {
    color: colors.white,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
  },
  rowRarity: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  rowSource: {
    color: colors.gray,
    fontSize: fonts.sizes.xs,
    lineHeight: 15,
  },
  check: {
    color: colors.gold,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
  },
  lock: { fontSize: 16 },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: { fontSize: 44 },
  emptyTitle: {
    color: colors.white,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
  },
  emptySub: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    textAlign: 'center',
    lineHeight: 19,
  },
});