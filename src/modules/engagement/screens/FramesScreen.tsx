// ============================================
// LUMINA — MOLDURAS SCREEN v1.0
// src/modules/engagement/screens/FramesScreen.tsx
//
// FASE 5 — o usuário vê o que possui e escolhe o que usar.
//
// Molduras de conquista são permanentes; as da loja valem 30
// dias. A tela mostra os dias restantes para que a renovação
// seja uma decisão informada, não uma surpresa.
// ============================================

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }  from '../../../context/AuthContext';
import { useFrames, OwnedFrame, daysRemaining } from '../hooks/useFrames';
import { useProfile } from '../../profile/hooks/useProfile';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { ProfileFrame } from '../../../components/profile/ProfileFrame';
import { frameAppearanceById } from '../../../config/cosmeticsCatalog';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const RARITY_LABEL: Record<string, string> = {
  RARE:      'Rara',
  EPIC:      'Épica',
  LEGENDARY: 'Lendária',
};

const RARITY_COLOR: Record<string, string> = {
  RARE:      '#56CCF2',
  EPIC:      '#B57BEE',
  LEGENDARY: '#FFD700',
};

function FrameRow({
  frame, equipped, busy, photoURL, onPress,
}: {
  frame:    OwnedFrame;
  equipped: boolean;
  busy:     boolean;
  photoURL: string;
  onPress:  () => void;
}) {
  const days = daysRemaining(frame.expiresAt);
  const rarityColor = RARITY_COLOR[frame.rarity] ?? COLORS.textMuted;

  return (
    <TouchableOpacity
      style={[styles.row, equipped && styles.rowEquipped]}
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.85}
    >
      {/* 88px para ficar acima do corte de 80 do ProfileFrame: a
          lista é onde o usuário compara e decide, e com o anel
          simples todas as molduras pareceriam iguais.
          O appearance vem do catálogo pelo id — montar à mão aqui
          omitia o `scene` e a cena nunca desenhava. */}
      <ProfileFrame
        photoURL={photoURL}
        size={88}
        frame={frameAppearanceById(frame.id)}
      />

      <View style={styles.rowInfo}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle}>{frame.title}</Text>
          <View style={[styles.rarityChip, { borderColor: rarityColor }]}>
            <Text style={[styles.rarityText, { color: rarityColor }]}>
              {RARITY_LABEL[frame.rarity] ?? frame.rarity}
            </Text>
          </View>
        </View>
        <Text style={styles.rowDesc} numberOfLines={1}>{frame.description}</Text>
        <Text style={[styles.rowMeta, frame.permanent && styles.rowMetaPermanent]}>
          {frame.permanent
            ? '✦ Permanente'
            : days !== null && days <= 3
              ? `⏳ Expira em ${days} dia${days === 1 ? '' : 's'}`
              : `${days} dias restantes`}
        </Text>
      </View>

      {busy
        ? <ActivityIndicator color={COLORS.secondary} size="small" />
        : equipped
          ? <Text style={styles.equippedMark}>EM USO</Text>
          : <Text style={styles.rowArrow}>›</Text>
      }
    </TouchableOpacity>
  );
}

export default function FramesScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const { profile } = useProfile();
  const { data, loading, error, equipping, equip, refresh } = useFrames(user?.uid);

  const photoURL = profile?.photoURL ?? '';

  async function handleEquip(frame: OwnedFrame) {
    if (data?.equippedFrame === frame.id) {
      // Já em uso: tocar remove. Desequipar é o caminho de volta
      // ao visual padrão, e não há outro botão para isso.
      const ok = await equip(null);
      if (!ok) Alert.alert('Erro', 'Não foi possível remover a moldura.');
      return;
    }
    const ok = await equip(frame.id);
    if (!ok) Alert.alert('Erro', 'Não foi possível equipar esta moldura.');
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Molduras" showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Molduras" showBack={true} showHome={true} />
        <View style={styles.center}>
          <Text style={styles.errorIcon}>🌌</Text>
          <Text style={styles.errorTitle}>Não foi possível carregar</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryBtnText}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const owned   = data?.owned   ?? [];
  const expired = data?.expired ?? [];

  return (
    <View style={styles.container}>
      <Header title="Molduras" showBack={true} showHome={true} />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Prévia */}
        <View style={styles.preview}>
          <ProfileFrame
            photoURL={photoURL}
            size={140}
            frame={frameAppearanceById(data?.equippedFrame)}
          />
          <Text style={styles.previewLabel}>
            {data?.equippedFrame
              ? owned.find(f => f.id === data.equippedFrame)?.title ?? 'Moldura'
              : 'Sem moldura'}
          </Text>
        </View>

        {owned.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🖼️</Text>
            <Text style={styles.emptyTitle}>Você ainda não tem molduras</Text>
            <Text style={styles.emptySub}>
              Molduras destacam seu perfil. Conquiste algumas jogando ou
              adquira na loja.
            </Text>
            <TouchableOpacity
              style={styles.storeBtn}
              onPress={() => navigation.navigate('Store' as any)}
            >
              <Text style={styles.storeBtnText}>Ver na loja ›</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Suas molduras</Text>
            <View style={styles.list}>
              {owned.map(frame => (
                <FrameRow
                  key={frame.id}
                  frame={frame}
                  photoURL={photoURL}
                  equipped={data?.equippedFrame === frame.id}
                  busy={equipping === frame.id}
                  onPress={() => handleEquip(frame)}
                />
              ))}
            </View>
          </>
        )}

        {expired.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Expiradas</Text>
            <Text style={styles.sectionSub}>Adquira de novo na loja para voltar a usar</Text>
            <View style={styles.list}>
              {expired.map(frame => (
                <View key={frame.id} style={[styles.row, styles.rowExpired]}>
                  {/* Expirada: anel apagado, sem cena. Mostrar a
                      cena de algo que não se pode usar é provocação. */}
                  <ProfileFrame
                    photoURL={photoURL}
                    size={52}
                    frame={{
                      borderColor: COLORS.border,
                      glowColor:   'transparent',
                      borderWidth: frame.borderWidth,
                      animated:    false,
                    }}
                  />
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{frame.title}</Text>
                    <Text style={styles.rowMeta}>Expirada</Text>
                  </View>
                  <TouchableOpacity onPress={() => navigation.navigate('Store' as any)}>
                    <Text style={styles.renewText}>Renovar</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md, padding: S.xl },
  errorIcon:      { fontSize: 56 },
  errorTitle:     { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  retryBtn:       { backgroundColor: COLORS.primary, borderRadius: R.lg, paddingVertical: S.sm, paddingHorizontal: S.xl },
  retryBtnText:   { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  preview:        { alignItems: 'center', paddingVertical: S.xl, gap: S.sm },
  previewLabel:   { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, letterSpacing: 1 },
  sectionTitle:   { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginTop: S.lg, marginBottom: S.xs },
  sectionSub:     { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginHorizontal: S.md, marginBottom: S.sm },
  list:           { marginHorizontal: S.md, gap: S.sm },
  row:            { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: COLORS.border },
  rowEquipped:    { borderColor: '#44FF88', backgroundColor: 'rgba(68,255,136,0.06)' },
  rowExpired:     { opacity: 0.55 },
  rowInfo:        { flex: 1, gap: 2 },
  rowTitleLine:   { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  rowTitle:       { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  rarityChip:     { borderRadius: R.full, borderWidth: 1, paddingHorizontal: S.sm, paddingVertical: 1 },
  rarityText:     { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  rowDesc:        { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  rowMeta:        { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  rowMetaPermanent: { color: '#FFD700' },
  rowArrow:       { color: COLORS.textMuted, fontSize: 24 },
  equippedMark:   { color: '#44FF88', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.extrabold, letterSpacing: 1 },
  renewText:      { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  empty:          { alignItems: 'center', padding: S.xl, gap: S.sm },
  emptyIcon:      { fontSize: 56 },
  emptyTitle:     { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  emptySub:       { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },
  storeBtn:       { backgroundColor: COLORS.primary, borderRadius: R.lg, paddingVertical: S.sm, paddingHorizontal: S.xl, marginTop: S.sm },
  storeBtnText:   { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
});