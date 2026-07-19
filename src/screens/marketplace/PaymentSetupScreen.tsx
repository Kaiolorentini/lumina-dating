import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { Button, Card, Input } from '../../components/ui';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT , alpha} from '../../theme/tokens';
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
        <ActivityIndicator color={COLORS.gold} />
      </ScreenContainer>
    );
  }

  const activeType = KEY_TYPES.find(k => k.type === keyType)!;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
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
          <Card padding={SPACING.md} style={{ borderWidth: 1, borderColor: alpha(COLORS.gold, 0.27) }}>
            <Text style={styles.configuredLabel}>Chave atual ({activeType.label})</Text>
            <Text style={styles.configuredValue}>{maskedKey}</Text>
            <Text style={styles.configuredHint}>Você pode alterar preenchendo abaixo.</Text>
          </Card>
        )}

        <Text style={styles.fieldLabel}>Tipo de chave</Text>
        <View style={styles.typeRow}>
          {KEY_TYPES.map(kt => (
            <Button
              key={kt.type}
              label={kt.label}
              variant="ghost"
              onPress={() => switchType(kt.type)}
              style={{
                flex: 1, borderWidth: 1, alignItems: 'center',
                borderColor: keyType === kt.type ? COLORS.gold : COLORS.border,
                backgroundColor: keyType === kt.type ? alpha(COLORS.gold, 0.13) : COLORS.card,
              }}
              textStyle={{
                color: keyType === kt.type ? COLORS.gold : COLORS.textSecondary,
              }}
            />
          ))}
        </View>

        <Text style={styles.fieldLabel}>Sua chave Pix ({activeType.label})</Text>
        <Input
          value={keyValue}
          onChangeText={handleChange}
          placeholder={activeType.placeholder}
          keyboardType={activeType.keyboard}
          autoCapitalize="none"
        />

        <Card padding={SPACING.md} style={{ marginBottom: SPACING.md }}>
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
        </Card>

        <Button
          label={configured ? 'Atualizar chave Pix' : 'Salvar chave Pix'}
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          variant="primary"
          fullWidth
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    borderBottomWidth: 0.5, borderBottomColor: alpha(COLORS.gold, 0.27),
  },
  // backButton/backButtonText removed — now uses Button
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl },
  emoji: { fontSize: 56, textAlign: 'center', marginVertical: SPACING.md },
  title: {
    color: COLORS.textPrimary, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center', marginBottom: SPACING.sm,
  },
  subtitle: {
    color: COLORS.textSecondary, fontSize: FONT_SIZE.body, textAlign: 'center',
    lineHeight: 22, marginBottom: SPACING.lg,
  },
  // configuredBox removed — now uses Card
  configuredLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  configuredValue: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  configuredHint: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
  fieldLabel: {
    color: COLORS.textSecondary, fontSize: FONT_SIZE.caption,
    marginBottom: SPACING.xs, marginTop: SPACING.sm, letterSpacing: 1,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  // typeBtn/typeBtnActive/typeBtnText/typeBtnTextActive removed — now uses Button
  // input removed — now uses Input
  // infoBox removed — now uses Card
  infoTitle: { color: COLORS.gold, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  infoText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, lineHeight: 18 },
  privacyText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, lineHeight: 18, marginTop: SPACING.xs },
  // saveButton/saveButtonDisabled/saveButtonText removed — now uses Button
});
