// ============================================
// LUMINA — MENU LATERAL DO COMPUTADOR
// src/components/web/DesktopSidebar.tsx
//
// Aparece SÓ no computador (AppNavigator passa como tabBar quando
// useBreakpoint().isDesktop; no app isso nunca acontece). Usa as
// mesmas abas, rótulos, ícones e balões do rodapé do celular — nada
// de lista duplicada para manter.
//
// Embaixo, o que faz voltar ao app: cartão da Galáxia Plus, cristais
// e o seu mini-perfil (nível e estágio da Árvore).
// Custo: 1 leitura do próprio perfil por sessão (nome e foto); o XP
// vem da mesma função que o Perfil já usa.
//
// D5: "Curtidas hoje x/150" acima dos cristais (likeQuota: 1 chamada
// ao abrir o site; depois o número vem das próprias curtidas).
// ============================================

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useCoins } from '../../context/CoinsContext';
import { useXP } from '../../modules/engagement/hooks/useXP';
import { getProfile } from '../../modules/profile/services/profileService';
import { SIDEBAR_WIDTH } from '../../utils/breakpoints';
import { useLikeQuota } from '../../services/likeQuota';

interface ItemProps {
  label:   string;
  focused: boolean;
  icon:    React.ReactNode;
  onPress: () => void;
}

function SidebarItem({ label, focused, icon, onPress }: ItemProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={[styles.item, focused && styles.itemActive, hovered && !focused && styles.itemHover]}
    >
      <View style={styles.itemIcon}>{icon}</View>
      <Text style={[styles.itemLabel, focused && styles.itemLabelActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export default function DesktopSidebar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { user }       = useAuth();
  const { wallet }     = useCoins();
  const { status: xp } = useXP(user?.uid);
  const [me, setMe]    = useState<{ name: string; photoURL: string } | null>(null);
  const likeQuota      = useLikeQuota(user?.uid, true);

  useEffect(() => {
    if (!user?.uid) return;
    let alive = true;
    getProfile(user.uid)
      .then(profile => {
        if (alive && profile) setMe({ name: profile.name || 'Você', photoURL: profile.photoURL || '' });
      })
      .catch(error => console.warn('[DesktopSidebar] perfil indisponível:', error));
    return () => { alive = false; };
  }, [user?.uid]);

  function goTab(name: string) {
    navigation.navigate(name);
  }

  const initial = (me?.name?.trim().charAt(0) || '?').toUpperCase();

  return (
    <View style={styles.container} role="navigation" aria-label="Menu principal">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.brand}>
          <Text style={styles.brandMark}>✦</Text>
          <Text style={styles.brandText}>Lumina</Text>
        </View>

        <View style={styles.items}>
          {state.routes.map((route, i) => {
            const { options } = descriptors[route.key];
            const focused = state.index === i;
            const label = typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : (options.title ?? route.name);
            const color = focused ? colors.gold : colors.grayLight;
            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            };
            return (
              <SidebarItem
                key={route.key}
                label={label}
                focused={focused}
                icon={options.tabBarIcon?.({ focused, color, size: 20 })}
                onPress={onPress}
              />
            );
          })}
        </View>

        <View style={styles.footer}>
          <Pressable
            style={styles.plusCard}
            onPress={() => navigation.navigate('GalaxiaPlus')}
            accessibilityRole="button"
            accessibilityLabel="Conhecer a Galáxia Plus"
          >
            <Text style={styles.plusTitle}>Galáxia Plus</Text>
            <Text style={styles.plusText}>Veja quem visitou você e ganhe Turbos todo mês.</Text>
            <View style={styles.plusBtn}><Text style={styles.plusBtnText}>Conhecer</Text></View>
          </Pressable>

          {likeQuota && (
            <View
              style={styles.quota}
              accessibilityLabel={`Curtidas hoje: ${likeQuota.used} de ${likeQuota.limit}`}
            >
              <View style={styles.quotaHead}>
                <Text style={styles.quotaLabel}>♥ Curtidas hoje</Text>
                <Text style={[styles.quotaValue, likeQuota.used >= likeQuota.limit && styles.quotaFull]}>
                  {likeQuota.used}/{likeQuota.limit}
                </Text>
              </View>
              <View style={styles.quotaTrack}>
                <View style={[styles.quotaBar, { width: `${Math.min(100, Math.round((likeQuota.used / likeQuota.limit) * 100))}%` }]} />
              </View>
            </View>
          )}

          <Pressable
            style={styles.crystals}
            onPress={() => goTab('Store')}
            accessibilityRole="button"
            accessibilityLabel={`Cristais: ${wallet?.coinsGratuitos ?? 0} grátis e ${wallet?.coinsPremium ?? 0} premium`}
          >
            <Text style={styles.crystalsFree}>✨ {wallet?.coinsGratuitos ?? 0}</Text>
            <Text style={styles.crystalsSep}>·</Text>
            <Text style={styles.crystalsPremium}>💎 {wallet?.coinsPremium ?? 0}</Text>
          </Pressable>

          <Pressable
            style={styles.me}
            onPress={() => goTab('Profile')}
            accessibilityRole="button"
            accessibilityLabel="Abrir meu perfil"
          >
            {me?.photoURL ? (
              <Image source={{ uri: me.photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <View style={styles.meInfo}>
              <Text style={styles.meName} numberOfLines={1}>{me?.name ?? 'Meu perfil'}</Text>
              <Text style={styles.meLevel} numberOfLines={1}>
                {xp ? `Nível ${xp.level} · ${xp.treeName}` : 'Ver meu perfil'}
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIDEBAR_WIDTH,
    height: '100%',
    backgroundColor: '#141414',
    borderRightWidth: 1,
    borderRightColor: '#2A2A2A',
  },
  scroll: { flexGrow: 1, paddingVertical: spacing.lg, paddingHorizontal: spacing.md, gap: spacing.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm },
  brandMark: { color: colors.gold, fontSize: 22 },
  brandText: { color: colors.gold, fontSize: 22, fontWeight: 'bold', letterSpacing: 3 },
  items: { gap: 4 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
  },
  itemActive: { backgroundColor: colors.goldGlow },
  itemHover:  { backgroundColor: '#1F1F1F' },
  itemIcon:   { width: 28, alignItems: 'center' },
  itemLabel:  { color: colors.grayLight, fontSize: 15, flex: 1 },
  itemLabelActive: { color: colors.gold, fontWeight: 'bold' },
  footer: { marginTop: 'auto', gap: spacing.sm },
  plusCard: {
    padding: spacing.md, borderRadius: borderRadius.md, gap: spacing.xs,
    backgroundColor: '#1F1530', borderWidth: 1, borderColor: '#4A2A7A',
  },
  plusTitle: { color: '#C9A0F5', fontSize: fonts.sizes.md, fontWeight: 'bold' },
  plusText:  { color: colors.textSecondary, fontSize: fonts.sizes.sm, lineHeight: 17 },
  plusBtn:   { alignSelf: 'flex-start', marginTop: 4, paddingVertical: 6, paddingHorizontal: 14, borderRadius: borderRadius.full, backgroundColor: '#7B2FBE' },
  plusBtnText: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  crystals: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: 10, borderRadius: 12, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.goldBorder,
  },
  quota:      { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.surface, gap: 6 },
  quotaHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quotaLabel: { color: colors.grayLight, fontSize: fonts.sizes.sm },
  quotaValue: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  quotaFull:  { color: colors.error },
  quotaTrack: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceOverlay, overflow: 'hidden' },
  quotaBar:   { height: 4, borderRadius: 2, backgroundColor: colors.gold },
  crystalsFree:    { color: '#C9A0F5', fontSize: fonts.sizes.md, fontWeight: 'bold' },
  crystalsSep:     { color: colors.gray },
  crystalsPremium: { color: '#F0D060', fontSize: fonts.sizes.md, fontWeight: 'bold' },
  me: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: 10, borderRadius: 14, backgroundColor: colors.surface,
  },
  avatar:        { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.gold },
  avatarEmpty:   { backgroundColor: colors.surfaceOverlay, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.lg },
  meInfo:  { flex: 1, minWidth: 0, gap: 2 },
  meName:  { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  meLevel: { color: colors.gray, fontSize: fonts.sizes.sm },
});
