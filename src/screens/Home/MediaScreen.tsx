import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import MediaCard from '../../components/MediaCard';
import {
  MediaItem,
  getMediaItems,
  uploadMedia,
} from '../../services/mediaService';
import { getProfile } from '../../services/profileService';
import Header from '../../components/Header';

export default function MediaScreen() {
  const { user } = useAuth();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [items, profile] = await Promise.all([
        getMediaItems(),
        user ? getProfile(user.uid) : null,
      ]);
      setMediaItems(items);
      setUserProfile(profile);
    } catch (error) {
      console.error('Erro ao carregar mídia:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function handleUpload() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permissão necessária',
        'Precisamos acessar sua galeria para fazer upload.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && user && userProfile) {
      try {
        setUploading(true);
        const newItem = await uploadMedia(
          user.uid,
          result.assets[0].uri,
          'image',
          userProfile.name || user.email || 'Usuário',
          userProfile.photoURL || 'https://randomuser.me/api/portraits/women/1.jpg',
          true // bloqueado por padrão
        );
        setMediaItems(prev => [newItem, ...prev]);
      } catch (error) {
        console.error('Erro no upload:', error);
        Alert.alert('Erro', 'Não foi possível fazer o upload. Tente novamente.');
      } finally {
        setUploading(false);
      }
    }
  }

  function handleUnlock(unlockedItem: MediaItem) {
    setMediaItems(prev =>
      prev.map(item =>
        item.id === unlockedItem.id
          ? { ...item, unlockedBy: [...item.unlockedBy, user?.uid || ''] }
          : item
      )
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Header
        title="Mídia Exclusiva"
        showBack={false}
        showHome={false}
        rightElement={
          <TouchableOpacity
            style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
            onPress={handleUpload}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <Text style={styles.uploadButtonText}>+ Publicar</Text>
            )}
          </TouchableOpacity>
        }
      />

      {/* Banner informativo */}
      <View style={styles.banner}>
        <Text style={styles.bannerIcon}>🔒</Text>
        <Text style={styles.bannerText}>
          Conteúdo exclusivo desbloqueável. Publique suas fotos e conecte-se!
        </Text>
      </View>

      {/* Grid de mídia */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Carregando mídia...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.gold}
            />
          }
        >
          {mediaItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📸</Text>
              <Text style={styles.emptyTitle}>Nenhuma mídia ainda</Text>
              <Text style={styles.emptySubtitle}>
                Seja o primeiro a publicar conteúdo exclusivo!
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={handleUpload}
              >
                <Text style={styles.emptyButtonText}>📷 Publicar agora</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.grid}>
              {mediaItems.map(item => (
                <MediaCard
                  key={item.id}
                  item={item}
                  userId={user?.uid || ''}
                  onUnlock={handleUnlock}
                />
              ))}
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: fonts.sizes.xl,
    color: colors.gold,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  uploadButton: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 90,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: colors.grayDark,
  },
  uploadButtonText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: fonts.sizes.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold + '44',
    gap: spacing.sm,
  },
  bannerIcon: {
    fontSize: 20,
  },
  bannerText: {
    flex: 1,
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: spacing.md,
  },
  loadingText: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyIcon: {
    fontSize: 60,
  },
  emptyTitle: {
    color: colors.white,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  emptyButtonText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: fonts.sizes.md,
  },
});
