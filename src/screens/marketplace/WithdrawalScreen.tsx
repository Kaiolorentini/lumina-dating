import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { Button, Card, Input } from '../../components/ui';
import { useNavigation } from '@react-navigation/native';
import { addDoc, collection, serverTimestamp, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { MARKETPLACE_COLLECTIONS, COLLECTIONS } from '../../core/constants';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS , alpha} from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { useCreatorWallet } from '../../hooks/useCreatorWallet';
import { PixType } from '../../shared/types/marketplace';
import ScreenContainer from '../../components/ScreenContainer';

const PIX_TYPES: { label: string; value: PixType }[] = [
  { label: 'CPF', value: 'cpf' },
  { label: 'CNPJ', value: 'cnpj' },
  { label: 'E-mail', value: 'email' },
  { label: 'Telefone', value: 'telefone' },
  { label: 'Chave aleatória', value: 'chave' },
];

function mapProfileTypeToPixType(profileType?: string): PixType | null {
  switch (profileType) {
    case 'cpf':    return 'cpf';
    case 'email':  return 'email';
    case 'phone':  return 'telefone';
    case 'random': return 'chave';
    default:       return null;
  }
}

function onlyDigits(v: string): string { return v.replace(/\D/g, ''); }

function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let check = (sum * 10) % 11; if (check === 10) check = 0;
  if (check !== parseInt(cpf[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  check = (sum * 10) % 11; if (check === 10) check = 0;
  return check === parseInt(cpf[10], 10);
}
function isValidCnpj(raw: string): boolean {
  const c = onlyDigits(raw);
  return c.length === 14;
}
function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
function isValidPhone(v: string): boolean {
  const d = onlyDigits(v).replace(/^55/, '');
  return d.length === 10 || d.length === 11;
}
function isValidRandom(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
}

function validateKeyByType(type: PixType, value: string): boolean {
  switch (type) {
    case 'cpf':      return isValidCpf(value);
    case 'cnpj':     return isValidCnpj(value);
    case 'email':    return isValidEmail(value);
    case 'telefone': return isValidPhone(value);
    case 'chave':    return isValidRandom(value);
    default:         return false;
  }
}

const TYPE_ERROR: Record<PixType, string> = {
  cpf: 'CPF inválido.',
  cnpj: 'CNPJ inválido (14 dígitos).',
  email: 'E-mail inválido.',
  telefone: 'Telefone inválido (DDD + número).',
  chave: 'Chave aleatória inválida (formato UUID).',
};

export default function WithdrawalScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { wallet, loading } = useCreatorWallet(user?.uid);
  const [amount, setAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixType, setPixType] = useState<PixType>('cpf');
  const [submitting, setSubmitting] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    async function loadProfilePixKey() {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
        if (!snap.exists()) return;
        const data = snap.data();
        const savedKey: string | undefined = data.pixKey;
        const savedType = mapProfileTypeToPixType(data.pixKeyType);
        if (savedKey && savedType) {
          setPixKey(savedKey);
          setPixType(savedType);
          setPrefilled(true);
        }
      } catch {
      }
    }
    loadProfilePixKey();
  }, [user]);

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
    if (parsedAmount < 10) {
      Alert.alert('Valor mínimo', 'O saque mínimo é R$ 10,00');
      return;
    }
    if (!pixKey.trim()) {
      Alert.alert('Erro', 'Informe sua chave Pix.');
      return;
    }
    if (!validateKeyByType(pixType, pixKey)) {
      Alert.alert('Chave Pix inválida', TYPE_ERROR[pixType]);
      return;
    }

    const existing = await getDocs(
      query(
        collection(db, MARKETPLACE_COLLECTIONS.WITHDRAWALS),
        where('userId', '==', user.uid),
        where('status', 'in', ['pending', 'approved']),
      ),
    );
    if (!existing.empty) {
      Alert.alert(
        'Saque já solicitado',
        'Você já possui um pedido de saque pendente. Aguarde o pagamento ser concluído para solicitar outro.',
      );
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, MARKETPLACE_COLLECTIONS.WITHDRAWALS), {
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
        `Seu pedido de saque de R$ ${parsedAmount.toFixed(2)} foi registrado.\n\n` +
        'Nossa equipe vai analisar e realizar o depósito via Pix na chave informada ' +
        'em até 24 horas úteis.\n\n' +
        'Você será notificado assim que o pagamento for concluído.',
        [{ text: 'Entendi', onPress: () => navigation.goBack() }],
      );
    } catch (error: any) {
      Alert.alert('Erro', error.message ?? 'Não foi possível enviar a solicitação.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Solicitar Saque</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card padding={SPACING.md} style={{ alignItems: 'center', marginBottom: SPACING.lg }}>
          <Text style={styles.balanceLabel}>Disponível para saque</Text>
          <Text style={styles.balanceValue}>
            R$ {(wallet?.availableBalance ?? 0).toFixed(2)}
          </Text>
        </Card>

        <Text style={styles.label}>Valor do saque (mínimo R$ 10,00)</Text>
        <Input value={amount} onChangeText={setAmount} placeholder="Ex: 100,00" keyboardType="decimal-pad" />

        <Text style={styles.label}>Tipo de chave Pix</Text>
        <View style={styles.pixTypeGrid}>
          {PIX_TYPES.map(type => (
            <Button
              key={type.value}
              label={type.label}
              variant="ghost"
              onPress={() => setPixType(type.value)}
              style={{
                flex: 1, borderWidth: 1, alignItems: 'center',
                borderColor: pixType === type.value ? COLORS.gold : COLORS.border,
                backgroundColor: pixType === type.value ? alpha(COLORS.gold, 0.13) : COLORS.card,
              }}
              textStyle={{
                color: pixType === type.value ? COLORS.gold : COLORS.textSecondary,
              }}
            />
          ))}
        </View>

        <Text style={styles.label}>Chave Pix</Text>
        <Input value={pixKey} onChangeText={setPixKey} placeholder="Informe sua chave Pix" autoCapitalize="none" />

        {prefilled && (
          <Text style={styles.prefilledHint}>
            Chave preenchida com a que você salvou no perfil. Você pode alterá-la para este saque.
          </Text>
        )}

        <Card padding={SPACING.md} style={{ marginBottom: SPACING.lg }}>
          <Text style={styles.infoText}>
            💡 Após solicitar, nossa equipe analisa o pedido e faz o depósito via Pix
            na chave informada em até 24 horas úteis. Você será notificado quando
            o pagamento for concluído.
          </Text>
        </Card>

        <Button
          label="💸 Solicitar saque"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
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
  // backBtn removed — now uses Button
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  content: { padding: SPACING.md },
  balanceCard: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    borderColor: alpha(COLORS.gold, 0.27), padding: SPACING.md, marginBottom: SPACING.md, alignItems: 'center',
  },
  balanceLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, marginBottom: SPACING.xs },
  balanceValue: { color: COLORS.success, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold },
  label: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, marginBottom: SPACING.xs, marginTop: SPACING.md },
  // input removed — now uses Input
  prefilledHint: {
    color: COLORS.gold, fontSize: FONT_SIZE.xs, marginTop: SPACING.xs, lineHeight: 16,
  },
  pixTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  // pixTypeChip/pixTypeChipActive/pixTypeText/pixTypeTextActive removed — now uses Button
  // infoBox removed — now uses Card
  infoText: { color: COLORS.gold, fontSize: FONT_SIZE.caption },
  // submitBtn/submitBtnDisabled/submitBtnText removed — now uses Button
});
