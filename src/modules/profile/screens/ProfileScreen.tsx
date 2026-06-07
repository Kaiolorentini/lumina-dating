import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import { useCoins } from '../../../context/CoinsContext';
import { useUserPermissions } from '../../../hooks/useUserPermissions';
import { getProfile, saveProfile } from '../services/profileService';
import { uploadProfilePhoto } from '../services/photoService';
import { UserProfile } from '../../../shared/types';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { wallet } = useCoins();
  const navigation = useNavigation<NavProp>();
  const { role, isAdmin, isSuperAdmin } = useUserPermissions(user?.uid);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const isCreator = role === 'creator';
  const isAdminUser = isAdmin || isSuperAdmin;

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    if (!user) return;
    try {
      const data = await getProfile(user.uid);
      setProfile(data);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos acessar sua galeria.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && user) {
      try {
        setUploadingPhoto(true);
        const asset = result.assets[0];
        const uri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        const url = await uploadProfilePhoto(user.uid, uri);
        await saveProfile(user.uid, { photoURL: url });
        setProfile((prev: UserProfile | null) => prev ? { ...prev, photoURL: url } : prev);
      } catch (error) {
        Alert.alert('Erro', 'Não foi possível atualizar a foto.');
      } finally {
        setUploadingPhoto(false);
      }
    }
  }

  function getSintoniaLevel(): string {
    const coins = wallet?.coins || 0;
    if (coins >= 1000) return '👑 VIP';
    if (coins >= 500) return '💎 Premium';
    if (coins >= 100) return '⭐ Ativo';
    return '🌱 Novo';
  }

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Meu Perfil" showBack={false} />
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Foto e nome */}
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={handleChangePhoto} disabled={uploadingPhoto}>
            <View style={styles.photoContainer}>
              {uploadingPhoto ? (
                <ActivityIndicator color={colors.gold} />
              ) : profile?.photoURL ? (
                <Image source={{ uri: profile.photoURL }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderText}>👤</Text>
                </View>
              )}
              <View style={styles.cameraIcon}>
                <Text style={{ fontSize: 14 }}>📷</Text>
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{profile?.name ?? 'Usuário'}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{getSintoniaLevel()}</Text>
          </View>
          <Text style={styles.coins}>💰 {wallet?.coins ?? 0} moedas</Text>
        </View>

        {/* Informações */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Informações</Text>
          <InfoRow icon="🏙️" label="Cidade" value={profile?.city ? `${profile.city}, ${profile.state}` : 'Não informada'} />
          <InfoRow icon="🎂" label="Idade" value={profile?.age ? `${profile.age} anos` : 'Não informada'} />
          <InfoRow icon="💬" label="Bio" value={profile?.bio || 'Sem bio'} />
          <InfoRow icon="💫" label="Gênero" value={profile?.gender || 'Não informado'} />
          <InfoRow icon="❤️" label="Interesse em" value={profile?.preferences?.join(', ') || 'Não informado'} />
        </View>

        {/* Configurações */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Configurações</Text>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('ProfileSetup')}
          >
            <Text style={styles.editButtonIcon}>✏️</Text>
            <Text style={styles.editButtonText}>Editar perfil completo</Text>
            <Text style={styles.editButtonArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Requests')}
          >
            <Text style={styles.menuItemIcon}>✦</Text>
            <Text style={styles.menuItemText}>Solicitações recebidas</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Blocked')}
          >
            <Text style={styles.menuItemIcon}>🚫</Text>
            <Text style={styles.menuItemText}>Perfis e chats bloqueados</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.menuItemIcon}>🔔</Text>
            <Text style={styles.menuItemText}>Notificações</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={async () => {
              const { registerForPushNotifications } = await import(
                '../../notifications/services/pushService'
              );
              if (user) {
                const token = await registerForPushNotifications(user.uid);
                Alert.alert(
                  token ? 'Notificacoes ativadas!' : 'Erro',
                  token ? `Token: ${token.slice(0, 20)}...` : 'Nao foi possivel ativar'
                );
              }
            }}
          >
            <Text style={styles.menuItemIcon}>🔔</Text>
            <Text style={styles.menuItemText}>Ativar notificacoes push</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemIcon}>💎</Text>
            <Text style={styles.menuItemText}>Plano Premium</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ============================================
            MARKETPLACE — seção baseada em role
        ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛍️ Marketplace</Text>

          {/* Todos os usuários */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('MyPurchases')}
          >
            <Text style={styles.menuItemIcon}>📦</Text>
            <Text style={styles.menuItemText}>Minhas Compras</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('MyFavorites')}
          >
            <Text style={styles.menuItemIcon}>❤️</Text>
            <Text style={styles.menuItemText}>Favoritos</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>

          {/* Apenas usuário comum — pode virar criador */}
          {role === 'user' && (
            <TouchableOpacity
              style={styles.menuItemHighlight}
              onPress={() => navigation.navigate('CreatorRequest')}
            >
              <Text style={styles.menuItemIcon}>🎨</Text>
              <Text style={styles.menuItemTextHighlight}>Ser Criador</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          )}

          {/* Criadores e admins */}
          {(isCreator || isAdminUser) && (
            <>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate('MyProducts')}
              >
                <Text style={styles.menuItemIcon}>📁</Text>
                <Text style={styles.menuItemText}>Meus Produtos</Text>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate('MyEarnings')}
              >
                <Text style={styles.menuItemIcon}>💰</Text>
                <Text style={styles.menuItemText}>Meus Ganhos</Text>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate('PaymentSetup')}
              >
                <Text style={styles.menuItemIcon}>💳</Text>
                <Text style={styles.menuItemText}>Configurar Pagamentos</Text>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Apenas admin/superadmin */}
          {isAdminUser && (
            <TouchableOpacity
              style={styles.menuItemAdmin}
              onPress={() => navigation.navigate('AdminDashboard')}
            >
              <Text style={styles.menuItemIcon}>👑</Text>
              <Text style={styles.menuItemTextAdmin}>Painel Admin</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={async () => {
            if (Platform.OS === 'web') {
              const confirmed = (window as any).confirm('Tem certeza que deseja sair?');
              if (confirmed) {
                try { await logout(); } catch (error) { console.error('Erro ao sair:', error); }
              }
            } else {
              Alert.alert('Sair', 'Tem certeza que deseja sair?', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Sair', style: 'destructive',
                  onPress: async () => {
                    try { await logout(); } catch (error) { console.error('Erro ao sair:', error); }
                  },
                },
              ]);
            }
          }}
        >
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: spacing.xl * 2 },

  // Foto
  photoSection: { alignItems: 'center', paddingVertical: spacing.xl },
  photoContainer: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.gold,
  },
  photo: { width: 100, height: 100, borderRadius: 50 },
  photoPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  photoPlaceholderText: { fontSize: 40 },
  cameraIcon: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: colors.gold, borderRadius: 12, padding: 4,
  },
  name: {
    color: colors.white, fontSize: fonts.sizes.xl,
    fontWeight: 'bold', marginTop: spacing.md,
  },
  levelBadge: {
    backgroundColor: colors.gold + '22', borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.gold,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2,
    marginTop: spacing.xs,
  },
  levelText: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  coins: { color: colors.gray, fontSize: fonts.sizes.sm, marginTop: spacing.xs },

  // Seções
  section: {
    marginHorizontal: spacing.md, marginTop: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark, overflow: 'hidden',
  },
  sectionTitle: {
    color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    textTransform: 'uppercase', letterSpacing: 1,
    borderBottomWidth: 0.5, borderBottomColor: colors.grayDark,
  },

  // InfoRow
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 0.5, borderBottomColor: colors.grayDark + '55',
  },
  infoIcon: { fontSize: 16, marginRight: spacing.sm, marginTop: 2 },
  infoContent: { flex: 1 },
  infoLabel: { color: colors.gray, fontSize: fonts.sizes.xs },
  infoValue: { color: colors.white, fontSize: fonts.sizes.sm, marginTop: 2 },

  // Botões
  editButton: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.grayDark + '55',
    backgroundColor: colors.gold + '11',
  },
  editButtonIcon: { fontSize: 18, marginRight: spacing.sm },
  editButtonText: { flex: 1, color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  editButtonArrow: { color: colors.gold, fontSize: fonts.sizes.xl },

  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.grayDark + '55',
  },
  menuItemHighlight: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.grayDark + '55',
    backgroundColor: colors.gold + '11',
  },
  menuItemAdmin: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.gold + '11',
  },
  menuItemIcon: { fontSize: 18, marginRight: spacing.sm },
  menuItemText: { flex: 1, color: colors.white, fontSize: fonts.sizes.md },
  menuItemTextHighlight: { flex: 1, color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  menuItemTextAdmin: { flex: 1, color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  menuItemArrow: { color: colors.gray, fontSize: fonts.sizes.xl },

  // Logout
  logoutButton: {
    margin: spacing.md, marginTop: spacing.lg,
    backgroundColor: colors.error + '22', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.error,
    padding: spacing.md, alignItems: 'center',
  },
  logoutText: { color: colors.error, fontSize: fonts.sizes.md, fontWeight: 'bold' },
});