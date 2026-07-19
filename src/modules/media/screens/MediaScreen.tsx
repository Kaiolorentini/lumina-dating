import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, EmptyState } from '../../../components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../../theme/tokens';
import { useAuth } from '../../../context/AuthContext';
import MediaCard from '../../../components/MediaCard';
import {
  MediaItem,
  getMediaItems,
  uploadMedia,
} from '../../../services/mediaService';
import { getProfile } from '../../profile/services/profileService';
import Header from '../../../components/Header';

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
      Alert.alert('Permissão necessária', 'Precisamos acessar sua galeria.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && user && userProfile) {
      try {
        setUploading(true);
        const asset = result.assets[0];
        const uri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;

        const newItem = await uploadMedia(
          user.uid,
          uri,
          'image',
          userProfile.name || user.email || 'Usuário',
          userProfile.photoURL || '',
          true
        );
        setMediaItems(prev => [newItem, ...prev]);
      } catch (error) {
        Alert.alert('Erro', 'Não foi possível fazer o upload.');
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
          <Button
            label="+ Publicar"
            onPress={handleUpload}
            loading={uploading}
            disabled={uploading}
            variant="ghost"
            style={styles.uploadButton}
            textStyle={uploading ? undefined : { color: COLORS.background, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.caption }}
          />
        }
      />

      <Card padding={SPACING.md} style={styles.banner}>
        <Text style={styles.bannerIcon}>🔒</Text>
        <Text style={styles.bannerText}>
          Conteúdo exclusivo desbloqueável. Publique suas fotos e conecte-se!
        </Text>
      </Card>

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
            <EmptyState
              icon="📸"
              title="Nenhuma mídia ainda"
              subtitle="Seja o primeiro a publicar conteúdo exclusivo!"
              actionLabel="📷 Publicar agora"
              onAction={handleUpload}
            />
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
  container: { flex: 1, backgroundColor: COLORS.background },
  uploadButton: {
    backgroundColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
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
  bannerIcon: { fontSize: FONT_SIZE.title },
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
  loadingText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    gap: SPACING.sm,
  },
  // emptyContainer/Icon/Title/Subtitle/Button removed — uses EmptyState now
});