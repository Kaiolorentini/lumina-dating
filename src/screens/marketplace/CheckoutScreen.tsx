// ============================================
// LUMINA — CHECKOUT SCREEN v5.1
// src/screens/marketplace/CheckoutScreen.tsx
//
// CORREÇÃO: guard para saleId undefined
// doc(db, 'sales', saleId) só chamado se saleId existe
//
// v5.2 (14/10/2026, web T3) — RESUMO DO PEDIDO.
// A tela mostrava só o QR: a pessoa pagava sem ver o que estava
// comprando. Agora há o resumo (capa, título, valor e cupom), com
// os dados da PRÓPRIA venda que a tela já escuta (valor, cupom) e
// 1 leitura do produto (título e capa). Só exibição: o valor cobrado
// é o do Pix gerado pelo servidor — nada é recalculado aqui.
// No computador: QR e Copia e Cola à esquerda, resumo à direita.
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
import { getProduct } from '../../services/marketplace/productService';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface SaleSummary {
  productId:       string | null;
  amount:          number | null;
  originalAmount:  number | null;
  discountAmount:  number | null;
  couponCode:      string | null;
}

function numberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function brl(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

type NavProp    = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'Checkout'>;
type SaleStatus = 'loading' | 'pending' | 'paid' | 'overdue' | 'refunded' | 'cancelled';

const MAX_POLL_TIME = 15 * 60 * 1000;

export default function CheckoutScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteProps>();
  const { saleId, pixQrCode, pixCopyPaste } = route.params;

  const [saleStatus, setSaleStatus] = useState<SaleStatus>('loading');
  const [copied, setCopied]         = useState(false);
  const [sale, setSale]             = useState<SaleSummary | null>(null);
  const [product, setProduct]       = useState<{ title: string; cover: string } | null>(null);
  const { isDesktop } = useBreakpoint();

  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const timeoutRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef    = useRef<AppStateStatus>(AppState.currentState);
  const resolvedRef    = useRef(false);

  const stopListening = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);

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
        [{ text: 'Ver agora', onPress: () => navigation.navigate('MyPurchases') }]
      );
      return;
    }
    if (status === 'overdue') {
      resolvedRef.current = true;
      stopListening();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      Alert.alert('Pagamento expirado', 'O prazo expirou. Tente novamente.',
        [{ text: 'Voltar', onPress: () => navigation.goBack() }]);
      return;
    }
    if (status === 'refunded' || status === 'cancelled') {
      resolvedRef.current = true;
      stopListening();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      Alert.alert('Pagamento cancelado', 'Esta cobrança foi cancelada ou reembolsada.',
        [{ text: 'Voltar', onPress: () => navigation.goBack() }]);
    }
  }, [navigation, stopListening]);

  const startListening = useCallback(() => {
    if (unsubscribeRef.current) return;
    if (resolvedRef.current)    return;
    if (!saleId)                return; // guard — sem saleId não há o que ouvir

    const saleRef = doc(db, 'sales', saleId);
    unsubscribeRef.current = onSnapshot(
      saleRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setSale({
          productId:      typeof data?.productId === 'string' ? data.productId : null,
          amount:         numberOrNull(data?.finalAmount) ?? numberOrNull(data?.amount),
          originalAmount: numberOrNull(data?.originalAmount),
          discountAmount: numberOrNull(data?.discountAmount),
          couponCode:     typeof data?.couponCode === 'string' ? data.couponCode : null,
        });
        handleStatusChange(data?.status as string);
      },
      (error) => console.error('[CheckoutScreen] Listener error:', error)
    );
  }, [saleId, handleStatusChange]);

  useEffect(() => {
    if (!saleId) {
      // Sem saleId não conseguimos monitorar — mostra aviso e volta
      setSaleStatus('cancelled');
      return;
    }

    startListening();

    timeoutRef.current = setTimeout(() => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      stopListening();
      Alert.alert('Tempo expirado', 'O tempo de espera expirou. Tente novamente.',
        [{ text: 'Voltar', onPress: () => navigation.goBack() }]);
    }, MAX_POLL_TIME);

    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState === 'active' && prev !== 'active') startListening();
      else if (nextState !== 'active' && prev === 'active') stopListening();
    });

    return () => {
      stopListening();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      appStateSub.remove();
    };
  }, [startListening, stopListening, navigation, saleId]);

  // Título e capa do produto, uma vez por venda.
  const productId = sale?.productId ?? null;
  useEffect(() => {
    if (!productId) return;
    let alive = true;
    getProduct(productId)
      .then(p => { if (alive && p) setProduct({ title: p.title, cover: p.coverImage }); })
      .catch(error => console.warn('[CheckoutScreen] resumo do produto indisponível:', error));
    return () => { alive = false; };
  }, [productId]);

  function handleCopy() {
    if (!pixCopyPaste) return;
    Clipboard.setString(pixCopyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

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
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('MyPurchases')}>
            <Text style={styles.primaryBtnText}>Ver Minhas Compras</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pagamento via Pix</Text>
        <View style={{ width: 40 }} />
      </View>

      {isDesktop ? (
        <ScrollView contentContainerStyle={styles.dContent} showsVerticalScrollIndicator={false}>
          <View style={styles.statusRow}>
            <ActivityIndicator color={colors.gold} size="small" />
            <Text style={styles.statusText}>Aguardando pagamento...</Text>
          </View>
          <View style={styles.dRow}>
            <View style={styles.dPay}>
            {pixQrCode ? (
              <View style={styles.qrSection}>
                <Text style={styles.qrLabel}>Escaneie o QR Code no seu app de pagamento</Text>
                <View style={styles.qrWrapper}>
                  <Image source={{ uri: `data:image/png;base64,${pixQrCode}` }} style={styles.qrImage} resizeMode="contain" />
                </View>
              </View>
            ) : (
              // O QR chega junto com a resposta da CF ou não chega mais:
              // não há segunda requisição da tela. Um spinner aqui era
              // uma espera que nunca terminava — o caminho é apontar
              // para o Copia e Cola, que já está logo abaixo.
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrUnavailableIcon}>⎘</Text>
                <Text style={styles.qrUnavailableTitle}>QR Code indisponível</Text>
                <Text style={styles.qrPlaceholderText}>
                  Use o código Pix Copia e Cola abaixo para pagar.
                </Text>
              </View>
            )}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            {pixCopyPaste ? (
              <View style={styles.copySection}>
                <Text style={styles.copyLabel}>Pix Copia e Cola</Text>
                <View style={styles.copyBox}>
                  <Text style={styles.copyCode} numberOfLines={3}>{pixCopyPaste}</Text>
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
            </View>
            <View style={styles.dSide}>
            {(product || sale?.amount != null) && (
              <View style={styles.summary} accessibilityLabel="Resumo do pedido">
                <Text style={styles.summaryKicker}>RESUMO DO PEDIDO</Text>
                <View style={styles.summaryRow}>
                  {product?.cover ? (
                    <Image source={{ uri: product.cover }} style={styles.summaryCover} resizeMode="cover" />
                  ) : null}
                  <View style={styles.summaryInfo}>
                    <Text style={styles.summaryTitle} numberOfLines={2}>{product?.title ?? 'Conteúdo do marketplace'}</Text>
                    {sale?.couponCode && sale.discountAmount ? (
                      <Text style={styles.summaryCoupon}>
                        🎟️ {sale.couponCode} · −{brl(sale.discountAmount)}
                        {sale.originalAmount != null ? `  (de ${brl(sale.originalAmount)})` : ''}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {sale?.amount != null && (
                  <View style={styles.summaryTotal}>
                    <Text style={styles.summaryTotalLabel}>Total no Pix</Text>
                    <Text style={styles.summaryTotalValue}>{brl(sale.amount)}</Text>
                  </View>
                )}
              </View>
            )}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>⏱ A confirmação é automática após o Pix ser processado.</Text>
              <Text style={styles.infoText}>Não feche o app até receber a confirmação.</Text>
              <Text style={styles.infoText}>⚠️ O código expira em 15 minutos.</Text>
            </View>
            </View>
          </View>
        </ScrollView>
      ) : (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusRow}>
          <ActivityIndicator color={colors.gold} size="small" />
          <Text style={styles.statusText}>Aguardando pagamento...</Text>
        </View>

        {(product || sale?.amount != null) && (
          <View style={styles.summary} accessibilityLabel="Resumo do pedido">
            <Text style={styles.summaryKicker}>RESUMO DO PEDIDO</Text>
            <View style={styles.summaryRow}>
              {product?.cover ? (
                <Image source={{ uri: product.cover }} style={styles.summaryCover} resizeMode="cover" />
              ) : null}
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryTitle} numberOfLines={2}>{product?.title ?? 'Conteúdo do marketplace'}</Text>
                {sale?.couponCode && sale.discountAmount ? (
                  <Text style={styles.summaryCoupon}>
                    🎟️ {sale.couponCode} · −{brl(sale.discountAmount)}
                    {sale.originalAmount != null ? `  (de ${brl(sale.originalAmount)})` : ''}
                  </Text>
                ) : null}
              </View>
            </View>
            {sale?.amount != null && (
              <View style={styles.summaryTotal}>
                <Text style={styles.summaryTotalLabel}>Total no Pix</Text>
                <Text style={styles.summaryTotalValue}>{brl(sale.amount)}</Text>
              </View>
            )}
          </View>
        )}
        {pixQrCode ? (
          <View style={styles.qrSection}>
            <Text style={styles.qrLabel}>Escaneie o QR Code no seu app de pagamento</Text>
            <View style={styles.qrWrapper}>
              <Image source={{ uri: `data:image/png;base64,${pixQrCode}` }} style={styles.qrImage} resizeMode="contain" />
            </View>
          </View>
        ) : (
          // O QR chega junto com a resposta da CF ou não chega mais:
          // não há segunda requisição da tela. Um spinner aqui era
          // uma espera que nunca terminava — o caminho é apontar
          // para o Copia e Cola, que já está logo abaixo.
          <View style={styles.qrPlaceholder}>
            <Text style={styles.qrUnavailableIcon}>⎘</Text>
            <Text style={styles.qrUnavailableTitle}>QR Code indisponível</Text>
            <Text style={styles.qrPlaceholderText}>
              Use o código Pix Copia e Cola abaixo para pagar.
            </Text>
          </View>
        )}

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        {pixCopyPaste ? (
          <View style={styles.copySection}>
            <Text style={styles.copyLabel}>Pix Copia e Cola</Text>
            <View style={styles.copyBox}>
              <Text style={styles.copyCode} numberOfLines={3}>{pixCopyPaste}</Text>
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

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>⏱ A confirmação é automática após o Pix ser processado.</Text>
          <Text style={styles.infoText}>Não feche o app até receber a confirmação.</Text>
          <Text style={styles.infoText}>⚠️ O código expira em 15 minutos.</Text>
        </View>
      </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.background },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44' },
  backBtn:       { color: colors.gold, fontSize: 28 },
  headerTitle:   { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  content:       { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  statusRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg, justifyContent: 'center' },
  statusText:    { color: colors.gold, fontSize: fonts.sizes.md },
  qrSection:     { alignItems: 'center', marginBottom: spacing.lg },
  qrLabel:       { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center', marginBottom: spacing.md },
  qrWrapper:     { padding: spacing.sm, backgroundColor: colors.white, borderRadius: borderRadius.md },
  qrImage:       { width: 240, height: 240 },
  qrPlaceholder: { height: 240, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  qrPlaceholderText: { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center', paddingHorizontal: spacing.lg },
  qrUnavailableIcon: { fontSize: 40, color: colors.gray },
  qrUnavailableTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  divider:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.lg },
  dividerLine:   { flex: 1, height: 0.5, backgroundColor: colors.grayDark },
  dividerText:   { color: colors.gray, fontSize: fonts.sizes.sm },
  copySection:   { marginBottom: spacing.lg },
  copyLabel:     { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', marginBottom: spacing.sm },
  copyBox:       { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.sm },
  copyCode:      { color: colors.gray, fontSize: fonts.sizes.xs, fontFamily: 'monospace', lineHeight: 18 },
  copyBtn:       { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.gold, padding: spacing.md, alignItems: 'center' },
  copyBtnSuccess: { borderColor: '#4CAF50', backgroundColor: '#4CAF5022' },
  copyBtnText:   { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.md },
  copyBtnTextSuccess: { color: '#4CAF50' },
  infoBox:       { backgroundColor: colors.gold + '11', borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.gold + '33', padding: spacing.md, gap: spacing.xs },
  infoText:      { color: colors.gold, fontSize: fonts.sizes.sm, lineHeight: 20 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  bigIcon:       { fontSize: 80 },
  successTitle:  { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold', textAlign: 'center' },
  errorTitle:    { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold', textAlign: 'center' },
  primaryBtn:    { backgroundColor: colors.gold, borderRadius: borderRadius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  primaryBtnText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },

  // ── Resumo do pedido (v5.2) ──
  summary:       { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.gold + '44', padding: spacing.md, gap: spacing.sm, marginBottom: spacing.lg },
  summaryKicker: { color: colors.gray, fontSize: fonts.sizes.xs, fontWeight: 'bold', letterSpacing: 1 },
  summaryRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  summaryCover:  { width: 56, height: 70, borderRadius: borderRadius.sm, backgroundColor: colors.grayDark },
  summaryInfo:   { flex: 1, gap: 4 },
  summaryTitle:  { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  summaryCoupon: { color: '#4CAF50', fontSize: fonts.sizes.sm },
  summaryTotal:  { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.grayDark },
  summaryTotalLabel: { color: colors.gray, fontSize: fonts.sizes.sm },
  summaryTotalValue: { color: colors.gold, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  // ── Computador ──
  dContent:      { padding: 28, paddingBottom: 48 },
  dRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  dPay:          { flex: 1, minWidth: 0 },
  dSide:         { width: 340 },
});
