import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet,
  ActivityIndicator, Alert, Image, ScrollView,
  Clipboard, AppState, AppStateStatus,
} from 'react-native';
import { Button, Card } from '../../components/ui';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS , alpha} from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import ScreenContainer from '../../components/ScreenContainer';

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
    if (!saleId)                return;

    const saleRef = doc(db, 'sales', saleId);
    unsubscribeRef.current = onSnapshot(
      saleRef,
      (snap) => {
        if (!snap.exists()) return;
        handleStatusChange(snap.data()?.status as string);
      },
      (error) => console.error('[CheckoutScreen] Listener error:', error)
    );
  }, [saleId, handleStatusChange]);

  useEffect(() => {
    if (!saleId) {
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
      <ScreenContainer>
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>Pagamento</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.bigIcon}>✅</Text>
          <Text style={styles.successTitle}>Pagamento confirmado!</Text>
          <Button label="Ver Minhas Compras" onPress={() => navigation.navigate('MyPurchases')} variant="primary" fullWidth />
        </View>
      </ScreenContainer>
    );
  }

  if (saleStatus === 'overdue' || saleStatus === 'refunded' || saleStatus === 'cancelled') {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Pagamento</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.bigIcon}>❌</Text>
          <Text style={styles.errorTitle}>
            {saleStatus === 'overdue' ? 'Pagamento expirado' : 'Pagamento cancelado'}
          </Text>
          <Button label="Voltar" onPress={() => navigation.goBack()} variant="primary" fullWidth />
        </View>
      </ScreenContainer>
    );
  }

  const hasQr = !!pixQrCode;
  const hasCopyPaste = !!pixCopyPaste;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Button label="‹" variant="ghost" onPress={handleBack} />
        <Text style={styles.headerTitle}>Pagamento via Pix</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusRow}>
          <ActivityIndicator color={COLORS.gold} size="small" />
          <Text style={styles.statusText}>Aguardando pagamento...</Text>
        </View>

        {hasQr ? (
          <View style={styles.qrSection}>
            <Text style={styles.qrLabel}>Escaneie o QR Code no seu app de pagamento</Text>
            <View style={styles.qrWrapper}>
              <Image source={{ uri: `data:image/png;base64,${pixQrCode}` }} style={styles.qrImage} resizeMode="contain" />
            </View>
          </View>
        ) : hasCopyPaste ? (
          <Card padding={SPACING.md} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
            <Text style={styles.noQrIcon}>ℹ️</Text>
            <Text style={styles.noQrText}>
              Você já tem um pagamento em aberto para este item. Use o código
              Pix "Copia e Cola" abaixo para concluir.
            </Text>
          </Card>
        ) : (
          <Card padding={SPACING.md} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
            <Text style={styles.noQrIcon}>⚠️</Text>
            <Text style={styles.noQrText}>
              Não foi possível carregar os dados do Pix. Volte e tente iniciar o
              pagamento novamente.
            </Text>
          </Card>
        )}

        {hasCopyPaste && (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{hasQr ? 'ou' : 'Pix Copia e Cola'}</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.copySection}>
              <Text style={styles.copyLabel}>Pix Copia e Cola</Text>
              <View style={styles.copyBox}>
                <Text style={styles.copyCode} numberOfLines={3}>{pixCopyPaste}</Text>
              </View>
              <Button
                label={copied ? '✅ Copiado!' : '📋 Copiar código Pix'}
                onPress={handleCopy}
                variant="primary"
                fullWidth
              />
            </View>
          </>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>⏱ A confirmação é automática após o Pix ser processado.</Text>
          <Text style={styles.infoText}>Não feche o app até receber a confirmação.</Text>
          <Text style={styles.infoText}>⚠️ O código expira em 15 minutos.</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.background },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',     paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: alpha(COLORS.gold, 0.27) },
  // backBtn removed — now uses Button
  headerTitle:   { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  content:       { padding: SPACING.md, paddingBottom: SPACING.xl * 2 },
  statusRow:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg, justifyContent: 'center' },
  statusText:    { color: COLORS.gold, fontSize: FONT_SIZE.body },
  qrSection:     { alignItems: 'center', marginBottom: SPACING.lg },
  qrLabel:       { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, textAlign: 'center', marginBottom: SPACING.md },
  qrWrapper:     { padding: SPACING.sm, backgroundColor: COLORS.textPrimary, borderRadius: BORDER_RADIUS.md },
  qrImage:       { width: 240, height: 240 },
  noQrIcon:      { fontSize: FONT_SIZE.xxl },
  noQrText:      { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, flex: 1, lineHeight: 18 },
  // noQrBox removed — now uses Card
  divider:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginVertical: SPACING.lg },
  dividerLine:   { flex: 1, height: 0.5, backgroundColor: COLORS.border },
  dividerText:   { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  copySection:   { marginBottom: SPACING.lg },
  copyLabel:     { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.sm },
  copyBox:       { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm },
  copyCode:      { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontFamily: 'monospace', lineHeight: 18 },
  // copyBtn/copyBtnSuccess/copyBtnText/copyBtnTextSuccess removed — now uses Button
  infoBox:       { backgroundColor: alpha(COLORS.gold, 0.07), borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: alpha(COLORS.gold, 0.2), padding: SPACING.md, gap: SPACING.xs },
  infoText:      { color: COLORS.gold, fontSize: FONT_SIZE.caption, lineHeight: 20 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.lg },
  bigIcon:       { fontSize: 80 },
  successTitle:  { color: COLORS.textPrimary, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  errorTitle:    { color: COLORS.textPrimary, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  // primaryBtn/primaryBtnText removed — now uses Button
});
