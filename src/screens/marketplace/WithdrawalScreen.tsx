import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { doc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { MARKETPLACE_COLLECTIONS } from '../../core/constants';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useCreatorWallet } from '../../hooks/useCreatorWallet';
import { PixType } from '../../shared/types/marketplace';

const PIX_TYPES: { label: string; value: PixType }[] = [
  { label: 'CPF', value: 'cpf' },
  { label: 'CNPJ', value: 'cnpj' },
  { label: 'E-mail', value: 'email' },
  { label: 'Telefone', value: 'telefone' },
  { label: 'Chave aleatória', value: 'chave' },
];

export default function WithdrawalScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { wallet, loading } = useCreatorWallet(user?.uid);
  const [amount, setAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixType, setPixType] = useState<PixType>('cpf');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!user) return;
    const parsedAmount = parseFloat(amount.replace(',', '.'));

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Erro', 'Informe um valor válido.');
      return;
    }
    if (parsedAmount > (wallet?.availableBalance ?? 0)) {
      Alert.alert('Saldo insuficiente', `Seu saldo disponível é R$ ${(wallet?.availableBalance ?? 0).toFixed(2)}`);
      return;
    }
    if (parsedAmount < 50) {
      Alert.alert('Valor mínimo', 'O saque mínimo é R$ 50,00');
      return;
    }
    if (!pixKey.trim()) {
      Alert.alert('Erro', 'Informe sua chave Pix.');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, MARKETPLACE_COLLECTIONS.WITHDRAWALS), {
        userId: user.uid,
        amount: parsedAmount,
        balanceAtRequest: wallet?.availableBalance ?? 0,
        pixKey: pixKey.trim(),
        pixType,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        '✅ Solicitação enviada!',
        'Nossa equipe processará seu saque em breve.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (error: any) {
      Alert.alert('Erro', error.message ?? 'Não foi possível enviar a solicitação.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Solicitar Saque</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Saldo disponível */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Disponível para saque</Text>
          <Text style={styles.balanceValue}>
            R$ {(wallet?.availableBalance ?? 0).toFixed(2)}
          </Text>
        </View>

        {/* Valor */}
        <Text style={styles.label}>Valor do saque (mínimo R$ 50,00)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="Ex: 100,00"
          placeholderTextColor={colors.gray}
          keyboardType="decimal-pad"
        />

        {/* Tipo de chave Pix */}
        <Text style={styles.label}>Tipo de chave Pix</Text>
        <View style={styles.pixTypeGrid}>
          {PIX_TYPES.map(type => (
            <TouchableOpacity
              key={type.value}
              style={[styles.pixTypeChip, pixType === type.value && styles.pixTypeChipActive]}
              onPress={() => setPixType(type.value)}
            >
              <Text style={[styles.pixTypeText, pixType === type.value && styles.pixTypeTextActive]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chave Pix */}
        <Text style={styles.label}>Chave Pix</Text>
        <TextInput
          style={styles.input}
          value={pixKey}
          onChangeText={setPixKey}
          placeholder="Informe sua chave Pix"
          placeholderTextColor={colors.gray}
          autoCapitalize="none"
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 O saque será processado manualmente em até 48 horas úteis.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.submitBtnText}>💸 Solicitar saque</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  content: { padding: spacing.md },
  balanceCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.gold + '44', padding: spacing.md, marginBottom: spacing.md, alignItems: 'center',
  },
  balanceLabel: { color: colors.gray, fontSize: fonts.sizes.sm, marginBottom: spacing.xs },
  balanceValue: { color: colors.success, fontSize: fonts.sizes.xxl, fontWeight: 'bold' },
  label: { color: colors.gray, fontSize: fonts.sizes.sm, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, color: colors.white, padding: spacing.md, fontSize: fonts.sizes.md,
  },
  pixTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  pixTypeChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.grayDark,
  },
  pixTypeChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  pixTypeText: { color: colors.gray, fontSize: fonts.sizes.sm },
  pixTypeTextActive: { color: colors.background, fontWeight: 'bold' },
  infoBox: {
    backgroundColor: colors.gold + '11', borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.gold + '44', padding: spacing.md, marginTop: spacing.md,
  },
  infoText: { color: colors.gold, fontSize: fonts.sizes.sm },
  submitBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.md,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
});