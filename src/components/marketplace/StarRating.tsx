// ============================================
// LUMINA — STAR RATING
// src/components/marketplace/StarRating.tsx
//
// Duas formas:
//   • exibição — <StarRating value={4.6} size={14} />
//     arredonda para meia estrela visualmente (★★★★½ vira 4
//     cheias + 1 meia, desenhada sobrepondo uma estrela dourada
//     recortada pela metade sobre uma vazia);
//   • escolha — <StarRating value={n} onChange={setN} size={36} />
//     cada estrela é um botão com rótulo para leitor de tela.
// Sem biblioteca: só Text "★", que renderiza igual em Android e iOS.
// ============================================

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MP } from '../../theme/marketplace';

interface Props {
  /** 0 a 5. Na escolha, 0 = nada escolhido ainda. */
  value: number;
  size?: number;
  /** Com onChange, as estrelas viram botões. */
  onChange?: (rating: 1 | 2 | 3 | 4 | 5) => void;
  disabled?: boolean;
}

const STARS = [1, 2, 3, 4, 5] as const;
const EMPTY_COLOR = 'rgba(255, 255, 255, 0.22)';

export const RATING_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Ruim',
  2: 'Razoável',
  3: 'Bom',
  4: 'Muito bom',
  5: 'Excelente',
};

function StarRatingBase({ value, size = 16, onChange, disabled }: Props) {
  const safe = Number.isFinite(value) ? Math.min(5, Math.max(0, value)) : 0;

  if (onChange) {
    return (
      <View style={styles.row} accessibilityLabel={`Nota escolhida: ${safe} de 5`}>
        {STARS.map(star => {
          const filled = star <= safe;
          return (
            <TouchableOpacity
              key={star}
              onPress={() => onChange(star)}
              disabled={disabled}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`${star} ${star === 1 ? 'estrela' : 'estrelas'}, ${RATING_LABELS[star]}`}
              accessibilityState={{ selected: filled, disabled: !!disabled }}
              style={styles.touch}
            >
              <Text style={[styles.star, { fontSize: size, color: filled ? MP.gold : EMPTY_COLOR }]}>★</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // Exibição: meia estrela a partir de .25, cheia a partir de .75.
  const rounded = Math.round(safe * 2) / 2;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Nota ${safe.toFixed(1).replace('.', ',')} de 5`}
    >
      {STARS.map(star => {
        const full = star <= rounded;
        const half = !full && star - 0.5 === rounded;
        return (
          <View key={star} style={{ width: size * 0.95, height: size * 1.2 }}>
            <Text style={[styles.star, styles.abs, { fontSize: size, color: full ? MP.gold : EMPTY_COLOR }]}>★</Text>
            {half && (
              <View style={[styles.abs, styles.halfClip, { width: (size * 0.95) / 2, height: size * 1.2 }]}>
                <Text style={[styles.star, { fontSize: size, color: MP.gold }]}>★</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export const StarRating = memo(StarRatingBase);
export default StarRating;

const styles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center' },
  touch:    { paddingHorizontal: 3 },
  star:     { includeFontPadding: false },
  abs:      { position: 'absolute', left: 0, top: 0 },
  halfClip: { overflow: 'hidden' },
});
