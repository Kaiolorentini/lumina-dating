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
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../theme/tokens';
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
          true
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
              <ActivityIndicator color={COLORS.background} size="small" />
            ) : (
              <Text style={styles.uploadButtonText}>+ Publicar</Text>
            )}
          </TouchableOpacity>
        }
      />

      <View style={styles.banner}>
        <Text style={styles.bannerIcon}>🔒</Text>
        <Text style={styles.bannerText}>
          Conteúdo exclusivo desbloqueável. Publique suas fotos e conecte-se!
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.gold} size="large" />
          <Text style={styles.loadingText}>Carregando mídia...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.gold}
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
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.title,
    color: COLORS.gold,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 2,
  },
  uploadButton: {
    backgroundColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minWidth: 90,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  uploadButtonText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHT.bold,
    fontSize: FONT_SIZE.caption,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gold + '44',
    gap: SPACING.sm,
  },
  bannerIcon: {
    fontSize: FONT_SIZE.title,
  },
  bannerText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.caption,
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: SPACING.md,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.body,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    gap: SPACING.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  emptyIcon: {
    fontSize: 60,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  emptyButtonText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHT.bold,
    fontSize: FONT_SIZE.body,
  },
});
