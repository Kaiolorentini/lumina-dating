// ============================================
// LUMINA — CHIP "VOCÊ ESTÁ EM DESTAQUE"
// src/modules/premium/components/ActiveBoostChip.tsx
//
// Topo da Home, só enquanto o impulso durar. Quem pagou vê que
// está funcionando — é o que faz o impulso parecer entregue.
// Toque leva à loja de Impulsos.
// ============================================

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { useMyActiveBoost } from '../hooks/useMyActiveBoost';
import { BOOST_STYLE, BoostIcon, BoostType } from '../../../components/BoostBadge';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

const TEXT: Record<BoostType, string> = {
  impulso:  'Seu Impulso está ativo',
  turbo:    'Você está em destaque em todo o app',
  destaque: 'Você está em destaque na sua cidade',
};

function formatRemaining(ms: number): string {
  const totalMin = Math.max(1, Math.ceil(ms / 60000));
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function ActiveBoostChip({ onPress }: { onPress: () => void }) {
  const { user } = useAuth();
  const boost    = useMyActiveBoost(user?.uid);
  if (!boost) return null;

  const variant   = BOOST_STYLE[boost.type];
  const remaining = formatRemaining(boost.remainingMs);

  return (
    <TouchableOpacity
      style={[styles.chip, { borderColor: variant.color + '88' }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${TEXT[boost.type]}. ${remaining} restantes. Abre os Impulsos.`}
    >
      <BoostIcon type={boost.type} color={variant.color} size={13} />
      <Text style={[styles.text, { color: variant.color }]} numberOfLines={1}>
        {TEXT[boost.type]} · {remaining}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    backgroundColor: 'rgba(10, 10, 20, 0.84)',
    maxWidth: '92%',
  },
  text: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 0.3,
  },
});