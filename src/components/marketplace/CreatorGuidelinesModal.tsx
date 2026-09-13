// ============================================
// LUMINA — AVISO AO CRIADOR
// src/components/marketplace/CreatorGuidelinesModal.tsx
//
// Aparece ao abrir a criação de produto, toda vez.
//
// Não é onboarding — é comunicação de regra. Autoria e
// consentimento têm peso legal num marketplace adulto: se
// houver disputa, este é o registro de que a plataforma
// comunicou a exigência antes da publicação. Por isso não
// guardamos flag de "já viu".
// ============================================

import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../theme';

interface Props {
  visible: boolean;
  onContinue: () => void;
}

export default function CreatorGuidelinesModal({ visible, onContinue }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Sem onRequestClose que feche: o botão é a única saída,
      // para o aviso não ser dispensado pelo botão voltar do
      // Android sem ter sido lido.
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Antes de publicar</Text>

            <Text style={styles.body}>
              O Lumina é um marketplace de conteúdo adulto. Você pode vender
              fotos, vídeos, cursos e PDFs — todo conteúdo é destinado
              exclusivamente a maiores de 18 anos.
            </Text>

            <View style={styles.rule}>
              <Text style={styles.ruleIcon}>⚖️</Text>
              <Text style={styles.ruleText}>
                Publique apenas material do qual você detém os direitos e no
                qual todas as pessoas retratadas são maiores de idade e
                consentiram com a venda.
              </Text>
            </View>

            <View style={styles.rule}>
              <Text style={styles.ruleIcon}>💰</Text>
              <Text style={styles.ruleText}>
                Defina um preço coerente com o que está entregando. Preços
                justos constroem reputação e geram recompra.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.btn}
              onPress={onContinue}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>Continuar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold + '55',
    padding: spacing.lg,
    maxHeight: '85%',
  },
  title: {
    color: colors.gold,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  body: {
    color: colors.grayLight,
    fontSize: fonts.sizes.md,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  rule: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  ruleIcon: { fontSize: 18, marginTop: 1 },
  ruleText: {
    flex: 1,
    color: colors.grayLight,
    fontSize: fonts.sizes.sm,
    lineHeight: 20,
  },
  btn: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  btnText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: fonts.sizes.md,
  },
});