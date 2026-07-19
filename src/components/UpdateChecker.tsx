import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, alpha } from '../theme/tokens';

interface Props {
  onFinish?: () => void;
}

export default function UpdateChecker({ onFinish }: Props) {
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    version: string;
    releaseNotes: string;
    mandatory: boolean;
    url: string;
  } | null>(null);

  useEffect(() => {
    checkForUpdate();
  }, []);

  async function checkForUpdate() {
    try {
      // Check for updates via expo-updates or custom endpoint
      // This is a placeholder - implement based on your update strategy
      const hasUpdate = await checkExpoUpdate();
      if (hasUpdate) {
        const info = await getUpdateInfo();
        setUpdateInfo(info);
        setShowUpdate(true);
      }
    } catch (error) {
      console.error('[UpdateChecker] Error:', error);
    }
  }

  async function checkExpoUpdate(): Promise<boolean> {
    // Implement based on expo-updates or your custom update service
    return false;
  }

  async function getUpdateInfo() {
    // Return update info from your service
    return {
      version: '1.0.0',
      releaseNotes: 'Novidades e melhorias',
      mandatory: false,
      url: Platform.OS === 'ios' ? 'https://apps.apple.com/app/id...' : 'https://play.google.com/store/apps/details?id=...',
    };
  }

  function handleUpdate() {
    if (updateInfo?.url) {
      // Open store or trigger expo-updates reload
      Alert.alert(
        'Atualização disponível',
        updateInfo.releaseNotes,
        [
          { text: 'Agora', onPress: () => {
            // Linking.openURL(updateInfo.url);
          }},
          { text: 'Depois', style: 'cancel' },
        ]
      );
    }
  }

  if (!showUpdate) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.icon}>🔄</Text>
          <Text style={styles.title}>Nova atualização disponível</Text>
        </View>
        <Text style={styles.version}>v{updateInfo?.version}</Text>
        <Text style={styles.notes}>{updateInfo?.releaseNotes}</Text>
        {updateInfo?.mandatory && (
          <Text style={styles.mandatory}>Esta atualização é obrigatória</Text>
        )}
        <TouchableOpacity style={styles.button} onPress={handleUpdate}>
          <Text style={styles.buttonText}>Atualizar agora</Text>
        </TouchableOpacity>
        {!updateInfo?.mandatory && (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowUpdate(false)}>
            <Text style={styles.secondaryButtonText}>Talvez depois</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: alpha(COLORS.background, 0.8),
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  container: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    maxWidth: 320,
    width: '100%',
    borderWidth: 1,
    borderColor: alpha(COLORS.gold, 0.27),
    gap: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  icon: { fontSize: 32 },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
    flex: 1,
  },
  version: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
  },
  notes: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  mandatory: {
    color: COLORS.error,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.background,
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.bold,
  },
  secondaryButton: {
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.bold,
  },
});