// ============================================
// LUMINA — GALERIA EM TELA CHEIA
// src/modules/profile/components/GalleryViewer.tsx
//
// Desliza entre as fotos. Com onReport (perfil de OUTRA pessoa),
// mostra "🚩 Denunciar", que abre o suporte já em Denúncia.
// ============================================

import React from 'react';
import {
  Modal, View, Text, Image, FlatList, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../../theme';

const { width, height } = Dimensions.get('window');

interface Props {
  photos:       string[];
  initialIndex: number;
  visible:      boolean;
  onClose:      () => void;
  onReport?:    () => void;
}

export default function GalleryViewer({ photos, initialIndex, visible, onClose, onReport }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <FlatList
          data={photos}
          keyExtractor={(uri, i) => `${i}_${uri}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(initialIndex, Math.max(photos.length - 1, 0))}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          renderItem={({ item }) => (
            <View style={styles.page}>
              <Image source={{ uri: item }} style={styles.image} resizeMode="contain" />
            </View>
          )}
        />

        <TouchableOpacity style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar">
          <Text style={styles.closeText}>✕ Fechar</Text>
        </TouchableOpacity>

        {onReport && (
          <TouchableOpacity
            style={styles.report}
            onPress={() => { onClose(); onReport(); }}
            accessibilityRole="button"
            accessibilityLabel="Denunciar foto"
          >
            <Text style={styles.reportText}>🚩 Denunciar</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  page:       { width, height, alignItems: 'center', justifyContent: 'center' },
  image:      { width, height: height * 0.8 },
  close:      { position: 'absolute', top: spacing.xl + spacing.md, right: spacing.md, padding: spacing.sm },
  closeText:  { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  report: {
    position: 'absolute', bottom: spacing.xl + spacing.md, alignSelf: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.error, backgroundColor: 'rgba(0,0,0,0.6)',
  },
  reportText: { color: colors.error, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
});