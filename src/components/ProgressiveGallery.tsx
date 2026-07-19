// ============================================
// LUMINA — PROGRESSIVE GALLERY v5.4
// src/components/ProgressiveGallery.tsx
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, alpha } from '../theme/tokens';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - SPACING.lg * 4 - SPACING.sm) / 2;

interface LevelData {
  id: string;
  number: number;
  treeIcon: string;
  treeName: string;
  requirementXP: number;
  description: string;
}

const LEVELS_DATA: LevelData[] = [
  { id: 'semente', number: 1, treeIcon: '🌱', treeName: 'Semente', requirementXP: 0, description: 'O início da jornada' },
  { id: 'brotinho', number: 2, treeIcon: '🌿', treeName: 'Brotinho', requirementXP: 100, description: 'Primeiras conexões' },
  { id: 'arvore', number: 3, treeIcon: '🌳', treeName: 'Árvore', requirementXP: 500, description: 'Raízes firmes' },
  { id: 'flor', number: 4, treeIcon: '🌸', treeName: 'Flor', requirementXP: 1500, description: 'Beleza desabrochando' },
  { id: 'fruto', number: 5, treeIcon: '🍎', treeName: 'Fruto', requirementXP: 3000, description: 'Colheita de Sintonia' },
  { id: 'bosque', number: 6, treeIcon: '🌲', treeName: 'Bosque', requirementXP: 6000, description: 'Comunidade crescendo' },
  { id: 'floresta', number: 7, treeIcon: '🌳', treeName: 'Floresta', requirementXP: 10000, description: 'Ecossistema próprio' },
  { id: 'selva', number: 8, treeIcon: '🌴', treeName: 'Selva', requirementXP: 20000, description: 'Vida abundante' },
  { id: 'mundo', number: 9, treeIcon: '🌍', treeName: 'Mundo', requirementXP: 50000, description: 'Impacto global' },
  { id: 'galaxia', number: 10, treeIcon: '🪐', treeName: 'Galáxia', requirementXP: 100000, description: 'Sintonia infinita' },
];

function LevelIcon({ level, size = 28 }: { level: number; size?: number }) {
  const icons = ['🌱', '🌿', '🌳', '🌸', '🍎', '🌲', '🌳', '🌴', '🌍', '🪐'];
  return <Text style={{ fontSize: size }}>{icons[level - 1] ?? '🌱'}</Text>;
}

export default function ProgressiveGallery() {
  const { user } = useAuth();
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userXP, setUserXP] = useState(0);
  const [animatingLevel, setAnimatingLevel] = useState<string | null>(null);
  const scaleAnims = useRef<Record<string, Animated.Value>>({}).current;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    LEVELS_DATA.forEach(l => {
      scaleAnims[l.id] = new Animated.Value(1);
    });
  }, []);

  async function loadData() {
    if (!user) return;
    try {
      // Mock: replace with actual getUnlockedLevels when service exists
      const unlocked: string[] = [];
      const xp = 0;
      setUnlockedIds(unlocked);
      setUserXP(xp);
    } catch (e) {
      console.error('[ProgressiveGallery] Erro:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock(level: LevelData) {
    if (!user || unlockedIds.includes(level.id)) return;
    setAnimatingLevel(level.id);
    try {
      // Mock: replace with actual unlockLevel when service exists
      console.log('[ProgressiveGallery] Unlock:', level.id);
      setUnlockedIds(prev => [...prev, level.id]);
    } catch (e) {
      console.error('[ProgressiveGallery] Erro ao desbloquear:', e);
    } finally {
      setTimeout(() => setAnimatingLevel(null), 1500);
    }
  }

  function renderLevel(level: LevelData, index: number) {
    const unlocked = unlockedIds.includes(level.id);
    const canUnlock = userXP >= level.requirementXP && !unlocked;
    const anim = scaleAnims[level.id];

    return (
      <TouchableOpacity
        key={level.id}
        style={styles.levelCard}
        onPress={() => canUnlock && handleUnlock(level)}
        disabled={!canUnlock}
        activeOpacity={0.9}
      >
        <Animated.View style={[styles.imageWrapper, animatingLevel === level.id && styles.pulseAnim, { transform: [{ scale: anim }] }]}>
          <Image
            source={require('../assets/gallery/placeholder.jpg')}
            style={[styles.image, !unlocked && styles.imageLocked]}
            blurRadius={unlocked ? 0 : 15}
            resizeMode="cover"
          />
          {!unlocked && (
            <View style={styles.lockOverlay}>
              <Text style={styles.lockIcon}>🔒</Text>
            </View>
          )}
          {animatingLevel === level.id && (
            <View style={styles.unlockEffect}>
              <Text style={styles.unlockIcon}>✨</Text>
              <Text style={styles.unlockText}>DESBLOQUEADO!</Text>
            </View>
          )}
        </Animated.View>

        <View style={styles.info}>
          <View style={styles.iconRow}>
            <LevelIcon level={level.number} size={28} />
            <Text style={[styles.treeName, unlocked ? styles.treeNameUnlocked : {}]}>{level.treeIcon} {level.treeName}</Text>
          </View>
          <Text style={[styles.description, unlocked ? styles.descriptionUnlocked : {}]}>{level.description}</Text>
          <View style={styles.bottomRow}>
            {unlocked ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>DESBLOQUEADO</Text>
              </View>
            ) : canUnlock ? (
              <TouchableOpacity style={styles.unlockButton} onPress={() => handleUnlock(level)}>
                <Text style={styles.unlockButtonText}>🔓 Desbloquear</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.badge}>
                <Text style={styles.badgeTextLocked}>XP necessário: {level.requirementXP}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.gold} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.levelCard}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Sua Árvore da Sintonia</Text>
        <Text style={styles.headerXP}>✨ {userXP.toLocaleString()} XP total</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {LEVELS_DATA.map((level, i) => renderLevel(level, i))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  headerLabel: { color: COLORS.gold, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1 },
  headerXP: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  grid: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.sm },
  levelCard: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.2,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  imageWrapper: { width: '100%', height: PHOTO_SIZE * 0.7, position: 'relative' },
  image: { width: '100%', height: '100%' },
  imageLocked: { opacity: 0.4 },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(COLORS.background, 0.53),
  },
  lockIcon: { fontSize: FONT_SIZE.hero },
  unlockEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(COLORS.gold, 0.27),
  },
  unlockIcon: { fontSize: 32 },
  unlockText: { color: COLORS.gold, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, marginTop: 2 },
  pulseAnim: { transform: [{ scale: 1.05 }] },
  info: { padding: SPACING.sm, gap: SPACING.xs },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  treeName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  treeNameUnlocked: { color: COLORS.gold },
  description: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  descriptionUnlocked: { color: COLORS.success },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.xs },
  badge: { backgroundColor: alpha(COLORS.gold, 0.13), borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs / 2, borderWidth: 1, borderColor: COLORS.gold },
  badgeText: { color: COLORS.gold, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  badgeTextLocked: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  unlockButton: { backgroundColor: COLORS.gold, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs / 2 },
  unlockButtonText: { color: COLORS.background, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
});