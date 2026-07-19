import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation }   from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../theme/tokens';
import { useAuth }  from '../../context/AuthContext';
import { useCoins } from '../../context/CoinsContext';
import { getProfile, saveProfile, uploadProfilePhoto } from '../../services/profileService';
import { UserProfile }       from '../../types';
import { RootStackParamList } from '../../navigation/types';
import Header from '../../components/Header';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Divider } from '../../components/ui/Divider';
import { Badge } from '../../components/ui/Badge';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { wallet }       = useCoins();
  const navigation       = useNavigation<NavProp>();
  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [loading, setLoading]           = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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

  function getSintoniaLevel(): string {
    if (totalCoins >= 1000) return '👑 VIP';
    if (totalCoins >= 500)  return '💎 Premium';
    if (totalCoins >= 100)  return '⭐ Membro';
    return '✦ Iniciante';
  }

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color={COLORS.gold} size="large" />
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Header title="Meu Perfil" showBack={false} showHome={false} />

      <View style={styles.headerBg}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.photoWrapper} onPress={handleChangePhoto} disabled={uploadingPhoto}>
            {uploadingPhoto ? (
              <View style={styles.photoPlaceholder}><ActivityIndicator color={COLORS.gold} /></View>
            ) : (
              <Avatar uri={profile?.photoURL} name={profile?.name} size="xl" style={styles.photo} />
            )}
            <View style={styles.photoEditBadge}>
              <Text style={styles.photoEditIcon}>📷</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{profile?.name || 'Usuário'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <Badge label={getSintoniaLevel()} variant="premium" size="md" style={{ marginTop: SPACING.xs }} />
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Card variant="elevated" padding={SPACING.md} style={styles.statCard}>
          <Text style={styles.statValue}>✨ {coinsGratuitos}</Text>
          <Text style={styles.statLabel}>Gratuitos</Text>
        </Card>
        <Card variant="elevated" padding={SPACING.md} style={styles.statCard}>
          <Text style={[styles.statValue, { color: COLORS.gold }]}>💎 {coinsPremium}</Text>
          <Text style={styles.statLabel}>Premium</Text>
        </Card>
        <Card variant="elevated" padding={SPACING.md} style={styles.statCard}>
          <Text style={styles.statValue}>{profile?.age || '--'}</Text>
          <Text style={styles.statLabel}>🎂 Idade</Text>
        </Card>
      </View>

      {/* Informações */}
      <Card variant="default" padding={SPACING.lg} style={styles.section}>
        <Text style={styles.sectionTitle}>✦ Suas Informações</Text>
        <InfoRow icon="👤" label="Nome"       value={profile?.name || 'Não informado'} />
        <InfoRow icon="📍" label="Cidade"     value={profile?.city ? `${profile.city}, ${profile.state}` : 'Não informada'} />
        <InfoRow icon="🎂" label="Idade"      value={profile?.age ? `${profile.age} anos` : 'Não informada'} />
        <InfoRow icon="💭" label="Bio"        value={profile?.bio || 'Sem bio'} />
        <InfoRow icon="💫" label="Gênero"     value={profile?.gender || 'Não informado'} />
        <InfoRow icon="❤️" label="Interesse em" value={profile?.preferences?.join(', ') || 'Não informado'} />
      </Card>

      {/* Configurações */}
      <Card variant="default" padding={SPACING.lg} style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Configurações</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('ProfileSetup')}>
          <Text style={styles.menuItemIcon}>✏️</Text>
          <Text style={styles.menuItemText}>Editar perfil completo</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>
        <Divider />
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Requests')}>
          <Text style={styles.menuItemIcon}>✦</Text>
          <Text style={styles.menuItemText}>Solicitações recebidas</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>
        <Divider />
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Blocked')}>
          <Text style={styles.menuItemIcon}>🚫</Text>
          <Text style={styles.menuItemText}>Perfis bloqueados</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>
        <Divider />
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemIcon}>🔔</Text>
          <Text style={styles.menuItemText}>Notificações</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>
        <Divider />
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemIcon}>💎</Text>
          <Text style={styles.menuItemText}>Galáxia Plus</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>
      </Card>

      <Button label="Sair da conta" onPress={handleLogout} variant="danger" fullWidth style={{ marginHorizontal: SPACING.lg, marginBottom: SPACING.md }} />
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
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.md },
  icon:    { fontSize: FONT_SIZE.title, width: 28, textAlign: 'center' },
  content: { flex: 1 },
  label:   { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, letterSpacing: 1, marginBottom: 2 },
  value:   { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: '500' },
});

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  headerBg:         { backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.gold + '44', paddingBottom: SPACING.xl },
  headerContent:    { alignItems: 'center', paddingTop: SPACING.lg, gap: SPACING.sm },
  photoWrapper:     { position: 'relative', marginBottom: SPACING.sm },
  photo:            { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.gold },
  photoPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.border, borderWidth: 3, borderColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  photoEditBadge:   { position: 'absolute', bottom: 0, right: 0, backgroundColor: COLORS.gold, borderRadius: BORDER_RADIUS.full, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.surface },
  photoEditIcon:    { fontSize: FONT_SIZE.body },
  name:             { color: COLORS.textPrimary, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1 },
  email:            { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  statsRow:         { flexDirection: 'row', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg, gap: SPACING.md },
  statCard:         { flex: 1, alignItems: 'center', gap: SPACING.xs },
  statValue:        { color: COLORS.gold, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  statLabel:        { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, textAlign: 'center' },
  section:          { marginHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  sectionTitle:     { color: COLORS.gold, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1, marginBottom: SPACING.md },
  menuItem:         { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, gap: SPACING.md },
  menuItemIcon:     { fontSize: FONT_SIZE.title, width: 28, textAlign: 'center' },
  menuItemText:     { flex: 1, color: COLORS.textPrimary, fontSize: FONT_SIZE.body },
  menuItemArrow:    { color: COLORS.textSecondary, fontSize: FONT_SIZE.title },
});
