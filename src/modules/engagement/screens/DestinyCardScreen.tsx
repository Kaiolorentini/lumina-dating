// ============================================
// LUMINA — CARTA DO DESTINO SCREEN v5.2
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
import { Card, EmptyState } from '../../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, GRADIENTS, SINTONIA_COLORS, SINTONIA_LABELS } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Card do perfil principal (grande)
function PrimaryCard({
  profile,
  onPress,
}: {
  profile: DestinyProfile;
  onPress: () => void;
}) {
  const sintoniaColor = SINTONIA_COLORS[
    profile.sintonia >= 90 ? 'perfect' :
    profile.sintonia >= 80 ? 'high' :
    profile.sintonia >= 70 ? 'good' : 'moderate'
  ];

  return (
    <TouchableOpacity
      style={styles.primaryCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={[GRADIENTS.destinyCard[0], GRADIENTS.destinyCard[1]]}
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
            {SINTONIA_LABELS[
              profile.sintonia >= 90 ? 'perfect' :
              profile.sintonia >= 80 ? 'high' :
              profile.sintonia >= 70 ? 'good' : 'moderate'
            ]}
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
  const sintoniaColor = SINTONIA_COLORS[
    profile.sintonia >= 90 ? 'perfect' :
    profile.sintonia >= 80 ? 'high' :
    profile.sintonia >= 70 ? 'good' : 'moderate'
  ];

  return (
    <Card onPress={onPress} padding={S.md} style={{ flex: 1, minWidth: 140, gap: S.sm }}>
      <Text style={styles.altLabel}>{label}</Text>

      <View style={styles.altContent}>
        <Image
          source={profile.photoURL ? { uri: profile.photoURL } : undefined}
          style={styles.altPhoto}
          defaultSource={{ uri: 'https://randomuser.me/api/portraits/lego/1.jpg' }}
        />
        <View style={styles.altInfo}>
          <Text style={styles.altName}>{profile.name}, {profile.age}</Text>
          {profile.city && <Text style={styles.altCity}>📍 {profile.city}</Text>}
          <View style={[styles.sintoniaMini, { backgroundColor: sintoniaColor }]}>
            <Text style={styles.sintoniaMiniText}>{profile.sintonia}%</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

export default function DestinyCardScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const { data, loading, error } = useDestinyCard(user?.uid);

  useEffect(() => {
    // analytics track
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Carta do Destino" showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      </View>
    );
  }

  if (error || !data?.profiles?.length) {
    return (
      <View style={styles.container}>
        <Header title="Carta do Destino" showBack={true} showHome={true} />
        <EmptyState
          icon="🃏"
          title="Nenhuma carta hoje"
          subtitle="O universo está preparando algo especial..."
        />
      </View>
    );
  }

  const primary = data.profiles[0];
  const alternatives = data.profiles.slice(1, 3);

  return (
    <View style={styles.container}>
      <Header title="Carta do Destino" showBack={true} showHome={true} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Carta Principal */}
        {primary && (
          <PrimaryCard
            profile={primary}
            onPress={() => navigation.navigate('RealProfile', { userId: primary.uid })}
          />
        )}

        {/* Cartas Alternativas */}
        <Text style={styles.sectionTitle}>Alternativas do Destino</Text>
        <View style={styles.altCardsContainer}>
          {alternatives.map((alt, i) => (
            <AlternativeCard
              key={alt.uid}
              profile={alt}
              label={i === 0 ? '✨ Segunda Escolha' : '💫 Terceira Escolha'}
              onPress={() => navigation.navigate('RealProfile', { userId: alt.uid })}
            />
          ))}
        </View>

        {/* Info */}
        <Card
          padding={S.lg}
          style={{ marginHorizontal: S.md, marginBottom: S.lg, borderWidth: 1, borderColor: COLORS.border, gap: S.sm }}
        >
          <Text style={styles.infoTitle}>Como funciona</Text>
          <Text style={styles.infoText}>• O universo seleciona 3 perfis por dia baseados em sua Sintonia</Text>
          <Text style={styles.infoText}>• A Carta Principal tem a maior compatibilidade</Text>
          <Text style={styles.infoText}>• Galáxia Plus vê até 10 cartas por dia</Text>
          <Text style={styles.infoText}>• Cartas renovam à meia-noite</Text>
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Primary Card
  primaryCard: { marginHorizontal: S.md, marginTop: S.md, borderRadius: R.xl, overflow: 'hidden' },
  primaryCardGradient: { padding: S.lg, gap: S.md },
  primaryBadge: { alignSelf: 'flex-start', backgroundColor: COLORS.gold + '22', borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: S.xs, borderWidth: 1, borderColor: COLORS.gold + '44' },
  primaryBadgeText: { color: COLORS.gold, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  primaryPhotoWrapper: { width: 120, height: 120, borderRadius: BORDER_RADIUS.full, alignSelf: 'center', position: 'relative', borderWidth: 3, borderColor: COLORS.gold },
  primaryPhoto: { width: 120, height: 120, borderRadius: BORDER_RADIUS.full },
  photoPlaceholder: { width: 120, height: 120, borderRadius: BORDER_RADIUS.full, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.border },
  photoPlaceholderText: { fontSize: 48 },
  sintoniaRing: { position: 'absolute', bottom: -4, right: -4, width: 32, height: 32, borderRadius: BORDER_RADIUS.full, borderWidth: 3, backgroundColor: COLORS.background },
  primaryName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  primaryCity: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, textAlign: 'center', marginTop: S.xs },
  sintoniaChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: S.xs, marginTop: S.sm },
  sintoniaPercent: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extrabold },
  sintoniaLabel: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  viewProfileBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, marginTop: S.md, paddingVertical: S.md, borderRadius: BORDER_RADIUS.full, borderWidth: 2 },
  viewProfileBtnText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },

  // Alternative Card
  // (altCard + altCardInner removed — now uses <Card>)
  altLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, textTransform: 'uppercase', letterSpacing: 1 },
  altContent: { flexDirection: 'row', gap: S.md, alignItems: 'center' },
  altPhoto: { width: 56, height: 56, borderRadius: BORDER_RADIUS.full, borderWidth: 2, borderColor: COLORS.gold },
  altInfo: { flex: 1, gap: 2 },
  altName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  altCity: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  sintoniaMini: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  sintoniaMiniText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },

  // Section
  sectionTitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginTop: S.lg, marginBottom: S.sm, textTransform: 'uppercase', letterSpacing: 1 },
  altCardsContainer: { flexDirection: 'row', gap: S.md, marginHorizontal: S.md, marginBottom: S.lg },

  // Info Card
  infoTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: S.xs },
  infoText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, lineHeight: 20 },
});