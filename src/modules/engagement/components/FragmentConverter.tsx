// ============================================
// LUMINA — PAINEL DE CONVERSÃO DE FRAGMENTOS
// src/modules/engagement/components/FragmentConverter.tsx
//
// Botão 2 do Cofre, também usado na tela de Fragmentos: a pessoa
// escolhe quantos cristais quer (−/+ ou "Tudo") e confirma.
// 100 fragmentos = 1 cristal gratuito. Sem teto, sem espera — o
// limite é o saldo.
//
// Componente de apresentação: quem converte é a tela, pelo
// useFragments. Um só painel para as duas telas.
// ============================================

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

interface Props {
  /** Fragmentos na CARTEIRA — só eles podem ser convertidos. */
  fragments:           number;
  fragmentsPerCrystal: number;
  converting:          boolean;
  onConvert:           (crystals: number) => void;
}

export default function FragmentConverter({
  fragments, fragmentsPerCrystal, converting, onConvert,
}: Props) {
  const maxCrystals = Math.floor(fragments / fragmentsPerCrystal);
  const [amount, setAmount] = useState(1);

  // Saldo mudou (saque, conversão): mantém a escolha dentro do possível.
  useEffect(() => {
    setAmount(prev => Math.min(Math.max(prev, 1), Math.max(maxCrystals, 1)));
  }, [maxCrystals]);

  const cost      = amount * fragmentsPerCrystal;
  const canAct    = maxCrystals >= 1 && !converting;
  const plural    = amount === 1 ? 'cristal' : 'cristais';
  const missing   = fragmentsPerCrystal - (fragments % fragmentsPerCrystal);

  function confirmConvert() {
    Alert.alert(
      'Converter fragmentos',
      `Trocar ${cost} fragmentos por ${amount} ${plural} gratuito${amount === 1 ? '' : 's'}? Não dá para desfazer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Converter', onPress: () => onConvert(amount) },
      ],
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Converter em cristais</Text>
      <Text style={styles.formula}>{fragmentsPerCrystal} 🔮 = 1 ✨ cristal gratuito</Text>
      <Text style={styles.balance}>
        Na carteira: <Text style={styles.balanceValue}>{fragments} 🔮</Text>
      </Text>

      {maxCrystals < 1 ? (
        <Text style={styles.missing}>
          Faltam {missing} fragmentos para o primeiro cristal.
        </Text>
      ) : (
        <>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={[styles.stepBtn, amount <= 1 && styles.stepBtnDisabled]}
              onPress={() => setAmount(a => Math.max(1, a - 1))}
              disabled={amount <= 1 || converting}
              accessibilityRole="button"
              accessibilityLabel="Diminuir"
            >
              <Text style={styles.stepText}>−</Text>
            </TouchableOpacity>

            <View style={styles.amountBox}>
              <Text style={styles.amount}>{amount}</Text>
              <Text style={styles.amountLabel}>✨ {plural}</Text>
            </View>

            <TouchableOpacity
              style={[styles.stepBtn, amount >= maxCrystals && styles.stepBtnDisabled]}
              onPress={() => setAmount(a => Math.min(maxCrystals, a + 1))}
              disabled={amount >= maxCrystals || converting}
              accessibilityRole="button"
              accessibilityLabel="Aumentar"
            >
              <Text style={styles.stepText}>+</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.allBtn}
              onPress={() => setAmount(maxCrystals)}
              disabled={converting}
              accessibilityRole="button"
              accessibilityLabel={`Converter tudo: ${maxCrystals} cristais`}
            >
              <Text style={styles.allText}>Tudo</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cost}>Custa {cost} 🔮</Text>
        </>
      )}

      <TouchableOpacity
        style={[styles.convertBtn, !canAct && styles.convertBtnDisabled]}
        onPress={confirmConvert}
        disabled={!canAct}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Converter em ${amount} ${plural}`}
      >
        {converting ? (
          <ActivityIndicator color={COLORS.surface} />
        ) : (
          <Text style={styles.convertText}>
            {maxCrystals >= 1 ? `Converter em ${amount} ${plural}` : 'Fragmentos insuficientes'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  card:            { backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.lg, gap: S.sm, borderWidth: 1, borderColor: COLORS.secondary + '55' },
  title:           { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  formula:         { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  balance:         { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  balanceValue:    { color: COLORS.secondary, fontWeight: FONT_WEIGHT.bold },
  missing:         { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', marginVertical: S.sm },
  stepperRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, marginTop: S.xs },
  stepBtn:         { width: 44, height: 44, borderRadius: R.full, borderWidth: 1, borderColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center' },
  stepBtnDisabled: { opacity: 0.35 },
  stepText:        { color: COLORS.secondary, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
  amountBox:       { minWidth: 72, alignItems: 'center' },
  amount:          { color: COLORS.surface, fontSize: 32, fontWeight: FONT_WEIGHT.extrabold },
  amountLabel:     { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  allBtn:          { paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full, backgroundColor: COLORS.secondary + '22', borderWidth: 1, borderColor: COLORS.secondary },
  allText:         { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  cost:            { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center' },
  convertBtn:      { backgroundColor: COLORS.primary, borderRadius: R.lg, paddingVertical: S.md, alignItems: 'center', marginTop: S.xs },
  convertBtnDisabled: { opacity: 0.4 },
  convertText:     { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
});