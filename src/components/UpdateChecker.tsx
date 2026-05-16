import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Updates from 'expo-updates';
import { colors, fonts, spacing, borderRadius } from '../theme';

// ============================================
// UPDATE CHECKER
//
// Verifica se há atualização disponível
// e pergunta ao usuário se quer atualizar.
// ============================================

export default function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Só verifica em produção (não no Expo Go / dev)
    if (Platform.OS === 'web' || __DEV__) return;
    checkForUpdate();
  }, []);

  async function checkForUpdate() {
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        console.log('🆕 Atualização disponível!');
        setUpdateAvailable(true);
      }
    } catch (e) {
      console.log('⚠️ Erro ao verificar update:', e);
    } finally {
      setChecked(true);
    }
  }

  async function handleUpdate() {
    try {
      setDownloading(true);
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (e) {
      console.log('⚠️ Erro ao baixar update:', e);
      setDownloading(false);
      setUpdateAvailable(false);
    }
  }

  function handleSkip() {
    setUpdateAvailable(false);
  }

  if (!updateAvailable) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={updateAvailable}
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Ícone */}
          <Text style={styles.icon}>✦</Text>

          {/* Título */}
          <Text style={styles.title}>Nova versão disponível!</Text>

          {/* Descrição */}
          <Text style={styles.description}>
            Uma nova atualização do Lumina está disponível com melhorias e correções.
            Deseja atualizar agora?
          </Text>

          {/* Botões */}
          {downloading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.gold} size="large" />
              <Text style={styles.loadingText}>Baixando atualização...</Text>
            </View>
          ) : (
            <View style={styles.buttons}>
              <TouchableOpacity
                style={styles.updateButton}
                onPress={handleUpdate}
              >
                <Text style={styles.updateButtonText}>
                  Atualizar agora ✦
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
              >
                <Text style={styles.skipButtonText}>
                  Mais tarde
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gold + '44',
    gap: spacing.md,
  },
  icon: {
    fontSize: 48,
    color: colors.gold,
  },
  title: {
    color: colors.white,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1,
  },
  description: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  loadingText: {
    color: colors.gold,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
  },
  buttons: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  updateButton: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
    width: '100%',
    elevation: 4,
  },
  updateButtonText: {
    color: colors.background,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  skipButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  skipButtonText: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
  },
});