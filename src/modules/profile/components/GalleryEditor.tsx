// ============================================
// LUMINA — MINHAS FOTOS (galeria do perfil)
// src/modules/profile/components/GalleryEditor.tsx
//
// 3 vagas além da foto de perfil. Antes da PRIMEIRA foto, as regras
// com "Li e concordo" (lembrado no aparelho). Vazia: adicionar.
// Com foto: Ver, Trocar ou Remover (com confirmação).
// Cada foto é reduzida para 1080 px antes do envio.
// ============================================

import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import {
  GALLERY_SLOTS, GallerySlot, galleryPhotos, saveGalleryPhoto, removeGalleryPhoto,
} from '../services/photoService';
import GalleryViewer from './GalleryViewer';
import GalleryRulesModal from './GalleryRulesModal';

const RULES_KEY = '@lumina:galleryRulesAccepted';

interface Props {
  userId:    string;
  profile:   unknown;
  onChanged: () => void;
}

export default function GalleryEditor({ userId, profile, onChanged }: Props) {
  const [busySlot, setBusySlot]       = useState<GallerySlot | null>(null);
  const [progress, setProgress]       = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [rulesFor, setRulesFor]       = useState<GallerySlot | null>(null);
  const [rulesReadOnly, setRulesReadOnly] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(RULES_KEY)
      .then(v => setRulesAccepted(v === '1'))
      .catch(() => {});
  }, []);

  const photos = galleryPhotos(profile);
  const bySlot = new Map(photos.map(p => [p.slot, p.uri]));

  async function pick(slot: GallerySlot) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Precisamos acessar sua galeria.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setBusySlot(slot);
    setProgress(0);
    try {
      await saveGalleryPhoto(userId, slot, asset.uri, asset.width ?? 0, setProgress);
      onChanged();
    } catch (e: unknown) {
      Alert.alert('Foto não enviada', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setBusySlot(null);
    }
  }

  /** Primeira foto: as regras antes. Depois, direto ao seletor. */
  function startPick(slot: GallerySlot) {
    if (rulesAccepted) {
      pick(slot);
      return;
    }
    setRulesReadOnly(false);
    setRulesFor(slot);
  }

  function acceptRules() {
    const slot = rulesFor;
    setRulesFor(null);
    setRulesAccepted(true);
    AsyncStorage.setItem(RULES_KEY, '1').catch(() => {});
    if (slot) pick(slot);
  }

  function remove(slot: GallerySlot) {
    Alert.alert('Remover foto?', 'A foto sai da sua galeria e é apagada.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: async () => {
          setBusySlot(slot);
          try {
            await removeGalleryPhoto(slot);
            onChanged();
          } catch (e: unknown) {
            Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível remover.');
          } finally {
            setBusySlot(null);
          }
        },
      },
    ]);
  }

  function replace(slot: GallerySlot) {
    Alert.alert('Trocar foto?', 'A foto atual é substituída pela nova.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Escolher outra', onPress: () => startPick(slot) },
    ]);
  }

  function onSlotPress(slot: GallerySlot) {
    if (busySlot) return;
    if (!bySlot.has(slot)) {
      startPick(slot);
      return;
    }
    Alert.alert('Foto da galeria', undefined, [
      { text: 'Ver', onPress: () => setViewerIndex(photos.findIndex(p => p.slot === slot)) },
      { text: 'Trocar', onPress: () => replace(slot) },
      { text: 'Remover', style: 'destructive', onPress: () => remove(slot) },
    ], { cancelable: true });
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>📷 Minhas fotos</Text>
        <TouchableOpacity onPress={() => { setRulesReadOnly(true); setRulesFor(null); }} accessibilityRole="button">
          <Text style={styles.rulesLink}>Ver regras</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>
        Até 3 fotos, além da foto de perfil. Todos que visitam seu perfil podem ver.
      </Text>
      <Text style={styles.warning}>Sem nudez ou conteúdo sexual. Fotos fora das regras são removidas.</Text>

      <View style={styles.row}>
        {GALLERY_SLOTS.map(slot => {
          const uri  = bySlot.get(slot);
          const busy = busySlot === slot;
          return (
            <TouchableOpacity
              key={slot}
              style={styles.slot}
              onPress={() => onSlotPress(slot)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={uri ? `Foto ${slot} da galeria` : `Adicionar foto ${slot}`}
            >
              {uri ? <Image source={{ uri }} style={styles.image} /> : <Text style={styles.plus}>＋</Text>}
              {busy && (
                <View style={styles.busy}>
                  <ActivityIndicator color={colors.gold} />
                  {progress > 0 && progress < 100 && <Text style={styles.progress}>{progress}%</Text>}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <GalleryViewer
        photos={photos.map(p => p.uri)}
        initialIndex={viewerIndex ?? 0}
        visible={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
      />

      <GalleryRulesModal
        visible={rulesFor !== null || rulesReadOnly}
        onAccept={rulesReadOnly ? undefined : acceptRules}
        onClose={() => { setRulesFor(null); setRulesReadOnly(false); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: spacing.md, marginTop: spacing.md, padding: spacing.md, gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.grayDark,
  },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:     { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  rulesLink: { color: colors.gold, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  hint:      { color: colors.gray, fontSize: fonts.sizes.xs, lineHeight: 17 },
  warning:   { color: colors.error, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  row:       { flexDirection: 'row', gap: spacing.sm },
  slot: {
    flex: 1, aspectRatio: 4 / 5, borderRadius: borderRadius.md, overflow: 'hidden',
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.gold + '66',
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background,
  },
  image:     { width: '100%', height: '100%' },
  plus:      { color: colors.gold, fontSize: 28 },
  busy: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  progress:  { color: colors.white, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
});