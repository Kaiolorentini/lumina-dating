// ============================================
// LUMINA — SOLICITAR SAQUE v2
// src/screens/marketplace/WithdrawalScreen.tsx
//
// v2 (28/09): o saque é pedido ao SERVIDOR (requestWithdrawal), que
// usa SEMPRE a chave Pix cadastrada e confere mínimo, saldo, dívida e
// saque aberto. Antes o app gravava o saque direto, com a chave que
// quisesse.
//
// A chave aparece MASCARADA; para trocar, "Alterar" leva à tela de
// recebimento. Dívida por reembolso bloqueia o pedido, com o valor.
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../core/firebase';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useCreatorWallet } from '../../hooks/useCreatorWallet';
import {
  getPixKeyStatus, PixKeyStatus, PixKeyType,
} from '../../services/marketplace/creatorPaymentSetupService';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const MIN_WITHDRAWAL = 10;

const KEY_LABEL: Record<PixKeyType, string> = {
  cpf: 'CPF', email: 'E-mail', phone: 'Telefone', random: 'Chave aleatória',
};

function money(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

export default function WithdrawalScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { wallet, loading } = useCreatorWallet(user?.uid);

  const [amount, setAmount]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [keyStatus, setKeyStatus]   = useState<PixKeyStatus | null>(null);
  const [keyLoading, setKeyLoading] = useState(true);

  const loadKey = useCallback(async () => {
    setKeyLoading(true);
    setKeyStatus(await getPixKeyStatus());
    setKeyLoading(false);
  }, []);

  // Recarrega ao voltar da tela de recebimento (chave alterada).
  useEffect(() => {
    loadKey();
    return navigation.addListener('focus', loadKey);
  }, [navigation, loadKey]);

  const available  = wallet?.availableBalance ?? 0;
  const debt       = wallet?.debtBalance ?? 0;
  const chargeback = wallet?.hasChargebackPending === true;
  const blocked    = debt > 0 || chargeback;

  function submit() {
    const value = Math.round(parseFloat(amount.replace(',', '.')) * 100) / 100;

    if (!keyStatus?.configured) {
      Alert.alert('Chave Pix', 'Cadastre sua chave Pix antes de solicitar o saque.');
      return;
    }
    if (!Number.isFinite(value) || value < MIN_WITHDRAWAL) {
      Alert.alert('Valor mínimo', `O saque mínimo é ${money(MIN_WITHDRAWAL)}.`);
      return;
    }
    if (value > available) {
      Alert.alert('Saldo insuficiente', `Seu saldo disponível é ${money(available)}.`);
      return;
    }

    Alert.alert(
      'Confirmar saque',
      `${money(value)} para a chave ${KEY_LABEL[keyStatus.pixKeyType ?? 'cpf']} ${keyStatus.maskedKey}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Solicitar', onPress: () => send(value) },
      ],
    );
  }

  async function send(value: number) {
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ amount: number }, { success: boolean }>(
        getFunctions(app, 'us-central1'), 'requestWithdrawal',
      );
      await fn({ amount: value });
      Alert.alert(
        '✅ Saque solicitado',
        `Seu pedido de ${money(value)} foi registrado. Nossa equipe faz o Pix em até 2 dias úteis, e você recebe um aviso quando for pago.`,
        [{ text: 'Entendi', onPress: () => navigation.goBack() }],
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível solicitar o saque.';
      Alert.alert('Saque não solicitado', message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || keyLoading) {
    return (
      <ScreenContainer style={{ justifyContent: 'center' }}>
        <ActivityIndicator color={colors.gold} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Solicitar Saque</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Disponível para saque</Text>
          <Text style={styles.balanceValue}>{money(available)}</Text>
        </View>

        {debt > 0 && (
          <View style={styles.warnCard}>
            <Text style={styles.warnTitle}>⚠️ Pendência de {money(debt)}</Text>
            <Text style={styles.warnText}>
              Um reembolso ou estorno foi maior que o seu saldo. Suas próximas vendas cobrem
              esse valor automaticamente, e o saque volta a ser liberado em seguida.
            </Text>
          </View>
        )}

        {chargeback && (
          <View style={styles.warnCard}>
            <Text style={styles.warnText}>⚠️ Há um chargeback pendente. Saques bloqueados temporariamente.</Text>
          </View>
        )}

        {/* Chave de recebimento */}
        {keyStatus?.configured ? (
          <View style={styles.keyCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.keyLabel}>Você recebe em ({KEY_LABEL[keyStatus.pixKeyType ?? 'cpf']})</Text>
              <Text style={styles.keyValue}>{keyStatus.maskedKey}</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('PaymentSetup')}
              accessibilityRole="button"
              accessibilityLabel="Alterar chave Pix"
            >
              <Text style={styles.keyChange}>Alterar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.keyMissing}
            onPress={() => navigation.navigate('PaymentSetup')}
            accessibilityRole="button"
          >
            <Text style={styles.keyMissingTitle}>Cadastre sua chave Pix</Text>
            <Text style={styles.keyMissingText}>É para ela que enviamos seus saques. Toque para cadastrar.</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Valor do saque (mínimo {money(MIN_WITHDRAWAL)})</Text>
        <View style={styles.amountRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={amount}
            onChangeText={setAmount}
            placeholder="Ex: 100,00"
            placeholderTextColor={colors.gray}
            keyboardType="decimal-pad"
            editable={!blocked}
          />
          <TouchableOpacity
            style={styles.allBtn}
            onPress={() => setAmount(available.toFixed(2).replace('.', ','))}
            disabled={blocked || available < MIN_WITHDRAWAL}
            accessibilityRole="button"
          >
            <Text style={styles.allBtnText}>Tudo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Nossa equipe faz o Pix para a sua chave cadastrada em até 2 dias úteis.
            Você recebe um aviso quando o pagamento for concluído.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || blocked || !keyStatus?.configured) && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={submitting || blocked || !keyStatus?.configured}
          accessibilityRole="button"
        >
          {submitting
            ? <ActivityIndicator color={colors.background} />
            : <Text style={styles.submitBtnText}>💸 Solicitar saque</Text>}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  balanceCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.gold + '44', padding: spacing.md, marginBottom: spacing.md, alignItems: 'center',
  },
  balanceLabel: { color: colors.gray, fontSize: fonts.sizes.sm, marginBottom: spacing.xs },
  balanceValue: { color: colors.success, fontSize: fonts.sizes.xxl, fontWeight: 'bold' },
  warnCard: {
    backgroundColor: colors.error + '11', borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.error, padding: spacing.md, marginBottom: spacing.md, gap: 4,
  },
  warnTitle: { color: colors.error, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  warnText: { color: colors.error, fontSize: fonts.sizes.sm, lineHeight: 19 },
  keyCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.sm,
  },
  keyLabel: { color: colors.gray, fontSize: fonts.sizes.xs },
  keyValue: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', marginTop: 2 },
  keyChange: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  keyMissing: {
    backgroundColor: colors.gold + '11', borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.gold, padding: spacing.md, marginBottom: spacing.sm, gap: 4,
  },
  keyMissingTitle: { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  keyMissingText: { color: colors.gray, fontSize: fonts.sizes.sm },
  label: { color: colors.gray, fontSize: fonts.sizes.sm, marginBottom: spacing.xs, marginTop: spacing.md },
  amountRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, color: colors.white, padding: spacing.md, fontSize: fonts.sizes.md,
  },
  allBtn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gold,
  },
  allBtnText: { color: colors.gold, fontWeight: 'bold' },
  infoBox: {
    backgroundColor: colors.gold + '11', borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.gold + '44', padding: spacing.md, marginTop: spacing.md,
  },
  infoText: { color: colors.gold, fontSize: fonts.sizes.sm, lineHeight: 19 },
  submitBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.md,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
});