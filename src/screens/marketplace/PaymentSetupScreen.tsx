// ============================================
// PAYMENT SETUP SCREEN — MARKETPLACE
//
// Wizard de 6 etapas para configurar recebimentos
// automáticos via Asaas.
//
// ⚠️ API_TODO #5:
// Na ETAPA 5, quando API Key estiver disponível:
// - Trocar verifyWalletId() por chamada real à API
// - Atualizar status de 'pending' para 'verified'
// - Exibir nome da conta Asaas confirmada
//
// ⚠️ API_TODO #6:
// Link de convite de produção:
// SANDBOX:   https://sandbox.asaas.com/r/68eb1add-fccc-4676-8320-066fb5645157
// PRODUÇÃO:  https://asaas.com/r/SEU-CODIGO (pegar no painel Asaas real)
// ============================================

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
  Clipboard,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import {
  verifyAsaasWalletViaApi,  // ← NOVO
  saveWalletId,
  markWalletVerified,
  markWalletError,
} from '../../services/marketplace/creatorPaymentSetupService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const TOTAL_STEPS = 6;

// ⚠️ API_TODO #6: trocar URL de produção quando lançar
const ASAAS_INVITE_URL =
  'https://sandbox.asaas.com/r/68eb1add-fccc-4676-8320-066fb5645157';

// ============================================
// COMPONENTES AUXILIARES
// ============================================

function StepIndicator({ current }: { current: number }) {
  return (
    <View style={styles.stepIndicator}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.stepDot,
            i < current && styles.stepDotCompleted,
            i === current - 1 && styles.stepDotActive,
          ]}
        />
      ))}
    </View>
  );
}

function StepHeader({
  step,
  title,
  subtitle,
}: {
  step: number;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.stepHeader}>
      <Text style={styles.stepLabel}>Etapa {step} de {TOTAL_STEPS}</Text>
      <Text style={styles.stepTitle}>{title}</Text>
      {subtitle && <Text style={styles.stepSubtitle}>{subtitle}</Text>}
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  loading,
  secondary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        secondary && styles.actionButtonSecondary,
        disabled && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.8}
    >
      {loading ? (
<ActivityIndicator color={secondary ? colors.gold : colors.background} />
      ) : (
        <Text
          style={[
            styles.actionButtonText,
            secondary && styles.actionButtonTextSecondary,
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function InfoCard({
  icon,
  text,
}: {
  icon: string;
  text: string;
}) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoCardIcon}>{icon}</Text>
      <Text style={styles.infoCardText}>{text}</Text>
    </View>
  );
}

function StepItem({
  number,
  text,
}: {
  number: string;
  text: string;
}) {
  return (
    <View style={styles.stepItem}>
      <View style={styles.stepItemNumber}>
        <Text style={styles.stepItemNumberText}>{number}</Text>
      </View>
      <Text style={styles.stepItemText}>{text}</Text>
    </View>
  );
}

// ============================================
// ETAPAS
// ============================================

function Step1({ onNext }: { onNext: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.stepContent}>
      <StepHeader
        step={1}
        title="Receba automaticamente pelas suas vendas"
        subtitle="Conheça o Asaas — sua plataforma de pagamentos"
      />

      <Text style={styles.stepEmoji}>💳</Text>

      <Text style={styles.bodyText}>
        O Asaas é uma plataforma de pagamentos 100% brasileira que vai depositar
        sua comissão diretamente na sua conta — sem precisar pedir nada para nós.
      </Text>

      <Text style={styles.bodyText}>
        Cada venda que você fizer no Lumina, sua parte cai automaticamente na
        sua carteira Asaas.
      </Text>

      <View style={styles.cardsGrid}>
        <InfoCard icon="✅" text="Gratuito para criadores" />
        <InfoCard icon="✅" text="Funciona com CPF" />
        <InfoCard icon="✅" text="Saque via Pix" />
        <InfoCard icon="✅" text="100% seguro" />
      </View>

      <ActionButton label="Próximo →" onPress={onNext} />
    </ScrollView>
  );
}

function Step2({ onNext }: { onNext: () => void }) {
  function openAsaas() {
    Linking.openURL(ASAAS_INVITE_URL).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o link. Acesse: sandbox.asaas.com');
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.stepContent}>
      <StepHeader
        step={2}
        title="Crie sua conta no Asaas"
        subtitle="É rápido e gratuito"
      />

      <StepItem
        number="1"
        text="Acesse o Asaas pelo botão abaixo — você vai criar uma conta gratuita"
      />

      <TouchableOpacity style={styles.openLinkButton} onPress={openAsaas}>
        <Text style={styles.openLinkButtonText}>🔗 Criar conta no Asaas</Text>
      </TouchableOpacity>

      <StepItem number="2" text="Preencha seus dados com CPF e e-mail" />
      <StepItem number="3" text="Acesse seu e-mail e confirme sua conta clicando no link enviado" />
      <StepItem number="4" text="Pronto! Sua conta está criada" />

      <View style={styles.tipBox}>
        <Text style={styles.tipText}>
          💡 Use o mesmo e-mail que você usa no Lumina para facilitar.
        </Text>
      </View>

      <ActionButton label="Já tenho conta — Próximo →" onPress={onNext} />
      <ActionButton label="Criar conta agora" onPress={openAsaas} secondary />
    </ScrollView>
  );
}

function Step3({ onNext }: { onNext: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.stepContent}>
      <StepHeader
        step={3}
        title="Encontre seu Wallet ID"
        subtitle="Siga o passo a passo abaixo"
      />

      <StepItem
        number="1"
        text='No painel do Asaas, clique no seu nome no canto superior direito'
      />
      <StepItem number="2" text='Selecione "Minha Conta"' />
      <StepItem number="3" text='Clique em "Dados da Conta"' />
      <StepItem number="4" text='Copie o "ID da Carteira" (Wallet ID)' />

      <View style={styles.walletIdExample}>
        <Text style={styles.walletIdExampleLabel}>Parece com isso:</Text>
        <Text style={styles.walletIdExampleValue}>
          xxxxxxxx-xxxx-xxxx-{'\n'}xxxx-xxxxxxxxxxxx
        </Text>
      </View>

      <View style={styles.tipBox}>
        <Text style={styles.tipText}>
          💡 Mantenha o Asaas aberto em outra aba para copiar o ID com facilidade.
        </Text>
      </View>

      <ActionButton label="Encontrei meu Wallet ID →" onPress={onNext} />
    </ScrollView>
  );
}

function Step4({
  walletId,
  onChangeWalletId,
  onNext,
}: {
  walletId: string;
  onChangeWalletId: (v: string) => void;
  onNext: () => void;
}) {
  async function handlePaste() {
    try {
      const text = await Clipboard.getString();
      if (text) onChangeWalletId(text.trim());
    } catch {
      Alert.alert('Erro', 'Não foi possível colar. Cole manualmente no campo.');
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.stepContent}>
        <StepHeader
          step={4}
          title="Cole seu Wallet ID"
          subtitle="Copie do painel do Asaas e cole aqui"
        />

        <TextInput
          style={styles.walletInput}
          value={walletId}
          onChangeText={onChangeWalletId}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          placeholderTextColor={colors.gray}
          autoCapitalize="none"
          autoCorrect={false}
          multiline={false}
        />

        <TouchableOpacity style={styles.pasteButton} onPress={handlePaste}>
          <Text style={styles.pasteButtonText}>📋 Colar da área de transferência</Text>
        </TouchableOpacity>

        <View style={styles.tipBox}>
          <Text style={styles.tipText}>
            🔒 Seu Wallet ID é usado apenas para enviar sua comissão.
            Nunca compartilhamos seus dados.
          </Text>
        </View>

        <ActionButton
          label="Verificar Conta →"
          onPress={onNext}
          disabled={!walletId.trim()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
// Adicionar ANTES de "function Step5("
type VerifyStatus = 'validating' | 'success' | 'error';

function Step5({
  walletId,
  onSuccess,
  onError,
}: {
  walletId: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [status, setStatus] = useState<VerifyStatus>('validating');
  const [errorMsg, setErrorMsg] = useState('');
  const [accountName, setAccountName] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  React.useEffect(() => {
    runVerification();
  }, []);

  async function runVerification() {
    setStatus('validating');
    setErrorMsg('');
    setAccountName(null);

    // Chama Cloud Function (valida formato + Asaas + cache 24h)
    const result = await verifyAsaasWalletViaApi(walletId);

    if (!result.valid) {
      setStatus('error');
      setErrorMsg(result.error ?? 'Wallet ID inválido');
      onError(result.error ?? 'Wallet ID inválido');
      return;
    }

    // Sucesso — Cloud Function já salvou no Firestore
    setAccountName(result.accountName ?? null);
    setIsCached(result.cached ?? false);
    setStatus('success');
    setTimeout(onSuccess, 2000);
  }

  return (
    <View style={styles.stepContent}>
      <StepHeader step={5} title="Verificando sua conta..." />

      <View style={styles.verifyingContainer}>
        {status === 'validating' && (
          <>
            <ActivityIndicator color={colors.gold} size="large" />
            <Text style={styles.verifyingText}>🔍 Verificando com o Asaas...</Text>
            <Text style={[styles.verifyingText, { fontSize: fonts.sizes.xs, marginTop: spacing.xs }]}>
              Isso pode levar alguns segundos
            </Text>
          </>
        )}

        {status === 'success' && (
          <View style={{ alignItems: 'center', gap: spacing.md }}>
            <Text style={styles.verifyingSuccess}>✅ Conta verificada!</Text>
            {accountName ? (
              <View style={styles.accountNameBox}>
                <Text style={styles.accountNameLabel}>Conta encontrada:</Text>
                <Text style={styles.accountNameValue}>{accountName}</Text>
              </View>
            ) : null}
            {isCached && (
              <Text style={styles.cachedText}>Verificação em cache (24h)</Text>
            )}
          </View>
        )}

        {status === 'error' && (
          <>
            <Text style={styles.verifyingError}>❌ {errorMsg}</Text>
            <ActionButton
              label="Tentar novamente"
              onPress={runVerification}
            />
          </>
        )}
      </View>
    </View>
  );
}

function Step6({ onFinish }: { onFinish: () => void }) {
  const navigation = useNavigation<NavProp>();

  return (
    <ScrollView contentContainerStyle={styles.stepContent}>
      <StepHeader step={6} title="Tudo configurado!" />

      <Text style={styles.successEmoji}>🎉</Text>

      <Text style={styles.successTitle}>Seus recebimentos estão configurados!</Text>

      <Text style={styles.bodyText}>
        A partir de agora, sua comissão por cada venda será enviada
        automaticamente para sua conta Asaas.
      </Text>

      <Text style={styles.bodyText}>
        Você pode acompanhar todos os seus ganhos na tela "Meus Ganhos".
      </Text>

      <View style={styles.cardsGrid}>
        <InfoCard icon="💰" text="Ganhos automáticos" />
        <InfoCard icon="📊" text="Histórico completo" />
        <InfoCard icon="⚡" text="Saque via Pix" />
        <InfoCard icon="🔒" text="100% seguro" />
      </View>

      <ActionButton label="Ir para Meus Ganhos" onPress={onFinish} />
      <ActionButton
        label="Voltar ao Perfil"
        onPress={() => navigation.goBack()}
        secondary
      />
    </ScrollView>
  );
}

// ============================================
// FAQ
// ============================================

const FAQ_ITEMS = [
  {
    q: 'Preciso de CNPJ?',
    a: 'Não! O Asaas funciona perfeitamente com CPF. Qualquer pessoa pode criar uma conta.',
  },
  {
    q: 'Posso usar CPF?',
    a: 'Sim! CPF é aceito normalmente. Basta criar a conta no Asaas com seu CPF.',
  },
  {
    q: 'Como recebo minhas vendas?',
    a: 'Automaticamente. Cada venda aprovada envia sua comissão direto para sua carteira Asaas.',
  },
  {
    q: 'Quanto tempo demora para receber?',
    a: 'Assim que o pagamento do comprador for confirmado, o valor aparece na sua carteira.',
  },
  {
    q: 'Posso trocar minha conta Asaas depois?',
    a: 'Sim! Basta voltar nesta tela e configurar novamente com o novo Wallet ID.',
  },
  {
    q: 'O Asaas cobra alguma taxa?',
    a: 'Não para receber. O Asaas pode cobrar uma pequena taxa ao fazer saques via Pix.',
  },
];

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <View style={styles.faqSection}>
      <Text style={styles.faqTitle}>Dúvidas frequentes</Text>
      {FAQ_ITEMS.map((item, i) => (
        <TouchableOpacity
          key={i}
          style={styles.faqItem}
          onPress={() => setOpenIndex(openIndex === i ? null : i)}
          activeOpacity={0.8}
        >
          <View style={styles.faqQuestion}>
            <Text style={styles.faqQuestionText}>{item.q}</Text>
            <Text style={styles.faqArrow}>{openIndex === i ? '▲' : '▼'}</Text>
          </View>
          {openIndex === i && (
            <Text style={styles.faqAnswer}>{item.a}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ============================================
// TELA PRINCIPAL
// ============================================

export default function PaymentSetupScreen() {
  const navigation = useNavigation<NavProp>();
  const [step, setStep] = useState(1);
  const [walletId, setWalletId] = useState('');
  const [verifyError, setVerifyError] = useState('');

  function goNext() {
    setStep(prev => Math.min(prev + 1, TOTAL_STEPS));
  }

  function goBack() {
    if (step === 1) {
      navigation.goBack();
    } else {
      setStep(prev => prev - 1);
    }
  }

  function handleFinish() {
  navigation.navigate('MyEarnings'); // ← era goBack()
}

  function handleVerifyError(msg: string) {
    setVerifyError(msg);
  }

  function handleRetry() {
    setStep(4);
    setVerifyError('');
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configurar Recebimentos</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Conteúdo por etapa */}
      {step === 1 && <Step1 onNext={goNext} />}
      {step === 2 && <Step2 onNext={goNext} />}
      {step === 3 && <Step3 onNext={goNext} />}
      {step === 4 && (
        <Step4
          walletId={walletId}
          onChangeWalletId={setWalletId}
          onNext={goNext}
        />
      )}
      {step === 5 && (
        <Step5
          walletId={walletId}
          onSuccess={goNext}
          onError={handleVerifyError}
        />
      )}
      {step === 6 && <Step6 onFinish={handleFinish} />}

      {/* FAQ — só nas primeiras etapas */}
      {step <= 3 && <FAQSection />}
    </View>
  );
}

// ============================================
// ESTILOS
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.gold + '44',
  },
  backButton: {
    width: 40,
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.gold,
    fontSize: 28,
  },
  headerTitle: {
    color: colors.white,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.grayDark,
  },
  stepDotActive: {
    backgroundColor: colors.gold,
    width: 20,
  },
  stepDotCompleted: {
    backgroundColor: colors.gold + '88',
  },
  stepContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  stepHeader: {
    marginBottom: spacing.lg,
  },
  stepLabel: {
    color: colors.gold,
    fontSize: fonts.sizes.sm,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stepTitle: {
    color: colors.white,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
  },
  stepEmoji: {
    fontSize: 64,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  successEmoji: {
    fontSize: 80,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  successTitle: {
    color: colors.white,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  bodyText: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold + '33',
    padding: spacing.md,
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoCardIcon: {
    fontSize: 16,
  },
  infoCardText: {
    color: colors.white,
    fontSize: fonts.sizes.sm,
    flex: 1,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  stepItemNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepItemNumberText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: fonts.sizes.sm,
  },
  stepItemText: {
    color: colors.white,
    fontSize: fonts.sizes.md,
    flex: 1,
    lineHeight: 20,
  },
  openLinkButton: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  openLinkButtonText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: fonts.sizes.md,
  },
  tipBox: {
    backgroundColor: colors.gold + '11',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold + '44',
    padding: spacing.md,
    marginVertical: spacing.md,
  },
  tipText: {
    color: colors.gold,
    fontSize: fonts.sizes.sm,
    lineHeight: 20,
  },
  walletIdExample: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
    padding: spacing.md,
    marginVertical: spacing.md,
    alignItems: 'center',
  },
  walletIdExampleLabel: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.xs,
  },
  walletIdExampleValue: {
    color: colors.white,
    fontSize: fonts.sizes.md,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  walletInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold + '66',
    padding: spacing.md,
    color: colors.white,
    fontSize: fonts.sizes.md,
    fontFamily: 'monospace',
    marginBottom: spacing.md,
  },
  pasteButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pasteButtonText: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
  },
  verifyingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.lg,
  },
  verifyingText: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
  },
  verifyingSuccess: {
    color: colors.gold,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
  },
  verifyingError: {
    color: colors.error,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  actionButton: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  actionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.gold + '66',
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionButtonText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: fonts.sizes.md,
  },
  actionButtonTextSecondary: {
    color: colors.gold,
  },
  faqSection: {
    padding: spacing.lg,
    borderTopWidth: 0.5,
    borderTopColor: colors.grayDark,
    marginTop: spacing.md,
  },
  faqTitle: {
    color: colors.white,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  faqItem: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestionText: {
    color: colors.white,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    flex: 1,
  },
  faqArrow: {
    color: colors.gold,
    fontSize: fonts.sizes.sm,
  },
  faqAnswer: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  accountNameBox: {
  backgroundColor: colors.gold + '11',
  borderRadius: borderRadius.md,
  borderWidth: 1,
  borderColor: colors.gold + '33',
  padding: spacing.md,
  alignItems: 'center',
  gap: spacing.xs,
},
accountNameLabel: {
  color: colors.gray,
  fontSize: fonts.sizes.sm,
},
accountNameValue: {
  color: colors.white,
  fontSize: fonts.sizes.md,
  fontWeight: 'bold',
},
cachedText: {
  color: colors.gray,
  fontSize: fonts.sizes.xs,
  fontStyle: 'italic',
},
});