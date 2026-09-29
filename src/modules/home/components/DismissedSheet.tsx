// ============================================
// LUMINA — PASSADOS HOJE (SEGUNDA CHANCE)
// src/modules/home/components/DismissedSheet.tsx
//
// Lista de quem foi passado no Sintonize nas últimas 24h. Cada
// linha traz de volta por 15 cristais — a confirmação e a cobrança
// ficam na tela, este componente só apresenta.
// ============================================

import React from 'react';
import {
  Modal, View, Text, Image, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { DismissedProfile } from '../../../services/sintonizeService';

interface Props {
  visible:     boolean;
  loading:     boolean;
  profiles:    DismissedProfile[];
  bringingId:  string | null;
  cost:        number;
  onClose:     () => void;
  onBringBack: (profile: DismissedProfile) => void;
}

function formatAgo(ms: number): string {
  const min = Math.max(1, Math.floor((Date.now() - ms) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h}h`;
}

export default function DismissedSheet({
  visible, loading, profiles, bringingId, cost, onClose, onBringBack,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>↺ Passados hoje</Text>
          <Text style={styles.sub}>
            Traga de volta alguém que você passou. Cada um custa {cost} cristais.
            Depois de 24h, a pessoa volta sozinha para a sua fila.
          </Text>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.gold} />
            </View>
          ) : profiles.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.empty}>Ninguém passado nas últimas 24h.</Text>
            </View>
          ) : (
            <FlatList
              data={profiles}
              keyExtractor={p => p.uid}
              style={styles.list}
              renderItem={({ item }) => {
                const busy = bringingId === item.uid;
                return (
                  <View style={styles.row}>
                    {item.photoURL ? (
                      <Image source={{ uri: item.photoURL }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarEmpty]}>
                        <Text style={styles.avatarLetter}>{item.name.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.info}>
                      <Text style={styles.name} numberOfLines={1}>{item.name}, {item.age}</Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {item.sintonia}% de Sintonia · {formatAgo(item.dismissedAt)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.bringBtn, busy && styles.bringBtnBusy]}
                      onPress={() => onBringBack(item)}
                      disabled={bringingId !== null}
                      accessibilityRole="button"
                      accessibilityLabel={`Trazer ${item.name} de volta por ${cost} cristais`}
                    >
                      {busy
                        ? <ActivityIndicator color={colors.background} size="small" />
                        : <Text style={styles.bringText}>↺ {cost} ✨</Text>}
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, maxHeight: '78%' },
  handle:       { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.grayDark, marginVertical: spacing.sm },
  title:        { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  sub:          { color: colors.gray, fontSize: fonts.sizes.sm, lineHeight: 19, marginTop: 4, marginBottom: spacing.md },
  center:       { paddingVertical: spacing.xl, alignItems: 'center' },
  empty:        { color: colors.gray, fontSize: fonts.sizes.md },
  list:         { flexGrow: 0 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.grayDark + '55' },
  avatar:       { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.gold + '66' },
  avatarEmpty:  { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: colors.gold, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  info:         { flex: 1 },
  name:         { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  meta:         { color: colors.gray, fontSize: fonts.sizes.xs, marginTop: 2 },
  bringBtn:     { minWidth: 76, alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.gold },
  bringBtnBusy: { opacity: 0.7 },
  bringText:    { color: colors.background, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  closeBtn:     { alignSelf: 'center', paddingVertical: spacing.md },
  closeText:    { color: colors.gray, fontSize: fonts.sizes.sm },
});