// ============================================
// LUMINA — COSMETIC REVEAL MODAL
// src/components/CosmeticRevealModal.tsx
//
// FASE 8 — comemora uma moldura ou badge recém-concedido.
//
// Serve qualquer concessão do backend: Forja do criador, frames
// de conquista, badges. O que dispara é a flag
// progression.pendingCosmeticReveal, limpa pela CF assim que o
// usuário vê — não por armazenamento local, que não sobrevive a
// reinstalação e não sabe o que o servidor concedeu.
// ============================================

import React from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileFrame }   from './profile/ProfileFrame';
import { Badge }          from './profile/Badge';
import {
  FRAMES, BADGES, frameAppearanceById, badgeAppearanceById,
  RARITY_LABEL, RARITY_COLOR, Rarity,
} from '../config/cosmeticsCatalog';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme/tokens';

interface Props {
  visible:    boolean;
  cosmeticId: string | null;
  photoURL:   string;
  onClose:    () => void;
  onGoToItem: () => void;
}

export default function CosmeticRevealModal({
  visible, cosmeticId, photoURL, onClose, onGoToItem,
}: Props) {
  if (!visible || !cosmeticId) return null;

  const frameDef = FRAMES[cosmeticId];
  const badgeDef = BADGES[cosmeticId];
  const def      = frameDef ?? badgeDef;

  if (!def) return null;

  const isFrame     = !!frameDef;
  const rarityColor = RARITY_COLOR[def.rarity] ?? COLORS.premium;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <LinearGradient
          colors={['#14101F', '#08060F']}
          style={[styles.card, { borderColor: rarityColor + '55' }]}
        >
          <View style={[styles.rarityStrip, { backgroundColor: rarityColor }]} />

          <Text style={styles.kicker}>VOCÊ DESBLOQUEOU</Text>

          <View style={styles.showcase}>
            {isFrame ? (
              <ProfileFrame
                photoURL={photoURL}
                size={200}
                frame={frameAppearanceById(cosmeticId)}
              />
            ) : (
              <Badge
                appearance={badgeAppearanceById(cosmeticId, def.rarity as Rarity)!}
                size={120}
              />
            )}
          </View>

          <Text style={[styles.title, { color: rarityColor }]}>{def.title}</Text>
          <View style={[styles.rarityChip, { borderColor: rarityColor }]}>
            <Text style={[styles.rarityText, { color: rarityColor }]}>
              {RARITY_LABEL[def.rarity] ?? def.rarity}
            </Text>
          </View>

          <Text style={styles.description}>
            {isFrame ? frameDef.description : badgeDef.meaning}
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: rarityColor }]}
            onPress={onGoToItem}
          >
            <Text style={styles.primaryBtnText}>
              {isFrame ? 'Usar agora' : 'Escolher agora'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Depois</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: S.xl },
  card:          { width: '100%', borderRadius: R.xl, paddingTop: S.xl, paddingBottom: S.lg, paddingHorizontal: S.xl, alignItems: 'center', gap: S.sm, borderWidth: 1, overflow: 'hidden' },
  rarityStrip:   { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  kicker:        { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, letterSpacing: 3, fontWeight: FONT_WEIGHT.bold },
  showcase:      { marginVertical: S.md, alignItems: 'center', justifyContent: 'center' },
  title:         { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold, textAlign: 'center' },
  rarityChip:    { borderRadius: R.full, borderWidth: 1, paddingHorizontal: S.md, paddingVertical: 2 },
  rarityText:    { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1 },
  description:   { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20, marginTop: S.xs, paddingHorizontal: S.sm },
  primaryBtn:    { width: '100%', borderRadius: R.lg, paddingVertical: S.md, alignItems: 'center', marginTop: S.md },
  primaryBtnText:{ color: COLORS.background, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extrabold },
  closeBtn:      { paddingVertical: S.sm },
  closeBtnText:  { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
});
