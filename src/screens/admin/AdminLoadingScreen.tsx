import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated,
  Dimensions, StatusBar,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT , colors } from '../../theme/tokens';
import ScreenContainer from '../../components/ScreenContainer';

const { width, height } = Dimensions.get('window');

const STATUS_STEPS = [
  { label: 'Autenticando SuperAdmin', icon: '🔐' },
  { label: 'Carregando métricas', icon: '📊' },
  { label: 'Sincronizando alertas', icon: '🚨' },
  { label: 'Verificando transações', icon: '💳' },
  { label: 'Painel seguro ativado', icon: '✅' },
];

const ADMIN_TIPS = [
  // SAQUES
  { icon: '💸', category: 'Saques', tip: 'Sempre verifique o histórico do criador antes de aprovar um saque. Padrões de saque imediatamente após venda podem indicar tentativa de fraude.' },
  { icon: '💸', category: 'Saques', tip: 'Saques acima de R$ 500 merecem atenção especial. Confirme que o saldo disponível é real e que não há chargebacks pendentes associados.' },
  { icon: '💸', category: 'Saques', tip: 'Criadores novos (menos de 30 dias) com saques altos devem ser monitorados. Priorize os com histórico positivo de avaliações.' },
  // FRAUDE
  { icon: '🔍', category: 'Fraude', tip: 'Usuários com mais de 3 reembolsos em 30 dias são suspeitos de abuso. Bloqueie temporariamente e analise o padrão de compras.' },
  { icon: '🔍', category: 'Fraude', tip: 'Compras feitas logo após criação de conta com reembolso imediato são sinal clássico de fraude de cartão. Sinalizar para análise manual.' },
  { icon: '🔍', category: 'Fraude', tip: 'Múltiplas contas com o mesmo IP ou dispositivo comprando os mesmos produtos indicam fraude coordenada. Verifique fraudFlags.' },
  { icon: '🔍', category: 'Fraude', tip: 'Avaliações com texto idêntico em produtos diferentes podem indicar manipulação de reputação. Oculte e investigue o criador.' },
  // DRM / SCREENSHOTS
  { icon: '📸', category: 'DRM iOS', tip: 'Usuários com 4+ screenshots sinalizados devem ser banidos rapidamente para proteger os criadores. Cada minuto de acesso é conteúdo em risco.' },
  { icon: '📸', category: 'DRM iOS', tip: 'O sistema detecta prints no iOS mas não bloqueia — por limitação da Apple. O Android bloqueia 100%. Priorize casos iOS na fila de análise.' },
  { icon: '📸', category: 'DRM iOS', tip: 'Ao banir por screenshot, informe sempre o motivo detalhado. Isso protege a Lumina de questionamentos jurídicos do usuário.' },
  // CRIADORES
  { icon: '👤', category: 'Criadores', tip: 'Ao aprovar um criador, confirme que o perfil está 100% completo: foto, bio, cidade e preferências. Perfis incompletos geram desconfiança nos compradores.' },
  { icon: '👤', category: 'Criadores', tip: 'Criadores com avaliação média abaixo de 3.0 devem ser monitorados. Muitas avaliações negativas em sequência podem indicar conteúdo enganoso.' },
  { icon: '👤', category: 'Criadores', tip: 'Ao rejeitar uma solicitação de criador, sempre forneça um motivo claro e construtivo. Isso aumenta a taxa de resubmissão qualificada.' },
  // PRODUTOS
  { icon: '📦', category: 'Produtos', tip: 'Produtos com título genérico, sem descrição ou com menos de 1 arquivo devem ser rejeitados com feedback detalhado para o criador.' },
  { icon: '📦', category: 'Produtos', tip: 'Antes de aprovar um produto, verifique se o preço é compatível com o conteúdo anunciado. Preços muito baixos para conteúdo exclusivo podem ser isco.' },
  { icon: '📦', category: 'Produtos', tip: 'Produtos da mesma categoria com títulos muito similares podem indicar duplicatas ou plágio. Compare os criadores e conteúdos antes de aprovar.' },
  // VELOCIDADE
  { icon: '⚡', category: 'Velocidade', tip: 'Solicitações de criador e reembolsos devem ser respondidos em até 24h para manter a confiança. Atrasos geram reclamações e chargebacks.' },
  { icon: '⚡', category: 'Velocidade', tip: 'Durante horários de pico (18h-22h), o volume de transações aumenta. Programe revisões matutinas para processar saques do dia anterior.' },
  // SEGURANÇA
  { icon: '🛡️', category: 'Segurança', tip: 'Nunca aprove saques fora do sistema. Todo movimento financeiro deve passar pela Cloud Function para garantir auditoria completa.' },
  { icon: '🛡️', category: 'Segurança', tip: 'Sua conta de SuperAdmin nunca deve ser compartilhada. Em caso de suspeita de acesso indevido, comunique imediatamente para remoção do adminConfig.' },
  { icon: '🛡️', category: 'Segurança', tip: 'Todas as ações são registradas em auditLogs com timestamp e IP. Qualquer operação suspeita pode ser rastreada e auditada posteriormente.' },
  // MÉTRICAS
  { icon: '📊', category: 'Métricas', tip: 'Os dados de adminMetrics são cache atualizado pelas Cloud Functions. Para dados precisos em tempo real, consulte as collections diretamente no Firestore.' },
  { icon: '📊', category: 'Métricas', tip: 'Uma queda brusca nas vendas pode indicar problema técnico, não apenas mercado. Verifique se as Cloud Functions estão respondendo corretamente.' },
  // REEMBOLSOS
  { icon: '↩️', category: 'Reembolsos', tip: 'Reembolsos têm janela de 24h para o comprador solicitar. Após esse prazo, o sistema bloqueia automaticamente a solicitação.' },
  { icon: '↩️', category: 'Reembolsos', tip: 'Ao aprovar um reembolso, o saldo do criador é debitado automaticamente. Verifique se ele tem saldo suficiente para não gerar inconsistência.' },
  { icon: '↩️', category: 'Reembolsos', tip: 'Reembolsos aprovados sem integração Asaas ativa precisam de estorno manual. Documente cada caso no adminNotes para controle financeiro.' },
  // USUÁRIOS
  { icon: '👥', category: 'Usuários', tip: 'Antes de bloquear definitivamente, considere um aviso formal. Bloqueios permanentes devem ser reservados para violações graves e repetidas.' },
  { icon: '👥', category: 'Usuários', tip: 'Ao desbloquear um usuário, registre o motivo da liberação. Isso cria histórico para futuras análises e protege a decisão administrativamente.' },
  // FINANCEIRO
  { icon: '💰', category: 'Financeiro', tip: 'A comissão atual é de 20%. Qualquer alteração impacta todos os criadores. Mudanças devem ser feitas em appSettings/config com muito cuidado.' },
  { icon: '💰', category: 'Financeiro', tip: 'O saldo mínimo para saque é R$ 50. Criadores que solicitam abaixo disso indicam bug ou tentativa de burlar o sistema. Investigue.' },
];

interface Props {
  onFinish: () => void;
}

export default function AdminLoadingScreen({ onFinish }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [currentTip, setCurrentTip] = useState(ADMIN_TIPS[0]);
  const [tipQueue, setTipQueue] = useState<typeof ADMIN_TIPS>([]);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const tipFadeAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;

  // Embaralha tips garantindo aleatoriedade real
  const shuffleTips = useCallback(() => {
    return [...ADMIN_TIPS].sort(() => Math.random() - 0.5);
  }, []);

  useEffect(() => {
    setTipQueue(shuffleTips());
  }, []);

  useEffect(() => {
    if (tipQueue.length > 0) {
      setCurrentTip(tipQueue[0]);
    }
  }, [tipQueue]);

  useEffect(() => {
    StatusBar.setBarStyle('light-content');

    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Pulso coroa
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();

    // Glow dourado
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Scanner animado
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();

    // Rotação de tips aleatória
    let tipIndex = 0;
    const shuffled = shuffleTips();
    const tipInterval = setInterval(() => {
      Animated.timing(tipFadeAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        tipIndex = (tipIndex + 1) % shuffled.length;
        // Re-embaralha quando termina o ciclo
        if (tipIndex === 0) {
          const reshuffled = shuffleTips();
          setCurrentTip(reshuffled[0]);
        } else {
          setCurrentTip(shuffled[tipIndex]);
        }
        Animated.timing(tipFadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      });
    }, 3000);

    // Progresso
    let step = 0;
    const stepInterval = setInterval(() => {
      if (step < STATUS_STEPS.length - 1) {
        setCompletedSteps(prev => [...prev, step]);
        step++;
        setCurrentStep(step);
        Animated.timing(progressAnim, {
          toValue: (step / (STATUS_STEPS.length - 1)) * (width - SPACING.xl * 2),
          duration: 500,
          useNativeDriver: false,
        }).start();
      } else {
        setCompletedSteps(prev => [...prev, step]);
        Animated.timing(progressAnim, {
          toValue: width - SPACING.xl * 2,
          duration: 500,
          useNativeDriver: false,
        }).start();
        clearInterval(stepInterval);
        clearInterval(tipInterval);
        setTimeout(() => onFinish(), 1500);
      }
    }, 1700);

    return () => {
      clearInterval(stepInterval);
      clearInterval(tipInterval);
    };
  }, []);

  const scanTranslate = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, height * 0.5],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0.3, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <ScreenContainer>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <StatusBar backgroundColor="#050505" barStyle="light-content" />

        {/* Fundo com grade */}
        <View style={styles.gridOverlay} />

        {/* Scanner animado */}
        <Animated.View style={[
          styles.scanLine,
          { transform: [{ translateY: scanTranslate }] },
        ]} />

        {/* Glow dourado de fundo */}
        <Animated.View style={[styles.glowCircle, { opacity: glowOpacity }]} />

        {/* Cantos decorativos */}
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />

        {/* Conteúdo principal */}
        <View style={styles.content}>

          {/* Ícone + título */}
          <Animated.Text style={[styles.crownIcon, { transform: [{ scale: pulseAnim }] }]}>
            👑
          </Animated.Text>

          <Text style={styles.title}>SUPER ADMIN</Text>
          <View style={styles.titleUnderline} />
          <Text style={styles.subtitle}>LUMINA · ACESSO NÍVEL MÁXIMO</Text>

          {/* Divisor */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerDot}>◆</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Steps de carregamento */}
          <View style={styles.stepsContainer}>
            {STATUS_STEPS.map((step, index) => {
              const isCompleted = completedSteps.includes(index);
              const isCurrent = currentStep === index && !isCompleted;
              return (
                <View key={index} style={styles.stepRow}>
                  <View style={[
                    styles.stepDot,
                    isCompleted && styles.stepDotCompleted,
                    isCurrent && styles.stepDotActive,
                  ]} />
                  <Text style={[
                    styles.stepLabel,
                    isCompleted && styles.stepLabelCompleted,
                    isCurrent && styles.stepLabelActive,
                  ]}>
                    {isCompleted ? `✓  ${step.label}` : isCurrent ? `▶  ${step.label}` : `○  ${step.label}`}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Barra de progresso */}
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressAnim }]}>
              <View style={styles.progressGlow} />
            </Animated.View>
          </View>

          {/* Divisor */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerDot}>◆</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Card de dica */}
          <Animated.View style={[styles.tipCard, { opacity: tipFadeAnim }]}>
            <View style={styles.tipTopBar} />
            <View style={styles.tipHeader}>
              <Text style={styles.tipIcon}>{currentTip.icon}</Text>
              <View>
                <Text style={styles.tipCategoryLabel}>DICA · {currentTip.category.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.tipText}>{currentTip.tip}</Text>
            <View style={styles.tipBottomBar} />
          </Animated.View>

        </View>

        {/* Rodapé */}
        <View style={styles.footer}>
          <View style={styles.footerDot} />
          <Text style={styles.footerText}>SESSÃO CRIPTOGRAFADA · AUDIT ATIVO</Text>
          <View style={styles.footerDot} />
        </View>
      </Animated.View>
    </ScreenContainer>
  );
}

const GRID_SIZE = 40;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Grade de fundo
  gridOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.04,
    borderWidth: 0,
    // Grid via bordas repetidas
    backgroundColor: 'transparent',
  },

  // Scanner
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.gold,
    opacity: 0.15,
    zIndex: 1,
  },

  // Glow
  glowCircle: {
    position: 'absolute',
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    backgroundColor: COLORS.gold,
    opacity: 0.04,
    top: height * 0.1,
  },

  // Cantos decorativos
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: COLORS.gold,
    opacity: 0.6,
  },
  cornerTL: { top: 24, left: 24, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  cornerTR: { top: 24, right: 24, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  cornerBL: { bottom: 24, left: 24, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  cornerBR: { bottom: 24, right: 24, borderBottomWidth: 1.5, borderRightWidth: 1.5 },

  // Conteúdo
  content: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },

  crownIcon: {
    fontSize: 56,
    marginBottom: SPACING.sm,
  },

  title: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.xxl,
    fontWeight: '900',
    letterSpacing: 8,
    marginBottom: SPACING.xs,
  },

  titleUnderline: {
    width: 60,
    height: 1.5,
    backgroundColor: COLORS.gold,
    opacity: 0.6,
    marginBottom: SPACING.xs,
  },

  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 9,
    letterSpacing: 3.5,
    marginBottom: SPACING.md,
  },

  // Divisor
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: SPACING.md,
    gap: SPACING.sm,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: COLORS.border,
  },
  dividerDot: {
    color: COLORS.gold,
    fontSize: 8,
    opacity: 0.6,
  },

  // Steps
  stepsContainer: {
    width: '100%',
    gap: 6,
    marginBottom: SPACING.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  stepDotActive: {
    backgroundColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  stepDotCompleted: {
    backgroundColor: COLORS.success,
  },
  stepLabel: {
    color: '#333',
    fontSize: FONT_SIZE.xs,
    letterSpacing: 0.5,
    fontFamily: 'monospace' as any,
  },
  stepLabelActive: {
    color: COLORS.gold,
    fontWeight: FONT_WEIGHT.bold,
  },
  stepLabelCompleted: {
    color: '#555',
  },

  // Progress
  progressTrack: {
    width: '100%',
    height: 2,
    backgroundColor: '#111',
    borderRadius: 1,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
    backgroundColor: COLORS.gold,
    borderRadius: 1,
  },
  progressGlow: {
    position: 'absolute',
    right: 0,
    top: -2,
    width: 12,
    height: 6,
    backgroundColor: COLORS.gold,
    borderRadius: 3,
    opacity: 0.6,
    shadowColor: COLORS.gold,
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 6,
  },

  // Card de dica
  tipCard: {
    width: '100%',
    backgroundColor: '#0D0D0D',
    borderWidth: 0.5,
    borderColor: COLORS.gold + '40',
    borderRadius: 4,
    padding: SPACING.md,
    paddingTop: SPACING.sm,
  },
  tipTopBar: {
    height: 1,
    backgroundColor: COLORS.gold,
    opacity: 0.4,
    marginBottom: SPACING.sm,
    width: 40,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  tipIcon: {
    fontSize: FONT_SIZE.xxl,
  },
  tipCategoryLabel: {
    color: COLORS.gold,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: FONT_WEIGHT.bold,
  },
  tipText: {
    color: colors.gray,
    fontSize: FONT_SIZE.xs + 1,
    lineHeight: 18,
    letterSpacing: 0.3,
  },
  tipBottomBar: {
    height: 1,
    backgroundColor: COLORS.gold,
    opacity: 0.2,
    marginTop: SPACING.sm,
    alignSelf: 'flex-end',
    width: 20,
  },

  // Rodapé
  footer: {
    position: 'absolute',
    bottom: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  footerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.gold,
    opacity: 0.4,
  },
  footerText: {
    color: '#333',
    fontSize: 8,
    letterSpacing: 2.5,
  },
});
