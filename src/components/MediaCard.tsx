import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, alpha } from '../theme/tokens';
import { MediaItem, unlockMediaItem, isUnlocked } from '../services/mediaService';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.lg * 2 - SPACING.sm) / 2;

interface Props {
  item: MediaItem;
  userId: string;
  onUnlock: (item: MediaItem) => void;
}

export default function MediaCard({ item, userId, onUnlock }: Props) {
  const [unlocking, setUnlocking] = useState(false);
  const unlocked = isUnlocked(item, userId);

  async function handleUnlock() {
    try {
      setUnlocking(true);
      await unlockMediaItem(item.id, userId);
      onUnlock(item);
    } catch (error) {
      console.error('Erro ao desbloquear:', error);
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <View style={styles.card}>
      {/* Imagem */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.url }}
          style={[
            styles.image,
            !unlocked && styles.imageBlurred,
          ]}
          blurRadius={unlocked ? 0 : 20}
        />

        {/* Overlay de bloqueado */}
        {!unlocked && (
          <View style={styles.lockedOverlay}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.lockText}>Conteúdo</Text>
            <Text style={styles.lockText}>Exclusivo</Text>
          </View>
        )}

        {/* Badge de tipo */}
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>
            {item.type === 'image' ? '📷' : '🎥'}
          </Text>
        </View>
      </View>

      {/* Info do uploader */}
      <View style={styles.uploaderRow}>
        <Image
          source={{ uri: item.uploaderPhoto }}
          style={styles.uploaderAvatar}
        />
        <Text style={styles.uploaderName} numberOfLines={1}>
          {item.uploaderName}
        </Text>
      </View>

      {/* Botão desbloquear */}
      {!unlocked && (
        <TouchableOpacity
          style={styles.unlockButton}
          onPress={handleUnlock}
          disabled={unlocking}
        >
          {unlocking ? (
            <ActivityIndicator color={COLORS.background} size="small" />
          ) : (
            <Text style={styles.unlockText}>🔓 Desbloquear</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Badge desbloqueado */}
      {unlocked && (
        <View style={styles.unlockedBadge}>
          <Text style={styles.unlockedText}>✅ Desbloqueado</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  imageContainer: {
    width: '100%',
    height: CARD_WIDTH * 1.2,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageBlurred: {
    opacity: 0.4,
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(COLORS.background, 0.53),
  },
  lockIcon: {
    fontSize: FONT_SIZE.hero,
    marginBottom: 4,
  },
  lockText: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 1,
  },
  typeBadge: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: alpha(COLORS.background, 0.8),
    borderRadius: BORDER_RADIUS.full,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadgeText: {
    fontSize: FONT_SIZE.body,
  },
  uploaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  uploaderAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  uploaderName: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    flex: 1,
  },
  unlockButton: {
    backgroundColor: COLORS.gold,
    marginHorizontal: SPACING.sm,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.xs,
    alignItems: 'center',
  },
  unlockText: {
    color: COLORS.background,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
  unlockedBadge: {
    marginHorizontal: SPACING.sm,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.xs,
    alignItems: 'center',
    backgroundColor: alpha(COLORS.success, 0.13),
    borderWidth: 1,
    borderColor: alpha(COLORS.success, 0.27),
  },
  unlockedText: {
    color: COLORS.success,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
});