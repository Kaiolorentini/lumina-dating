// ============================================
// LUMINA — SELETOR DE INTERESSES
// src/modules/profile/components/InterestsPicker.tsx
//
// 12/10/2026 — Sintonia v2. Usado no cadastro/edição do perfil
// (ProfileSetupScreen) e na tela "Meus interesses" (InterestsScreen):
// as duas mostram exatamente as mesmas explicações e regras.
//
// Explicação AO LONGO do preenchimento (pedido do Kaio):
//   • quadro "Como funcionam os interesses" (aberto até a pessoa
//     escolher o primeiro, depois recolhível);
//   • contador + dica que muda conforme a escolha avança;
//   • prévia de como aparece no perfil.
// O componente não grava nada: devolve a lista por onToggle.
// ============================================

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { INTEREST_GROUPS, interestLabel } from '../../../config/sintonia/interestsCatalog';
import {
  MAX_INTERESTS, POINTS_PER_COMMON_INTEREST, SINTONIA_WEIGHTS,
} from '../../../config/sintonia/sintoniaFormula';

/** Mínimo para salvar (0 também vale: sem interesses). */
export const MIN_INTERESTS = 3;

/** true se a quantidade pode ser salva: 0, ou de 3 a 10. */
export function isValidInterestCount(count: number): boolean {
  return count === 0 || (count >= MIN_INTERESTS && count <= MAX_INTERESTS);
}

/** Dica que acompanha a escolha. */
export function interestsProgressTip(count: number): string {
  if (count === 0) return 'Comece pelo que você mais gosta de fazer no tempo livre.';
  if (count < MIN_INTERESTS) {
    const left = MIN_INTERESTS - count;
    return `Mais ${left} ${left === 1 ? 'interesse' : 'interesses'} para valer. Escolha o que você realmente curte.`;
  }
  if (count < MAX_INTERESTS) {
    return 'Ótimo! Pode parar aqui ou escolher mais. Quanto mais variados, mais chances de ter algo em comum.';
  }
  return `Você chegou ao máximo de ${MAX_INTERESTS}. Para trocar, toque em um escolhido para tirar.`;
}

/** Alterna um id respeitando o máximo. Devolve a lista nova (ou a mesma). */
export function toggleInterestId(current: string[], id: string): string[] {
  if (current.includes(id)) return current.filter(x => x !== id);
  if (current.length >= MAX_INTERESTS) {
    Alert.alert(
      `Máximo de ${MAX_INTERESTS} interesses`,
      'Toque em um dos escolhidos para tirar e depois escolha outro.',
    );
    return current;
  }
  return [...current, id];
}

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** Abre o "Como funciona" já expandido. */
  explainOpen?: boolean;
  /** Mostra a prévia "Assim aparece no seu perfil". */
  showPreview?: boolean;
}

export default function InterestsPicker({
  selected, onChange, disabled = false, explainOpen = true, showPreview = true,
}: Props) {
  const [showHow, setShowHow] = useState(explainOpen);
  const count = selected.length;

  return (
    <View style={styles.wrap}>
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
              <Text style={styles.howStrong}>1. Escolha de {MIN_INTERESTS} a {MAX_INTERESTS}</Text> coisas que você
              curte de verdade: música, rolês, esportes, comida…
            </Text>
            <Text style={styles.howText}>
              <Text style={styles.howStrong}>2. Eles entram na sua Sintonia.</Text> Cada interesse em comum com outra
              pessoa vale {POINTS_PER_COMMON_INTEREST} pontos, até {SINTONIA_WEIGHTS.interesses} — 3 em comum já dão o
              máximo deste bloco.
            </Text>
            <Text style={styles.howText}>
              <Text style={styles.howStrong}>3. Aparecem no seu perfil.</Text> Quem tem algo em comum com você vê esses
              interesses em dourado — um jeito fácil de puxar conversa.
            </Text>
            <Text style={styles.howText}>
              <Text style={styles.howStrong}>4. Muda quando quiser,</Text> pelo seu perfil.
            </Text>
            <Text style={styles.howFine}>
              Não pedimos religião, política, saúde nem sexualidade: são assuntos pessoais que ficam fora da lista.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.progressCard}>
        <Text style={styles.progressCount}>
          {count} de {MAX_INTERESTS} escolhidos
          {count > 0 && count < MIN_INTERESTS ? ` · mínimo ${MIN_INTERESTS}` : ''}
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.round((count / MAX_INTERESTS) * 100)}%` as const }]} />
        </View>
        <Text style={styles.progressTip}>{interestsProgressTip(count)}</Text>
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
                  onPress={() => onChange(toggleInterestId(selected, item.id))}
                  disabled={disabled}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled }}
                  accessibilityLabel={item.label}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{on ? '✓ ' : ''}{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {showPreview && count > 0 && (
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
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
});
