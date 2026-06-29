// ============================================
// LUMINA — CARTA DO DESTINO SCREEN v5.1
// src/modules/engagement/screens/DestinyCardScreen.tsx
//
// Exibe os 3 perfis mais compatíveis do dia.
// Carta Principal + 2 Alternativas.
// Galáxia Plus: 10 cartas/dia.
// ============================================

import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient }   from 'expo-linear-gradient';
import { useNavigation }    from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }          from '../../../context/AuthContext';
import { useDestinyCard, DestinyProfile } from '../hooks/useDestinyCard';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function getSintoniaColor(sintonia: number): string {
  if (sintonia >= 90) return '#FFD700';
  if (sintonia >= 80) return '#B57BEE';
  if (sintonia >= 70) return '#56CCF2';
  return '#A8E063';
}

function getSintoniaLabel(sintonia: number): string {
  if (sintonia >= 90) return '✦ Sintonia Perfeita';
  if (sintonia >= 80) return '🔥 Alta Sintonia';
  if (sintonia >= 70) return '⚡ Boa Sintonia';
  return '💫 Sintonia Moderada';
}

// Card do perfil principal (grande)
function PrimaryCard({
  profile,
  onPress,
}: {
  profile: DestinyProfile;
  onPress: () => void;
}) {
  const sintoniaColor = getSintoniaColor(profile.sintonia);

  return (
    <TouchableOpacity
      style={styles.primaryCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={['#1A0A2E', '#2D1B4E']}
        style={styles.primaryCardGradient}
      >
        {/* Badge Carta Principal */}
        <View style={styles.primaryBadge}>
          <Text style={styles.primaryBadgeText}>✨ Carta Principal</Text>
        </View>

        {/* Foto */}
        <View style={styles.primaryPhotoWrapper}>
          {profile.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.primaryPhoto} />
          ) : (
            <View style={[styles.primaryPhoto, styles.photoPlaceholder]}>
              <Text style={styles.photoPlaceholderText}>👤</Text>
            </View>
          )}
          {/* Anel de sintonia */}
          <View style={[styles.sintoniaRing, { borderColor: sintoniaColor }]} />
        </View>

        {/* Info */}
        <Text style={styles.primaryName}>
          {profile.name}, {profile.age}
        </Text>
        {profile.city && (
          <Text style={styles.primaryCity}>📍 {profile.city}</Text>
        )}

        {/* Sintonia */}
        <View style={[styles.sintoniaChip, { backgroundColor: sintoniaColor + '22', borderColor: sintoniaColor }]}>
          <Text style={[styles.sintoniaPercent, { color: sintoniaColor }]}>
            {profile.sintonia}%
          </Text>
          <Text style={[styles.sintoniaLabel, { color: sintoniaColor }]}>
            {getSintoniaLabel(profile.sintonia)}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.viewProfileBtn, { borderColor: sintoniaColor }]}
          onPress={onPress}
        >
          <Text style={[styles.viewProfileBtnText, { color: sintoniaColor }]}>
            Ver perfil ›
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Card alternativo (menor)
function AlternativeCard({
  profile,
  label,
  onPress,
}: {
  profile: DestinyProfile;
  label:   string;
  onPress: () => void;
}) {
  const sintoniaColor = getSintoniaColor(profile.sintonia);

  return (
    <TouchableOpacity
      style={styles.altCard}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.altCardInner}>
        <Text style={styles.altLabel}>{label}</Text>

        <View style={styles.altContent}>
          {profile.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.altPhoto} />
          ) : (
            <View style={[styles.altPhoto, styles.photoPlaceholder]}>
              <Text style={{ fontSize: 20 }}>👤</Text>
            </View>
          )}

          <View style={styles.altInfo}>
            <Text style={styles.altName}>{profile.name}, {profile.age}</Text>
            {profile.city && (
              <Text style={styles.altCity}>📍 {profile.city}</Text>
            )}
            <Text style={[styles.altSintonia, { color: sintoniaColor }]}>
              {profile.sintonia}% sintonia
            </Text>
          </View>

          <Text style={[styles.altArrow, { color: sintoniaColor }]}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function DestinyCardScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const { data, loading, error, markViewed } = useDestinyCard(user?.uid);

  // Marca como visualizada ao abrir
  useEffect(() => {
    if (data && !data.fromCache) {
      markViewed();
    }
  }, [data]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Carta do Destino" showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
          <Text style={styles.loadingText}>O universo está consultando os astros...</Text>
        </View>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.container}>
        <Header title="Carta do Destino" showBack={true} showHome={true} />
        <View style={styles.center}>
          <Text style={styles.errorIcon}>🌌</Text>
          <Text style={styles.errorTitle}>
            {error?.includes('Limite')
              ? 'Cartas do dia esgotadas'
              : 'Nenhum perfil compatível hoje'}
          </Text>
          <Text style={styles.errorSub}>
            {error?.includes('Limite')
              ? 'Volte amanhã para novas cartas do destino.'
              : 'Complete seu perfil para encontrar mais compatibilidades.'}
          </Text>
          {!error?.includes('Limite') && (
            <TouchableOpacity
              style={styles.setupBtn}
              onPress={() => navigation.navigate('ProfileSetup')}
            >
              <Text style={styles.setupBtnText}>Completar perfil</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const [primary, ...alternatives] = data.profiles;

  return (
    <View style={styles.container}>
      <Header title="Carta do Destino" showBack={true} showHome={true} />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header info */}
        <LinearGradient colors={['#1A0A2E', '#0D0D1A']} style={styles.headerCard}>
          <Text style={styles.headerIcon}>🃏</Text>
          <Text style={styles.headerTitle}>Sua Carta de Hoje</Text>
          <Text style={styles.headerSub}>
            O universo escolheu {data.profiles.length} perfil{data.profiles.length > 1 ? 'is' : ''} para você
          </Text>

          {/* Contador de cartas */}
          <View style={styles.cartasCounter}>
            <Text style={styles.cartasText}>
              {data.cartasHoje}/{data.maxCartas} carta{data.maxCartas > 1 ? 's' : ''} hoje
            </Text>
            {data.isGalaxiaPlus && (
              <View style={styles.galaxiaBadge}>
                <Text style={styles.galaxiaBadgeText}>💜 Galáxia Plus</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Carta Principal */}
        {primary && (
          <PrimaryCard
            profile={primary}
            onPress={() => navigation.navigate('RealProfile', { userId: primary.uid })}
          />
        )}

        {/* Alternativas */}
        {alternatives.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Alternativas do Destino</Text>
            {alternatives.map((profile, i) => (
              <AlternativeCard
                key={profile.uid}
                profile={profile}
                label={i === 0 ? 'Alternativa A' : 'Alternativa B'}
                onPress={() => navigation.navigate('RealProfile', { userId: profile.uid })}
              />
            ))}
          </>
        )}

        {/* Galáxia Plus CTA */}
        {!data.isGalaxiaPlus && (
          <TouchableOpacity
            style={styles.galaxiaCta}
            onPress={() => navigation.navigate('Store' as any)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#2A0A4E', '#4E1B7E']}
              style={styles.galaxiaCtaInner}
            >
              <Text style={styles.galaxiaCtaIcon}>💜</Text>
              <View style={styles.galaxiaCtaInfo}>
                <Text style={styles.galaxiaCtaTitle}>Galáxia Plus</Text>
                <Text style={styles.galaxiaCtaSub}>
                  10 Cartas do Destino por dia + muito mais
                </Text>
              </View>
              <Text style={styles.galaxiaCtaArrow}>›</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl, gap: S.md },
  loadingText:  { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', fontStyle: 'italic' },
  errorIcon:    { fontSize: 60 },
  errorTitle:   { color: COLORS.surface, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  errorSub:     { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },
  setupBtn:     { backgroundColor: COLORS.primary, borderRadius: R.lg, paddingVertical: S.md, paddingHorizontal: S.xl },
  setupBtnText: { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },

  // Header card
  headerCard:   { margin: S.md, borderRadius: R.xl, padding: S.xl, alignItems: 'center', gap: S.sm, borderWidth: 1, borderColor: 'rgba(181,123,238,0.3)' },
  headerIcon:   { fontSize: 48 },
  headerTitle:  { color: COLORS.surface, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold },
  headerSub:    { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center' },
  cartasCounter: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.xs },
  cartasText:   { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  galaxiaBadge: { backgroundColor: 'rgba(181,123,238,0.2)', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.secondary },
  galaxiaBadgeText: { color: COLORS.secondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },

  // Carta principal
  primaryCard:         { marginHorizontal: S.md, marginBottom: S.md, borderRadius: R.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(181,123,238,0.4)' },
  primaryCardGradient: { padding: S.xl, alignItems: 'center', gap: S.md },
  primaryBadge:        { backgroundColor: 'rgba(181,123,238,0.2)', borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: S.xs, borderWidth: 1, borderColor: COLORS.secondary },
  primaryBadgeText:    { color: COLORS.secondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, textTransform: 'uppercase', letterSpacing: 1 },
  primaryPhotoWrapper: { position: 'relative', width: 120, height: 120 },
  primaryPhoto:        { width: 120, height: 120, borderRadius: 60 },
  sintoniaRing:        { position: 'absolute', top: -4, left: -4, width: 128, height: 128, borderRadius: 64, borderWidth: 3 },
  primaryName:         { color: COLORS.surface, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold },
  primaryCity:         { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  sintoniaChip:        { flexDirection: 'row', alignItems: 'center', gap: S.sm, borderRadius: R.full, paddingHorizontal: S.lg, paddingVertical: S.sm, borderWidth: 1 },
  sintoniaPercent:     { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold },
  sintoniaLabel:       { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  viewProfileBtn:      { borderRadius: R.lg, borderWidth: 1, paddingVertical: S.sm, paddingHorizontal: S.xl },
  viewProfileBtnText:  { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },

  // Alternativas
  sectionTitle: { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginBottom: S.sm },
  altCard:      { marginHorizontal: S.md, marginBottom: S.sm, backgroundColor: COLORS.card, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  altCardInner: { padding: S.md },
  altLabel:     { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 1, marginBottom: S.sm },
  altContent:   { flexDirection: 'row', alignItems: 'center', gap: S.md },
  altPhoto:     { width: 56, height: 56, borderRadius: 28 },
  photoPlaceholder: { backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { fontSize: 32 },
  altInfo:      { flex: 1 },
  altName:      { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  altCity:      { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  altSintonia:  { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginTop: 4 },
  altArrow:     { fontSize: 24, fontWeight: FONT_WEIGHT.bold },

  // Galáxia CTA
  galaxiaCta:      { marginHorizontal: S.md, marginTop: S.md, borderRadius: R.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(181,123,238,0.4)' },
  galaxiaCtaInner: { flexDirection: 'row', alignItems: 'center', padding: S.lg, gap: S.md },
  galaxiaCtaIcon:  { fontSize: 32 },
  galaxiaCtaInfo:  { flex: 1 },
  galaxiaCtaTitle: { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  galaxiaCtaSub:   { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  galaxiaCtaArrow: { color: COLORS.secondary, fontSize: 24, fontWeight: FONT_WEIGHT.bold },
});