// ============================================
// LUMINA — REGRAS DA GALERIA
// src/modules/profile/components/GalleryRulesModal.tsx
//
// Aparece antes da PRIMEIRA foto da galeria e exige "Li e concordo".
// Depois fica acessível pelo link "Ver regras" (modo leitura).
// ============================================

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../../theme';

export const GALLERY_RULES = [
  '🔞 Nada de nudez ou conteúdo sexual — conteúdo adulto só no marketplace.',
  '🙋 Só fotos suas. Fotos de outras pessoas, só com autorização delas.',
  '🚸 Nenhuma foto com menores de idade.',
  '🪪 Nada de documentos, placas de carro, endereço ou dados pessoais.',
  '📵 Nada de telefone, redes sociais, links ou propaganda.',
  '⚠️ Fotos fora das regras são removidas, e repetir pode suspender a conta.',
];

interface Props {
  visible:   boolean;
  /** Com onAccept: exige a caixa marcada. Sem: só leitura. */
  onAccept?: () => void;
  onClose:   () => void;
}

export default function GalleryRulesModal({ visible, onAccept, onClose }: Props) {
  const [checked, setChecked] = useState(false);

  useEffect(() => { if (visible) setChecked(false); }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>📷 Regras da galeria</Text>
          <Text style={styles.sub}>Suas fotos ficam visíveis para todos que visitam seu perfil.</Text>
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: spacing.sm }}>
            {GALLERY_RULES.map(rule => (
              <Text key={rule} style={styles.rule}>{rule}</Text>
            ))}
          </ScrollView>

          {onAccept ? (
            <>
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setChecked(c => !c)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
              >
                <Text style={[styles.checkbox, checked && styles.checkboxOn]}>{checked ? '☑' : '☐'}</Text>
                <Text style={styles.checkText}>Li e concordo com as regras</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, !checked && styles.disabled]}
                onPress={onAccept}
                disabled={!checked}
                accessibilityRole="button"
              >
                <Text style={styles.primaryText}>Escolher foto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={onClose}>
                <Text style={styles.linkText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.primaryBtn} onPress={onClose} accessibilityRole="button">
              <Text style={styles.primaryText}>Entendi</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: spacing.lg },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1,
    borderColor: colors.gold + '44', padding: spacing.lg, gap: spacing.sm,
  },
  title:     { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  sub:       { color: colors.gray, fontSize: fonts.sizes.sm, marginBottom: spacing.xs },
  rule:      { color: colors.white, fontSize: fonts.sizes.sm, lineHeight: 20 },
  checkRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, paddingVertical: spacing.xs },
  checkbox:  { color: colors.gray, fontSize: fonts.sizes.xl },
  checkboxOn: { color: colors.gold },
  checkText: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  primaryBtn: { backgroundColor: colors.gold, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  primaryText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
  disabled:  { opacity: 0.45 },
  linkBtn:   { alignSelf: 'center', padding: spacing.sm },
  linkText:  { color: colors.gray, fontSize: fonts.sizes.sm },
});