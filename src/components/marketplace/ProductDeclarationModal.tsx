// ============================================
// LUMINA — DECLARAÇÃO DO PRODUTO
// src/components/marketplace/ProductDeclarationModal.tsx
//
// 12/10/2026. Aparece a CADA envio para análise (produto novo,
// reenvio após recusa, capa ou arquivos novos em produto à venda).
// O criador lê os 5 itens com o título do produto e marca o aceite;
// só então o envio acontece. O servidor grava a declaração em
// creatorAgreements/{uid}/history junto do envio.
// ============================================

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { PRODUCT_DECLARATION_ITEMS } from '../../config/legal/creatorAgreement';

interface Props {
  visible: boolean;
  productTitle: string;
  /** Texto do botão (ex.: "Aceitar e enviar para análise"). */
  confirmLabel: string;
  /** true enquanto o envio acontece (trava os botões). */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ProductDeclarationModal({
  visible, productTitle, confirmLabel, busy = false, onConfirm, onCancel,
}: Props) {
  const [checked, setChecked] = useState(false);

  // Cada abertura começa desmarcada: o aceite é deste envio.
  useEffect(() => { if (visible) setChecked(false); }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && onCancel()}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>📜 Declaração do Produto</Text>
          <ScrollView style={styles.body} contentContainerStyle={{ gap: spacing.sm }}>
            <Text style={styles.lead}>
              Declaro, sob as penas da lei, que neste produto,{' '}
              <Text style={styles.strong}>"{productTitle || 'sem título'}"</Text>:
            </Text>
            {PRODUCT_DECLARATION_ITEMS.map((item, i) => (
              <Text key={item} style={styles.item}>
                <Text style={styles.strong}>{i + 1}.</Text> {item}
              </Text>
            ))}
            <Text style={styles.fine}>
              Esta declaração fica registrada com data, hora e versão do app, e vale como
              assinatura eletrônica, conforme o Contrato do Criador.
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setChecked(v => !v)}
            disabled={busy}
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled: busy }}
          >
            <View style={[styles.checkbox, checked && styles.checkboxOn]}>
              {checked && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>Li e aceito esta declaração.</Text>
          </TouchableOpacity>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={busy} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (!checked || busy) && styles.btnOff]}
              onPress={onConfirm}
              disabled={!checked || busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: !checked || busy }}
            >
              {busy
                ? <ActivityIndicator color={colors.background} />
                : <Text style={styles.confirmText}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', padding: spacing.lg },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1,
    borderColor: colors.gold + '55', padding: spacing.lg, gap: spacing.md, maxHeight: '88%',
  },
  title: { color: colors.gold, fontSize: fonts.sizes.lg, fontWeight: 'bold', textAlign: 'center' },
  body: { flexGrow: 0 },
  lead: { color: colors.white, fontSize: fonts.sizes.md, lineHeight: 22 },
  strong: { color: colors.white, fontWeight: 'bold' },
  item: { color: colors.grayLight, fontSize: fonts.sizes.sm, lineHeight: 21 },
  fine: { color: colors.gray, fontSize: fonts.sizes.xs, lineHeight: 17, marginTop: spacing.xs },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: colors.gray,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { borderColor: colors.gold, backgroundColor: colors.gold },
  checkMark: { color: colors.background, fontSize: 14, fontWeight: 'bold' },
  checkLabel: { flex: 1, color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    flex: 1, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.grayDark,
    padding: spacing.md, alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { color: colors.gray, fontWeight: 'bold' },
  confirmBtn: {
    flex: 2, backgroundColor: colors.gold, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', justifyContent: 'center',
  },
  confirmText: { color: colors.background, fontWeight: 'bold', textAlign: 'center' },
  btnOff: { opacity: 0.45 },
});
