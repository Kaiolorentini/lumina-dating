// ============================================
// LUMINA — PROFILE SCREEN (src/screens/Profile) v5.1
// src/screens/Profile/ProfileScreen.tsx
//
// CORREÇÃO: wallet.coins → coinsGratuitos + coinsPremium
// Exibe cristais separados na UI
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation }   from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth }  from '../../context/AuthContext';
import { useCoins } from '../../context/CoinsContext';
import { getProfile, saveProfile, uploadProfilePhoto } from '../../services/profileService';
import { UserProfile }       from '../../types';
import { RootStackParamList } from '../../navigation/types';
import Header from '../../components/Header';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { wallet }       = useCoins();
  const navigation       = useNavigation<NavProp>();
  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [loading, setLoading]           = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // v5.1: cristais separados
  const coinsGratuitos = wallet?.coinsGratuitos ?? 0;
  const coinsPremium   = wallet?.coinsPremium   ?? 0;
  const totalCoins     = coinsGratuitos + coinsPremium;

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    if (!user) return;
    try {
      const data = await getProfile(user.uid);
      setProfile(data);
    } catch (error) {
      console.error('[ProfileScreen] Erro ao carregar perfil:', error);
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
    });
    if (!result.canceled && user) {
      try {
        setUploadingPhoto(true);
        const url = await uploadProfilePhoto(user.uid, result.assets[0].uri);
        await saveProfile(user.uid, { photoURL: url });
        setProfile(prev => prev ? { ...prev, photoURL: url } : prev);
      } catch {
        Alert.alert('Erro', 'Não foi possível atualizar a foto.');
      } finally {
        setUploadingPhoto(false);
      }
    }
  }

  async function handleLogout() {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  }

  // v5.1: nível baseado em totalCoins
  function getSintoniaLevel(): string {
    if (totalCoins >= 1000) return '👑 VIP';
    if (totalCoins >= 500)  return '💎 Premium';
    if (totalCoins >= 100)  return '⭐ Membro';
    return '✦ Iniciante';
  }

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color={colors.gold} size="large" />
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Header title="Meu Perfil" showBack={false} showHome={false} />

      <View style={styles.headerBg}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.photoWrapper} onPress={handleChangePhoto} disabled={uploadingPhoto}>
            {uploadingPhoto ? (
              <View style={styles.photoPlaceholder}><ActivityIndicator color={colors.gold} /></View>
            ) : profile?.photoURL ? (
              <Image source={{ uri: profile.photoURL }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoIcon}>👤</Text>
              </View>
            )}
            <View style={styles.photoEditBadge}>
              <Text style={styles.photoEditIcon}>📷</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{profile?.name || 'Usuário'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{getSintoniaLevel()}</Text>
          </View>
        </View>
      </View>

      {/* Stats — v5.1: cristais separados */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>✨ {coinsGratuitos}</Text>
          <Text style={styles.statLabel}>Gratuitos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#FFD700' }]}>💎 {coinsPremium}</Text>
          <Text style={styles.statLabel}>Premium</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile?.age || '--'}</Text>
          <Text style={styles.statLabel}>🎂 Idade</Text>
        </View>
      </View>

      {/* Informações */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>✦ Suas Informações</Text>
        <InfoRow icon="👤" label="Nome"       value={profile?.name || 'Não informado'} />
        <InfoRow icon="📍" label="Cidade"     value={profile?.city ? `${profile.city}, ${profile.state}` : 'Não informada'} />
        <InfoRow icon="🎂" label="Idade"      value={profile?.age ? `${profile.age} anos` : 'Não informada'} />
        <InfoRow icon="💭" label="Bio"        value={profile?.bio || 'Sem bio'} />
        <InfoRow icon="💫" label="Gênero"     value={profile?.gender || 'Não informado'} />
        <InfoRow icon="❤️" label="Interesse em" value={profile?.preferences?.join(', ') || 'Não informado'} />
      </View>

      {/* Configurações */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Configurações</Text>
        <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('ProfileSetup')}>
          <Text style={styles.editButtonIcon}>✏️</Text>
          <Text style={styles.editButtonText}>Editar perfil completo</Text>
          <Text style={styles.editButtonArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Requests')}>
          <Text style={styles.menuItemIcon}>✦</Text>
          <Text style={styles.menuItemText}>Solicitações recebidas</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Blocked')}>
          <Text style={styles.menuItemIcon}>🚫</Text>
          <Text style={styles.menuItemText}>Perfis bloqueados</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemIcon}>🔔</Text>
          <Text style={styles.menuItemText}>Notificações</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemIcon}>💎</Text>
          <Text style={styles.menuItemText}>Galáxia Plus</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.icon}>{icon}</Text>
      <View style={infoStyles.content}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={infoStyles.value} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.grayDark, gap: spacing.md },
  icon:    { fontSize: 20, width: 28, textAlign: 'center' },
  content: { flex: 1 },
  label:   { color: colors.gray, fontSize: fonts.sizes.xs, letterSpacing: 1, marginBottom: 2 },
  value:   { color: colors.white, fontSize: fonts.sizes.md, fontWeight: '500' },
});

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  headerBg:         { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.gold + '44', paddingBottom: spacing.xl },
  headerContent:    { alignItems: 'center', paddingTop: spacing.lg, gap: spacing.sm },
  photoWrapper:     { position: 'relative', marginBottom: spacing.sm },
  photo:            { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: colors.gold },
  photoPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.grayDark, borderWidth: 3, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  photoIcon:        { fontSize: 40 },
  photoEditBadge:   { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.gold, borderRadius: borderRadius.full, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  photoEditIcon:    { fontSize: 14 },
  name:             { color: colors.white, fontSize: fonts.sizes.xxl, fontWeight: 'bold', letterSpacing: 1 },
  email:            { color: colors.gray, fontSize: fonts.sizes.sm },
  levelBadge:       { backgroundColor: colors.gold + '22', borderWidth: 1, borderColor: colors.gold, borderRadius: borderRadius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, marginTop: spacing.xs },
  levelText:        { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold', letterSpacing: 1 },
  statsRow:         { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.md },
  statCard:         { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.grayDark, gap: spacing.xs },
  statValue:        { color: colors.gold, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  statLabel:        { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center' },
  section:          { marginHorizontal: spacing.lg, marginBottom: spacing.lg, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.grayDark },
  sectionTitle:     { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold', letterSpacing: 1, marginBottom: spacing.md },
  editButton:       { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gold + '22', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.gold, marginBottom: spacing.md, gap: spacing.md },
  editButtonIcon:   { fontSize: 20 },
  editButtonText:   { flex: 1, color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  editButtonArrow:  { color: colors.gold, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  menuItem:         { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.grayDark, gap: spacing.md },
  menuItemIcon:     { fontSize: 20, width: 28, textAlign: 'center' },
  menuItemText:     { flex: 1, color: colors.white, fontSize: fonts.sizes.md },
  menuItemArrow:    { color: colors.gray, fontSize: fonts.sizes.xl },
  logoutButton:     { marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.error + '22', borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.error + '44' },
  logoutText:       { color: colors.error, fontSize: fonts.sizes.md, fontWeight: 'bold' },
});