// ============================================
// LUMINA — BADGES SCREEN v1.0
// src/modules/engagement/screens/BadgesScreen.tsx
//
// FASE 6 — o usuário vê o que possui e escolhe o que usar.
//
// Duas origens convivem na mesma lista:
//   conquista → permanente, ganho jogando
//   loja      → 30 dias, com os dias restantes à vista
//
// Espelha a FramesScreen. Molduras e badges são independentes:
// dá para equipar um de cada ao mesmo tempo.
//
// RESPONSIVO: grid de 3 colunas, 4 a partir de 560px.
// ============================================

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }  from '../../../context/AuthContext';
import { useBadges, OwnedBadge, daysRemaining } from '../hooks/useBadges';
import {
  badgeAppearanceById, badgeMeaningById, Rarity, RARITY_LABEL, RARITY_COLOR,
} from '../../../config/cosmeticsCatalog';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { Badge } from '../../../components/profile/Badge';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;



function BadgeTile({
  badge, equipped, busy, width, onPress,
}: {
  badge:    OwnedBadge;
  equipped: boolean;
  busy:     boolean;
  // DimensionValue: o RN não aceita `string` genérico em width,
  // só number ou template literal de porcentagem.
  width:    `${number}%`;
  onPress:  () => void;
}) {
  const meaning     = badgeMeaningById(badge.id);
  const days        = daysRemaining(badge.expiresAt);
  const rarityColor = RARITY_COLOR[badge.rarity] ?? COLORS.textMuted;
  const expiringSoon = days !== null && days <= 3;

  return (
    <TouchableOpacity
      style={[
        styles.tile,
        { width, borderColor: equipped ? '#44FF88' : rarityColor + '44' },
        equipped && styles.tileEquipped,
      ]}
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.85}
    >
      {equipped && (
        <View style={styles.equippedDot}>
          <Text style={styles.equippedDotText}>✓</Text>
        </View>
      )}

      <View style={styles.badgeBox}>
        {busy
          ? <ActivityIndicator color={COLORS.secondary} size="small" />
          : <Badge appearance={badgeAppearanceById(badge.id, badge.rarity as Rarity)!} size={56} />
        }
      </View>

      <Text style={styles.tileTitle} numberOfLines={1}>{badge.title}</Text>
      <Text style={[styles.tileRarity, { color: rarityColor }]}>
        {RARITY_LABEL[badge.rarity] ?? badge.rarity}
      </Text>
      {/* O significado é o que o usuário está escolhendo declarar
          — sem ele, a tela vira catálogo de enfeites. */}
      {meaning && (
        <Text style={styles.tileMeaning} numberOfLines={2}>{meaning}</Text>
      )}
      <Text style={[
        styles.tileMeta,
        badge.permanent && styles.tileMetaPermanent,
        expiringSoon && styles.tileMetaUrgent,
      ]}>
        {badge.permanent
          ? '✦ Permanente'
          : expiringSoon
            ? `⏳ ${days}d`
            : `${days}d`}
      </Text>
    </TouchableOpacity>
  );
}

export default function BadgesScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const { width }  = useWindowDimensions();
  const { data, loading, error, equipping, equip, refresh } = useBadges(user?.uid);

  const columns   = width >= 560 ? 4 : 3;
  const tileWidth: `${number}%` = columns === 4 ? '23.5%' : '31.5%';

  async function handleEquip(badge: OwnedBadge) {
    if (data?.equippedBadge === badge.id) {
      // Já em uso: tocar remove. Desequipar é o caminho de volta
      // ao visual padrão, e não há outro botão para isso.
      const ok = await equip(null);
      if (!ok) Alert.alert('Erro', 'Não foi possível remover o badge.');
      return;
    }
    const ok = await equip(badge.id);
    if (!ok) Alert.alert('Erro', 'Não foi possível equipar este badge.');
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Meus Badges" showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Meus Badges" showBack={true} showHome={true} />
        <View style={styles.center}>
          <Text style={styles.errorIcon}>✦</Text>
          <Text style={styles.errorTitle}>Não foi possível carregar</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryBtnText}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const owned    = data?.owned   ?? [];
  const expired  = data?.expired ?? [];
  const equippedBadge = owned.find(b => b.id === data?.equippedBadge) ?? null;

  const fromAchievement = owned.filter(b => b.source === 'ACHIEVEMENT');
  const fromShop        = owned.filter(b => b.source === 'SHOP');

  return (
    <View style={styles.container}>
      <Header title="Meus Badges" showBack={true} showHome={true} />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Prévia */}
        <View style={styles.preview}>
          {equippedBadge
            ? <Badge appearance={badgeAppearanceById(equippedBadge.id, equippedBadge.rarity as Rarity)!} size={96} />
            : <View style={styles.previewEmpty}>
                <Text style={styles.previewEmptyIcon}>✦</Text>
              </View>
          }
          <Text style={styles.previewLabel}>
            {equippedBadge ? equippedBadge.title : 'Nenhum badge equipado'}
          </Text>
          {equippedBadge && (
            <Text style={styles.previewHint}>Toque nele abaixo para remover</Text>
          )}
        </View>

        {owned.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✦</Text>
            <Text style={styles.emptyTitle}>Você ainda não tem badges</Text>
            <Text style={styles.emptySub}>
              Badges de conquista são permanentes e se ganham jogando.
              Também há emblemas exclusivos na loja.
            </Text>
            <TouchableOpacity
              style={styles.shopBtn}
              onPress={() => navigation.navigate('BadgesShop' as any)}
            >
              <Text style={styles.shopBtnText}>Ver na loja ›</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {fromAchievement.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>🏆 Conquistados</Text>
                <Text style={styles.sectionSub}>Seus para sempre</Text>
                <View style={styles.grid}>
                  {fromAchievement.map(badge => (
                    <BadgeTile
                      key={badge.id}
                      badge={badge}
                      width={tileWidth}
                      equipped={data?.equippedBadge === badge.id}
                      busy={equipping === badge.id}
                      onPress={() => handleEquip(badge)}
                    />
                  ))}
                </View>
              </>
            )}

            {fromShop.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>💎 Da loja</Text>
                <Text style={styles.sectionSub}>Renove antes de expirar para não perder</Text>
                <View style={styles.grid}>
                  {fromShop.map(badge => (
                    <BadgeTile
                      key={badge.id}
                      badge={badge}
                      width={tileWidth}
                      equipped={data?.equippedBadge === badge.id}
                      busy={equipping === badge.id}
                      onPress={() => handleEquip(badge)}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {expired.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Expirados</Text>
            <Text style={styles.sectionSub}>Adquira de novo para voltar a usar</Text>
            <View style={styles.grid}>
              {expired.map(badge => (
                <View key={badge.id} style={[styles.tile, styles.tileExpired, { width: tileWidth }]}>
                  <View style={styles.badgeBox}>
                    <Badge appearance={badgeAppearanceById(badge.id, badge.rarity as Rarity)!} size={56} dimmed />
                  </View>
                  <Text style={styles.tileTitle} numberOfLines={1}>{badge.title}</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('BadgesShop' as any)}>
                    <Text style={styles.renewText}>Renovar</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        {owned.length > 0 && (
          <TouchableOpacity
            style={styles.shopLink}
            onPress={() => navigation.navigate('BadgesShop' as any)}
          >
            <Text style={styles.shopLinkText}>✦ Ver mais badges na loja ›</Text>
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
  container:         { flex: 1, backgroundColor: COLORS.background },
  center:            { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md, padding: S.xl },
  errorIcon:         { fontSize: 48, color: COLORS.textMuted },
  errorTitle:        { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  retryBtn:          { backgroundColor: COLORS.primary, borderRadius: R.lg, paddingVertical: S.sm, paddingHorizontal: S.xl },
  retryBtnText:      { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  preview:           { alignItems: 'center', paddingVertical: S.xl, gap: S.sm },
  previewEmpty:      { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed' },
  previewEmptyIcon:  { fontSize: 32, color: COLORS.textMuted },
  previewLabel:      { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  previewHint:       { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  sectionTitle:      { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginTop: S.lg, marginBottom: 2 },
  sectionSub:        { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginHorizontal: S.md, marginBottom: S.md },
  grid:              { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', marginHorizontal: S.md, gap: S.sm },
  tile:              { alignItems: 'center', gap: 2, backgroundColor: COLORS.card, borderRadius: R.lg, paddingVertical: S.md, paddingHorizontal: S.xs, borderWidth: 1, marginBottom: S.sm },
  tileEquipped:      { backgroundColor: 'rgba(68,255,136,0.06)' },
  tileExpired:       { opacity: 0.5, borderColor: COLORS.border },
  equippedDot:       { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#44FF88', alignItems: 'center', justifyContent: 'center' },
  equippedDotText:   { color: COLORS.background, fontSize: 11, fontWeight: FONT_WEIGHT.extrabold },
  badgeBox:          { height: 62, justifyContent: 'center' },
  tileTitle:         { color: COLORS.surface, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  tileRarity:        { fontSize: 9, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.5 },
  tileMeaning:       { color: COLORS.premium, fontSize: 9, fontStyle: 'italic', textAlign: 'center', lineHeight: 12, minHeight: 24, marginTop: 2, opacity: 0.85 },
  tileMeta:          { color: COLORS.textMuted, fontSize: 9, marginTop: 2 },
  tileMetaPermanent: { color: '#FFD700' },
  tileMetaUrgent:    { color: '#FF9800', fontWeight: FONT_WEIGHT.bold },
  renewText:         { color: COLORS.secondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, marginTop: 2 },
  empty:             { alignItems: 'center', padding: S.xl, gap: S.sm },
  emptyIcon:         { fontSize: 48, color: COLORS.textMuted },
  emptyTitle:        { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  emptySub:          { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },
  shopBtn:           { backgroundColor: COLORS.primary, borderRadius: R.lg, paddingVertical: S.sm, paddingHorizontal: S.xl, marginTop: S.sm },
  shopBtnText:       { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  shopLink:          { marginHorizontal: S.md, marginTop: S.md, alignItems: 'center', paddingVertical: S.sm },
  shopLinkText:      { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
});