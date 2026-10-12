// ============================================
// LUMINA — FILA DE VERIFICAÇÃO DE IDADE
// src/screens/admin/AdminAgeVerificationScreen.tsx
//
// Difere das outras filas em três pontos:
//
// 1. Os dados vêm da CF listPendingVerifications, não de
//    um service: o documento users guarda email e
//    pushToken, que não devem sair do servidor. As imagens
//    chegam como URLs assinadas de 10 minutos.
//
// 2. A análise é feita na tela do questionário
//    (AdminAgeVerificationReview), aberta pelo botão
//    "📋 Analisar". 12/10/2026: os modais antigos de aprovar e
//    rejeitar SAÍRAM daqui — o servidor passou a exigir o
//    questionário, e eles deixariam de funcionar.
//
// 3. Só pendentes. Aprovadas e rejeitadas não têm aba
//    porque as imagens já foram apagadas e não há o que
//    revisar; o histórico fica no auditLogs e no
//    moderationRecords.
// ============================================

import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, Modal, Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useSuperAdminGuard } from '../../hooks/useAdminGuard';
import ScreenContainer from '../../components/ScreenContainer';
import {
  PendingVerification, ageModerationErrorMessage, getAgeDraft, listPendingVerifications,
} from '../../services/moderation/ageModerationService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_W } = Dimensions.get('window');

const IMAGE_LABELS = ['Frente do documento', 'Verso do documento', 'Selfie com documento'];

function formatIso(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  })}`;
}

export default function AdminAgeVerificationScreen() {
  const navigation = useNavigation<NavProp>();
  const { blocked, loading: guardLoading } = useSuperAdminGuard();

  const [items, setItems] = useState<PendingVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Visualizador de imagem em tela cheia
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await listPendingVerifications();
      setItems(result.items);
    } catch (e) {
      console.error('[AdminAgeVerification] Erro:', e);
      setError(ageModerationErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Recarrega ao voltar do questionário (a pendência concluída sai da
  // fila) e renova os links de 10 minutos.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (guardLoading || blocked) return null;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verificação de Idade</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('MainTabs')}
          accessibilityRole="button"
          accessibilityLabel="Ir para o início"
        >
          <Text style={styles.homeBtn}>🏠</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.noticeBar}>
        <Text style={styles.noticeText}>
          Os links das imagens expiram em 10 minutos. Puxe para baixo para renovar.
        </Text>
      </View>

      {loading && items.length === 0 ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : error && items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.bigIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()} accessibilityRole="button">
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.uid}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={colors.gold} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.bigIcon}>📭</Text>
              <Text style={styles.emptyText}>Nenhuma verificação pendente</Text>
            </View>
          }
          renderItem={({ item }) => {
            const draft = getAgeDraft(item.uid);
            const inProgress = Object.keys(draft.answers).length > 0;

            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    👤 {item.declaredName ?? item.uid.slice(0, 16) + '...'}
                  </Text>
                  {item.attempts > 1 && (
                    <View style={styles.attemptBadge}>
                      <Text style={styles.attemptBadgeText}>{item.attempts}ª tentativa</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.field}>
                  Idade declarada: <Text style={styles.value}>{item.declaredAge ?? '—'} anos</Text>
                </Text>
                <Text style={styles.field}>
                  Cidade: <Text style={styles.value}>
                    {item.city ? `${item.city}, ${item.state ?? ''}` : '—'}
                  </Text>
                </Text>
                <Text style={styles.field}>
                  E-mail: <Text style={styles.value}>{item.email ?? '—'}</Text>
                </Text>
                <Text style={styles.cardDate}>Enviado em {formatIso(item.submittedAt)}</Text>
                <Text style={styles.cardUid}>UID: {item.uid}</Text>

                {/* Imagens */}
                <View style={styles.thumbRow}>
                  {item.imageUrls.map((url, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.thumbWrap}
                      onPress={() => url && setViewerUrl(url)}
                      disabled={!url}
                      accessibilityRole="imagebutton"
                      accessibilityLabel={`Ampliar ${IMAGE_LABELS[i] ?? `imagem ${i + 1}`}`}
                    >
                      {url ? (
                        <Image source={{ uri: url }} style={styles.thumb} />
                      ) : (
                        <View style={[styles.thumb, styles.thumbBroken]}>
                          <Text style={styles.thumbBrokenText}>sem imagem</Text>
                        </View>
                      )}
                      <Text style={styles.thumbLabel} numberOfLines={2}>
                        {IMAGE_LABELS[i] ?? `Imagem ${i + 1}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.analyzeBtn}
                  onPress={() => navigation.navigate('AdminAgeVerificationReview', { userId: item.uid })}
                  accessibilityRole="button"
                  accessibilityLabel={`Analisar verificação de ${item.declaredName ?? 'usuário'}`}
                >
                  <Text style={styles.analyzeBtnText}>
                    📋 {inProgress ? 'Continuar análise' : 'Analisar'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* Visualizador em tela cheia */}
      <Modal visible={!!viewerUrl} transparent animationType="fade" onRequestClose={() => setViewerUrl(null)}>
        <TouchableOpacity
          style={styles.viewerOverlay}
          onPress={() => setViewerUrl(null)}
          activeOpacity={1}
        >
          {viewerUrl && (
            <Image source={{ uri: viewerUrl }} style={styles.viewerImage} resizeMode="contain" />
          )}
          <Text style={styles.viewerHint}>Toque para fechar</Text>
        </TouchableOpacity>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28, width: 40 },
  homeBtn: { fontSize: 22, width: 40, textAlign: 'right' },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  noticeBar: {
    backgroundColor: colors.gold + '11',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.grayDark,
    padding: spacing.sm,
  },
  noticeText: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center' },
  list: { padding: spacing.md, flexGrow: 1 },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md,
    gap: spacing.xs,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', flex: 1 },
  attemptBadge: {
    backgroundColor: colors.error + '22', borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.error,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  attemptBadgeText: { color: colors.error, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  field: { color: colors.gray, fontSize: fonts.sizes.sm },
  value: { color: colors.white, fontWeight: 'bold' },
  cardDate: { color: colors.gray, fontSize: fonts.sizes.xs, marginTop: spacing.xs },
  cardUid: { color: colors.gray, fontSize: fonts.sizes.xs },
  thumbRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  thumbWrap: { flex: 1, gap: 4 },
  thumb: {
    width: '100%', height: 90, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gold + '55', backgroundColor: colors.background,
  },
  thumbBroken: { alignItems: 'center', justifyContent: 'center', borderColor: colors.error },
  thumbBrokenText: { color: colors.error, fontSize: 9, textAlign: 'center' },
  thumbLabel: { color: colors.gray, fontSize: 9, textAlign: 'center' },
  analyzeBtn: {
    backgroundColor: colors.gold + '22', borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: colors.gold, padding: spacing.sm, alignItems: 'center', marginTop: spacing.sm,
    minHeight: 44, justifyContent: 'center',
  },
  analyzeBtnText: { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: spacing.md, padding: spacing.xl,
  },
  bigIcon: { fontSize: 48 },
  errorText: { color: colors.error, fontSize: fonts.sizes.md, textAlign: 'center' },
  emptyText: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.sm,
    padding: spacing.md, paddingHorizontal: spacing.xl,
  },
  retryBtnText: { color: colors.background, fontWeight: 'bold' },
  viewerOverlay: {
    flex: 1, backgroundColor: '#000000EE',
    alignItems: 'center', justifyContent: 'center', gap: spacing.lg,
  },
  viewerImage: { width: SCREEN_W, height: '80%' },
  viewerHint: { color: colors.gray, fontSize: fonts.sizes.sm },
});
