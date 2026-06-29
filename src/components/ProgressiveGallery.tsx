// ============================================
// LUMINA — PROGRESSIVE GALLERY v5.1
// src/components/ProgressiveGallery.tsx
//
// CORREÇÕES:
// - wallet.coins → coinsGratuitos + coinsPremium
// - spend(cost, desc) → spend(feature) — REGRA 3B
// - onContentUnlocked restaurado via engagementService
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../theme';
import {
  CONTENT_LEVELS, ContentAccess,
  getContentAccess, unlockLevel3,
  getLockMessage,
} from '../services/progressiveContentService';
import { useCoins }            from '../context/CoinsContext';
import { onContentUnlocked }   from '../services/engagementService';

const { width }    = Dimensions.get('window');
const PHOTO_SIZE   = (width - spacing.lg * 4 - spacing.sm) / 2;

interface Props {
  userId:    string;
  profileId: string;
  sintonia:  number;
  gallery:   string[];
}

function splitGallery(gallery: string[]) {
  return {
    level1: gallery.slice(0, 1),
    level2: gallery.slice(1, 3),
    level3: gallery.slice(3),
  };
}

export default function ProgressiveGallery({ userId, profileId, sintonia, gallery }: Props) {
  const { wallet, spend } = useCoins();
  const [access, setAccess]     = useState<ContentAccess>({ level1: true, level2: false, level3: false });
  const [loading, setLoading]   = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  const { level1, level2, level3 } = splitGallery(gallery);

  useEffect(() => { loadAccess(); }, [sintonia]);

  async function loadAccess() {
    try {
      const result = await getContentAccess(userId, profileId, sintonia);
      setAccess(result);
    } catch (error) {
      console.error('[ProgressiveGallery] Erro ao carregar acesso:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlockLevel3() {
    const cost = CONTENT_LEVELS.LEVEL_3.coinsCost || 100;

    // v5.1: total de cristais disponíveis
    const totalCoins = (wallet?.coinsGratuitos ?? 0) + (wallet?.coinsPremium ?? 0);

    if (totalCoins < cost) {
      Alert.alert(
        '✨ Cristais insuficientes',
        `Você precisa de ${cost} Cristais de Sintonia para desbloquear.\n\nVocê tem ${totalCoins} cristais.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      '👑 Desbloquear conteúdo exclusivo',
      `Usar ${cost} Cristais de Sintonia para desbloquear a galeria exclusiva?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desbloquear',
          onPress: async () => {
            try {
              setUnlocking(true);
              // REGRA 3B: envia feature, não valor
              const success = await spend('REVEAL_VISITORS', `unlock_level3_${userId}_${profileId}`);
              if (success) {
                await unlockLevel3(userId, profileId);
                setAccess(prev => ({ ...prev, level3: true }));
                await onContentUnlocked(userId, profileId, 3);
                Alert.alert('✅ Desbloqueado!', 'Galeria exclusiva liberada!');
              }
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível desbloquear.');
            } finally {
              setUnlocking(false);
            }
          },
        },
      ]
    );
  }

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color={colors.gold} />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* NÍVEL 1 */}
      <LevelHeader level={1} label={CONTENT_LEVELS.LEVEL_1.label} icon={CONTENT_LEVELS.LEVEL_1.icon} unlocked={true} />
      <View style={styles.grid}>
        {level1.map((uri, i) => <PhotoItem key={i} uri={uri} unlocked={true} />)}
      </View>

      {/* NÍVEL 2 */}
      <LevelHeader
        level={2} label={CONTENT_LEVELS.LEVEL_2.label}
        icon={access.level2 ? '⚡' : '🔒'} unlocked={access.level2}
        description={access.level2 ? 'Desbloqueado pela sua Sintonia!' : getLockMessage(2, sintonia)}
      />
      {!access.level2 && <SintoniaProgress current={sintonia} required={CONTENT_LEVELS.LEVEL_2.minSintonia} />}
      <View style={styles.grid}>
        {level2.map((uri, i) => <PhotoItem key={i} uri={uri} unlocked={access.level2} />)}
      </View>

      {/* NÍVEL 3 */}
      <LevelHeader
        level={3} label={CONTENT_LEVELS.LEVEL_3.label}
        icon={access.level3 ? '👑' : '🔒'} unlocked={access.level3}
        description={access.level3 ? 'Conteúdo exclusivo desbloqueado!' : getLockMessage(3, sintonia)}
      />
      <View style={styles.grid}>
        {level3.map((uri, i) => <PhotoItem key={i} uri={uri} unlocked={access.level3} />)}
      </View>

      {!access.level3 && (
        <TouchableOpacity
          style={[styles.unlockButton, sintonia < CONTENT_LEVELS.LEVEL_3.minSintonia && styles.unlockButtonDisabled]}
          onPress={handleUnlockLevel3}
          disabled={unlocking || sintonia < CONTENT_LEVELS.LEVEL_3.minSintonia}
        >
          {unlocking ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <>
              <Text style={styles.unlockButtonIcon}>👑</Text>
              <View style={styles.unlockButtonContent}>
                <Text style={styles.unlockButtonText}>
                  {sintonia < CONTENT_LEVELS.LEVEL_3.minSintonia
                    ? `Precisa de ${CONTENT_LEVELS.LEVEL_3.minSintonia}% de Sintonia`
                    : 'Desbloquear galeria exclusiva'}
                </Text>
                <Text style={styles.unlockButtonSub}>
                  {sintonia < CONTENT_LEVELS.LEVEL_3.minSintonia
                    ? `Sua Sintonia: ${sintonia.toFixed(0)}%`
                    : `✨ ${CONTENT_LEVELS.LEVEL_3.coinsCost} Cristais`}
                </Text>
              </View>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function PhotoItem({ uri, unlocked }: { uri: string; unlocked: boolean }) {
  return (
    <View style={photoStyles.container}>
      <Image source={{ uri }} style={[photoStyles.image, !unlocked && photoStyles.imageBlurred]} blurRadius={unlocked ? 0 : 25} />
      {!unlocked && <View style={photoStyles.overlay}><Text style={photoStyles.lockIcon}>🔒</Text></View>}
    </View>
  );
}

function LevelHeader({ level, label, icon, unlocked, description }: { level: number; label: string; icon: string; unlocked: boolean; description?: string }) {
  return (
    <View style={levelStyles.container}>
      <View style={levelStyles.left}>
        <Text style={levelStyles.icon}>{icon}</Text>
        <View>
          <Text style={levelStyles.label}>Nível {level} — {label}</Text>
          {description && <Text style={[levelStyles.description, { color: unlocked ? colors.success : colors.gray }]}>{description}</Text>}
        </View>
      </View>
      <View style={[levelStyles.badge, { backgroundColor: unlocked ? colors.success + '22' : colors.grayDark }]}>
        <Text style={[levelStyles.badgeText, { color: unlocked ? colors.success : colors.gray }]}>
          {unlocked ? 'Liberado' : 'Bloqueado'}
        </Text>
      </View>
    </View>
  );
}

function SintoniaProgress({ current, required }: { current: number; required: number }) {
  const progress = Math.min(current / required, 1);
  return (
    <View style={progressStyles.container}>
      <View style={progressStyles.barBg}>
        <View style={[progressStyles.barFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={progressStyles.text}>{current.toFixed(0)}% / {required}% necessário</Text>
    </View>
  );
}

const photoStyles = StyleSheet.create({
  container:    { width: PHOTO_SIZE, height: PHOTO_SIZE * 1.2, borderRadius: borderRadius.sm, overflow: 'hidden', position: 'relative' },
  image:        { width: '100%', height: '100%' },
  imageBlurred: { opacity: 0.5 },
  overlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0D0D0D88', alignItems: 'center', justifyContent: 'center' },
  lockIcon:     { fontSize: 28 },
});

const levelStyles = StyleSheet.create({
  container:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, marginTop: spacing.md },
  left:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  icon:        { fontSize: 20 },
  label:       { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  description: { fontSize: fonts.sizes.xs, marginTop: 2 },
  badge:       { borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText:   { fontSize: fonts.sizes.xs, fontWeight: 'bold' },
});

const progressStyles = StyleSheet.create({
  container: { marginBottom: spacing.sm, gap: spacing.xs },
  barBg:     { height: 6, backgroundColor: colors.grayDark, borderRadius: borderRadius.full, overflow: 'hidden' },
  barFill:   { height: '100%', backgroundColor: colors.gold, borderRadius: borderRadius.full },
  text:      { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'right' },
});

const styles = StyleSheet.create({
  container:            { gap: spacing.xs },
  loadingContainer:     { padding: spacing.lg, alignItems: 'center' },
  grid:                 { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  unlockButton:         { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gold, borderRadius: borderRadius.md, padding: spacing.md, gap: spacing.md, marginTop: spacing.sm },
  unlockButtonDisabled: { backgroundColor: colors.grayDark },
  unlockButtonIcon:     { fontSize: 24 },
  unlockButtonContent:  { flex: 1 },
  unlockButtonText:     { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
  unlockButtonSub:      { color: colors.background + 'AA', fontSize: fonts.sizes.xs, marginTop: 2 },
});