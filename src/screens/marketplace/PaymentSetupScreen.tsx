// ============================================
// PAYMENT SETUP SCREEN — chave Pix (saque manual)
//
// O criador informa a chave Pix onde recebe os saques.
// O admin transfere manualmente e marca o saque como pago.
// (Substituiu o antigo wizard de Wallet ID Asaas.)
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import {
  saveCreatorPixKey,
  getPixKeyStatus,
  validatePixKeyFormat,
  PixKeyType,
} from '../../services/marketplace/creatorPaymentSetupService';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const KEY_TYPES: { type: PixKeyType; label: string; placeholder: string; keyboard: any }[] = [
  { type: 'cpf',    label: 'CPF',       placeholder: '000.000.000-00',            keyboard: 'numeric' },
  { type: 'email',  label: 'E-mail',    placeholder: 'seu@email.com',             keyboard: 'email-address' },
  { type: 'phone',  label: 'Telefone',  placeholder: '(00) 00000-0000',           keyboard: 'phone-pad' },
  { type: 'random', label: 'Aleatória', placeholder: 'xxxxxxxx-xxxx-...',         keyboard: 'default' },
];

// Máscaras leves conforme o tipo
function maskCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function PaymentSetupScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();

  const [keyType, setKeyType] = useState<PixKeyType>('cpf');
  const [keyValue, setKeyValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const status = await getPixKeyStatus(user.uid);
      setConfigured(status.configured);
      if (status.configured) {
        setMaskedKey(status.maskedKey ?? null);
        if (status.pixKeyType) setKeyType(status.pixKeyType);
      }
      setLoading(false);
    }
    load();
  }, [user]);

  function handleChange(v: string) {
    if (keyType === 'cpf') setKeyValue(maskCpf(v));
    else if (keyType === 'phone') setKeyValue(maskPhone(v));
    else setKeyValue(v);
  }

  function switchType(t: PixKeyType) {
    setKeyType(t);
    setKeyValue('');
  }

  async function handleSave() {
    if (!validatePixKeyFormat(keyType, keyValue)) {
      Alert.alert('Chave inválida', 'Verifique a chave Pix digitada para o tipo escolhido.');
      return;
    }
    setSaving(true);
    try {
      const result = await saveCreatorPixKey(keyValue, keyType);
      if (result.valid) {
        Alert.alert(
          '✅ Chave Pix salva',
          'Seus saques serão enviados para essa chave. Você pode alterá-la quando quiser.',
          [{ text: 'OK', onPress: () => {
            setConfigured(true);
            setMaskedKey(result.maskedKey ?? null);
          }}]
        );
      } else {
        Alert.alert('Erro', result.error ?? 'Não foi possível salvar a chave.');
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer style={{ justifyContent: 'center' }}>
        <ActivityIndicator color={colors.gold} />
      </ScreenContainer>
    );
  }

  const activeType = KEY_TYPES.find(k => k.type === keyType)!;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configurar recebimento</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.emoji}>💸</Text>
        <Text style={styles.title}>Onde você quer receber seus saques?</Text>
        <Text style={styles.subtitle}>
          Informe sua chave Pix. Quando você solicitar um saque, o valor será
          transferido para essa chave.
        </Text>

        {configured && maskedKey && (
          <View style={styles.configuredBox}>
            <Text style={styles.configuredLabel}>Chave atual ({activeType.label})</Text>
            <Text style={styles.configuredValue}>{maskedKey}</Text>
            <Text style={styles.configuredHint}>Você pode alterar preenchendo abaixo.</Text>
          </View>
        )}

        <Text style={styles.fieldLabel}>Tipo de chave</Text>
        <View style={styles.typeRow}>
          {KEY_TYPES.map(kt => (
            <TouchableOpacity
              key={kt.type}
              style={[styles.typeBtn, keyType === kt.type && styles.typeBtnActive]}
              onPress={() => switchType(kt.type)}
            >
              <Text style={[styles.typeBtnText, keyType === kt.type && styles.typeBtnTextActive]}>
                {kt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Sua chave Pix ({activeType.label})</Text>
        <TextInput
          style={styles.input}
          value={keyValue}
          onChangeText={handleChange}
          placeholder={activeType.placeholder}
          placeholderTextColor={colors.gray}
          keyboardType={activeType.keyboard}
          autoCapitalize="none"
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Como funciona o saque?</Text>
          <Text style={styles.infoText}>
            Suas vendas acumulam saldo na sua carteira do Lumina. Quando quiser,
            você solicita um saque e nossa equipe transfere o valor via Pix para a
            chave informada aqui.
          </Text>
          <Text style={styles.privacyText}>
            🔒 Sua chave Pix é usada apenas para pagar seus saques. Nunca é exibida
            para outros usuários nem compartilhada sem sua permissão.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.saveButtonText}>
              {configured ? 'Atualizar chave Pix' : 'Salvar chave Pix'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backButton: { width: 40, alignItems: 'center' },
  backButtonText: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  emoji: { fontSize: 56, textAlign: 'center', marginVertical: spacing.md },
  title: {
    color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold',
    textAlign: 'center', marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center',
    lineHeight: 22, marginBottom: spacing.lg,
  },
  configuredBox: {
    backgroundColor: colors.gold + '11', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gold + '44',
    padding: spacing.md, marginBottom: spacing.lg, alignItems: 'center', gap: 2,
  },
  configuredLabel: { color: colors.gray, fontSize: fonts.sizes.sm },
  configuredValue: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  configuredHint: { color: colors.gray, fontSize: fonts.sizes.xs, marginTop: spacing.xs },
  fieldLabel: {
    color: colors.grayLight, fontSize: fonts.sizes.sm,
    marginBottom: spacing.xs, marginTop: spacing.sm, letterSpacing: 1,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  typeBtn: {
    flexGrow: 1, flexBasis: '22%', paddingVertical: spacing.sm, alignItems: 'center',
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.grayDark,
    backgroundColor: colors.surface,
  },
  typeBtnActive: { borderColor: colors.gold, backgroundColor: colors.gold + '22' },
  typeBtnText: { color: colors.gray, fontSize: fonts.sizes.sm },
  typeBtnTextActive: { color: colors.gold, fontWeight: 'bold' },
  input: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gold + '66',
    padding: spacing.md, color: colors.white, fontSize: fonts.sizes.md,
    marginBottom: spacing.md,
  },
  infoBox: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark,
    padding: spacing.md, marginBottom: spacing.lg, gap: spacing.sm,
  },
  infoTitle: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  infoText: { color: colors.gray, fontSize: fonts.sizes.xs, lineHeight: 18 },
  privacyText: { color: colors.grayLight, fontSize: fonts.sizes.xs, lineHeight: 18, marginTop: spacing.xs },
  saveButton: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
});