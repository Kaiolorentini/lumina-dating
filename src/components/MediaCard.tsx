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
import { colors, fonts, spacing, borderRadius } from '../theme';
import { MediaItem, unlockMediaItem, isUnlocked } from '../services/mediaService';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.lg * 2 - spacing.sm) / 2;

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
            <ActivityIndicator color={colors.background} size="small" />
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
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
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
    backgroundColor: colors.background + '88',
  },
  lockIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  lockText: {
    color: colors.gold,
    fontSize: fonts.sizes.xs,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  typeBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.background + 'CC',
    borderRadius: borderRadius.full,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadgeText: {
    fontSize: 14,
  },
  uploaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  uploaderAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  uploaderName: {
    color: colors.grayLight,
    fontSize: fonts.sizes.xs,
    flex: 1,
  },
  unlockButton: {
    backgroundColor: colors.gold,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    alignItems: 'center',
  },
  unlockText: {
    color: colors.background,
    fontSize: fonts.sizes.xs,
    fontWeight: 'bold',
  },
  unlockedBadge: {
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    alignItems: 'center',
    backgroundColor: colors.success + '22',
    borderWidth: 1,
    borderColor: colors.success + '44',
  },
  unlockedText: {
    color: colors.success,
    fontSize: fonts.sizes.xs,
    fontWeight: 'bold',
  },
});