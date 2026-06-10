// ============================================
// CHECKOUT SCREEN — FASE 6B HARDENING
//
// Implementação completa:
// - QR Code Pix (base64)
// - Pix Copia e Cola
// - Polling via onSnapshot
// - AppState: pausa em background
// - Timeout: 15 minutos
// - Estados: pending, paid, overdue, refunded
// ============================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Image, ScrollView,
  Clipboard, AppState, AppStateStatus,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'Checkout'>;

type SaleStatus = 'loading' | 'pending' | 'paid' | 'overdue' | 'refunded' | 'cancelled';

const MAX_POLL_TIME = 15 * 60 * 1000; // 15 minutos

export default function CheckoutScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const { saleId, pixQrCode, pixCopyPaste } = route.params;

  const [saleStatus, setSaleStatus] = useState<SaleStatus>('loading');
  const [copied, setCopied] = useState(false);

  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const resolvedRef = useRef(false); // evita múltiplos alerts

  // ============================================
  // Para o listener
  // ============================================
  const stopListening = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);

  // ============================================
  // Processa mudança de status
  // ============================================
  const handleStatusChange = useCallback((status: string) => {
    setSaleStatus(status as SaleStatus);

    if (resolvedRef.current) return;

    if (status === 'paid') {
      resolvedRef.current = true;
      stopListening();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      Alert.alert(
        '✅ Pagamento confirmado!',
        'Seu conteúdo está disponível em Minhas Compras.',
        [{
          text: 'Ver agora',
          onPress: () => navigation.navigate('MyPurchases'),
        }]
      );
      return;
    }

    if (status === 'overdue') {
      resolvedRef.current = true;
      stopListening();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      Alert.alert(
        'Pagamento expirado',
        'O prazo para este pagamento expirou. Tente novamente.',
        [{ text: 'Voltar', onPress: () => navigation.goBack() }]
      );
      return;
    }

    if (status === 'refunded' || status === 'cancelled') {
      resolvedRef.current = true;
      stopListening();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      Alert.alert(
        'Pagamento cancelado',
        'Esta cobrança foi cancelada ou reembolsada.',
        [{ text: 'Voltar', onPress: () => navigation.goBack() }]
      );
    }
  }, [navigation, stopListening]);

  // ============================================
  // Inicia listener Firestore
  // ============================================
  const startListening = useCallback(() => {
    if (unsubscribeRef.current) return; // já está ouvindo
    if (resolvedRef.current) return;    // já resolvido

    const saleRef = doc(db, 'sales', saleId);
    unsubscribeRef.current = onSnapshot(
      saleRef,
      (snap) => {
        if (!snap.exists()) return;
        const status = snap.data()?.status as string;
        handleStatusChange(status);
      },
      (error) => {
        console.error('[CheckoutScreen] Erro no listener:', error);
      }
    );
  }, [saleId, handleStatusChange]);

  // ============================================
  // Setup: listener + timeout + AppState
  // ============================================
  useEffect(() => {
    // Iniciar listener
    startListening();

    // Timeout máximo 15 minutos
    timeoutRef.current = setTimeout(() => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      stopListening();
      Alert.alert(
        'Tempo expirado',
        'O tempo de espera pelo pagamento expirou. Tente novamente.',
        [{ text: 'Voltar', onPress: () => navigation.goBack() }]
      );
    }, MAX_POLL_TIME);

    // AppState — pausar em background, retomar em foreground
    const appStateSub = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        const prevState = appStateRef.current;
        appStateRef.current = nextState;

        if (nextState === 'active' && prevState !== 'active') {
          // Voltou para foreground → reativar listener
          startListening();
        } else if (nextState !== 'active' && prevState === 'active') {
          // Foi para background → pausar para economizar bateria
          stopListening();
        }
      }
    );

    return () => {
      stopListening();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      appStateSub.remove();
    };
  }, [startListening, stopListening, navigation]);

  // ============================================
  // Copiar código Pix
  // ============================================
  function handleCopy() {
    if (!pixCopyPaste) return;
    Clipboard.setString(pixCopyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // ============================================
  // Confirmar saída
  // ============================================
  function handleBack() {
    if (saleStatus === 'pending' || saleStatus === 'loading') {
      Alert.alert(
        'Sair do pagamento?',
        'O código Pix continuará válido. Você pode voltar mais tarde.',
        [
          { text: 'Continuar aqui', style: 'cancel' },
          { text: 'Sair', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  }

  // ============================================
  // RENDER — Pago
  // ============================================
  if (saleStatus === 'paid') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>Pagamento</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.bigIcon}>✅</Text>
          <Text style={styles.successTitle}>Pagamento confirmado!</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('MyPurchases')}
          >
            <Text style={styles.primaryBtnText}>Ver Minhas Compras</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ============================================
  // RENDER — Cancelado / Expirado
  // ============================================
  if (saleStatus === 'overdue' || saleStatus === 'refunded' || saleStatus === 'cancelled') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pagamento</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.bigIcon}>❌</Text>
          <Text style={styles.errorTitle}>
            {saleStatus === 'overdue' ? 'Pagamento expirado' : 'Pagamento cancelado'}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ============================================
  // RENDER — Aguardando pagamento
  // ============================================
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pagamento via Pix</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Status aguardando */}
        <View style={styles.statusRow}>
          <ActivityIndicator color={colors.gold} size="small" />
          <Text style={styles.statusText}>Aguardando pagamento...</Text>
        </View>

        {/* QR Code */}
        {pixQrCode ? (
          <View style={styles.qrSection}>
            <Text style={styles.qrLabel}>
              Escaneie o QR Code no seu app de pagamento
            </Text>
            <View style={styles.qrWrapper}>
              <Image
                source={{ uri: `data:image/png;base64,${pixQrCode}` }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            </View>
          </View>
        ) : (
          <View style={styles.qrPlaceholder}>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.qrPlaceholderText}>Carregando QR Code...</Text>
          </View>
        )}

        {/* Divisor */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Pix Copia e Cola */}
        {pixCopyPaste ? (
          <View style={styles.copySection}>
            <Text style={styles.copyLabel}>Pix Copia e Cola</Text>
            <View style={styles.copyBox}>
              <Text style={styles.copyCode} numberOfLines={3}>
                {pixCopyPaste}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.copyBtn, copied && styles.copyBtnSuccess]}
              onPress={handleCopy}
              activeOpacity={0.8}
            >
              <Text style={[styles.copyBtnText, copied && styles.copyBtnTextSuccess]}>
                {copied ? '✅ Copiado!' : '📋 Copiar código Pix'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            ⏱ A confirmação é automática após o Pix ser processado.
          </Text>
          <Text style={styles.infoText}>
            Não feche o app até receber a confirmação.
          </Text>
          <Text style={styles.infoText}>
            ⚠️ O código expira em 15 minutos.
          </Text>
        </View>
      </ScrollView>
    </View>
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
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },

  // Status
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.lg, justifyContent: 'center',
  },
  statusText: { color: colors.gold, fontSize: fonts.sizes.md },

  // QR Code
  qrSection: { alignItems: 'center', marginBottom: spacing.lg },
  qrLabel: {
    color: colors.gray, fontSize: fonts.sizes.sm,
    textAlign: 'center', marginBottom: spacing.md,
  },
  qrWrapper: {
    padding: spacing.sm, backgroundColor: colors.white,
    borderRadius: borderRadius.md,
  },
  qrImage: { width: 240, height: 240 },
  qrPlaceholder: {
    height: 240, alignSelf: 'center', justifyContent: 'center',
    alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg,
  },
  qrPlaceholderText: { color: colors.gray, fontSize: fonts.sizes.sm },

  // Divisor
  divider: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, marginVertical: spacing.lg,
  },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: colors.grayDark },
  dividerText: { color: colors.gray, fontSize: fonts.sizes.sm },

  // Copia e Cola
  copySection: { marginBottom: spacing.lg },
  copyLabel: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', marginBottom: spacing.sm },
  copyBox: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  copyCode: { color: colors.gray, fontSize: fonts.sizes.xs, fontFamily: 'monospace', lineHeight: 18 },
  copyBtn: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gold,
    padding: spacing.md, alignItems: 'center',
  },
  copyBtnSuccess: {
    borderColor: colors.success ?? '#4CAF50',
    backgroundColor: (colors.success ?? '#4CAF50') + '22',
  },
  copyBtnText: { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.md },
  copyBtnTextSuccess: { color: colors.success ?? '#4CAF50' },

  // Info
  infoBox: {
    backgroundColor: colors.gold + '11', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gold + '33',
    padding: spacing.md, gap: spacing.xs,
  },
  infoText: { color: colors.gold, fontSize: fonts.sizes.sm, lineHeight: 20 },

  // Telas de resultado
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  bigIcon: { fontSize: 80 },
  successTitle: { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold', textAlign: 'center' },
  errorTitle: { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold', textAlign: 'center' },
  primaryBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  primaryBtnText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
});