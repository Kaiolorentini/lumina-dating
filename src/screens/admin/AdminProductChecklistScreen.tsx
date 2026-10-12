// ============================================
// LUMINA — QUESTIONÁRIO DE MODERAÇÃO DE PRODUTO
// src/screens/admin/AdminProductChecklistScreen.tsx
//
// 12/10/2026. Aberto pela revisão do produto (AdminProductReview),
// para produto novo (mode 'product') ou para alterações de produto
// à venda (mode 'changes').
//
// • Cada item (cartão compartilhado ChecklistItemCard, 12/10/2026):
//   pergunta, "como analisar" (o que olhar, pode / não pode) e
//   Aprovado / Negado. Negado mostra o motivo que vai para o
//   criador e aceita uma observação.
// • "Aprovar e publicar" só com TODOS os itens aprovados. "Recusar"
//   com todos respondidos e pelo menos um negado.
// • O servidor confere o questionário de novo e grava o registro da
//   análise — o app só envia as respostas.
// • O rascunho fica em memória: dá para voltar à revisão, abrir os
//   arquivos e continuar daqui.
// ============================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { getProduct, ProductWithChanges } from '../../services/marketplace/productService';
import { useSuperAdminGuard } from '../../hooks/useAdminGuard';
import ScreenContainer from '../../components/ScreenContainer';
import ChecklistItemCard from '../../components/moderation/ChecklistItemCard';
import {
  ChecklistAnswer, PRODUCT_CHECKLIST, PRODUCT_CHECKLIST_ITEMS,
} from '../../config/moderation/productChecklist';
import {
  ChecklistDraft, approveProduct, clearChecklistDraft, getChecklistDraft,
  moderationErrorMessage, rejectProduct, reviewProductChanges, saveChecklistDraft,
} from '../../services/moderation/productModerationService';

type NavProp   = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'AdminProductChecklist'>;

const TOTAL_ITEMS = PRODUCT_CHECKLIST_ITEMS.length;
const CHILD_SAFETY_WARNING = '🚨 Este item gera alerta interno para revisar a conta do criador.';

export default function AdminProductChecklistScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteProps>();
  const { productId, mode } = params;
  const { blocked, loading: guardLoading } = useSuperAdminGuard();

  const [product, setProduct]   = useState<ProductWithChanges | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [draft, setDraft]       = useState<ChecklistDraft>(() => getChecklistDraft(productId, mode));
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await getProduct(productId);
      if (!p) setError('Produto não encontrado.');
      else setProduct(p);
    } catch (e) {
      setError(moderationErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  // Rascunho em memória a cada mudança.
  useEffect(() => { saveChecklistDraft(productId, mode, draft); }, [productId, mode, draft]);

  const answered = useMemo(
    () => PRODUCT_CHECKLIST_ITEMS.filter(item => draft.answers[item.id]).length,
    [draft.answers],
  );
  const rejectedCount = useMemo(
    () => PRODUCT_CHECKLIST_ITEMS.filter(item => draft.answers[item.id] === 'rejected').length,
    [draft.answers],
  );
  const complete    = answered === TOTAL_ITEMS;
  const canApprove  = complete && rejectedCount === 0;
  const canReject   = complete && rejectedCount > 0;

  function setAnswer(id: string, answer: ChecklistAnswer) {
    setDraft(prev => ({ ...prev, answers: { ...prev.answers, [id]: answer } }));
  }

  function setNote(id: string, note: string) {
    setDraft(prev => ({ ...prev, notes: { ...prev.notes, [id]: note } }));
  }

  function finish(message: string) {
    clearChecklistDraft(productId, mode);
    Alert.alert(message, undefined, [
      { text: 'OK', onPress: () => navigation.navigate('AdminProductsModeration') },
    ]);
  }

  async function submit(approve: boolean) {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (mode === 'changes') {
        await reviewProductChanges(productId, approve, draft);
        finish(approve ? '✅ Alterações aprovadas' : '❌ Alterações recusadas');
      } else if (approve) {
        await approveProduct(productId, draft);
        finish('✅ Produto aprovado e publicado');
      } else {
        await rejectProduct(productId, draft);
        finish('❌ Produto recusado');
      }
    } catch (e) {
      Alert.alert('Não foi possível concluir', moderationErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  function confirmApprove() {
    Alert.alert(
      mode === 'changes' ? 'Aprovar alterações?' : 'Aprovar e publicar?',
      'Você confirma que analisou todos os itens e todos os arquivos. A análise fica registrada com o seu usuário.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aprovar', onPress: () => submit(true) },
      ],
    );
  }

  function confirmReject() {
    Alert.alert(
      mode === 'changes' ? 'Recusar alterações?' : 'Recusar produto?',
      `${rejectedCount} item(ns) negado(s). O criador recebe os motivos para ajustar. A análise fica registrada com o seu usuário.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Recusar', style: 'destructive', onPress: () => submit(false) },
      ],
    );
  }

  if (guardLoading || blocked) return null;

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
        <Text style={styles.headerBtn}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {mode === 'changes' ? 'Analisar alterações' : 'Analisar produto'}
      </Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('MainTabs')}
        accessibilityRole="button"
        accessibilityLabel="Ir para o início"
      >
        <Text style={styles.headerHome}>🏠</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <ScreenContainer>
        {header}
        <View style={styles.center}><ActivityIndicator color={colors.gold} size="large" /></View>
      </ScreenContainer>
    );
  }

  if (error || !product) {
    return (
      <ScreenContainer>
        {header}
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error ?? 'Produto não encontrado.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} accessibilityRole="button">
            <Text style={styles.retryText}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // Estado mudou enquanto o admin analisava (outro admin concluiu, por exemplo).
  const stillReviewable = mode === 'changes' ? product.hasPendingChanges === true : product.status === 'pending';
  const files       = product.files ?? [];
  const reviewFiles = mode === 'changes' ? files.filter(f => f.status === 'pending').length : files.length;
  const coverUri    = mode === 'changes' && product.pendingCover?.url ? product.pendingCover.url : product.coverImage;
  const priceLabel  = product.isFree ? 'Grátis' : `R$ ${product.price.toFixed(2).replace('.', ',')}`;

  return (
    <ScreenContainer>
      {header}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.summary}>
          {coverUri
            ? <Image source={{ uri: coverUri }} style={styles.summaryCover} />
            : <View style={[styles.summaryCover, styles.center]}><Text style={styles.noCover}>Sem capa</Text></View>}
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryTitle} numberOfLines={2}>{product.title}</Text>
            <Text style={styles.summaryMeta}>{product.category} · {priceLabel}</Text>
            <Text style={styles.summaryMeta}>
              {mode === 'changes'
                ? `${reviewFiles} arquivo(s) novo(s)${product.pendingCover?.url ? ' + capa nova' : ''}`
                : `${reviewFiles} arquivo(s)`}
            </Text>
            <Text style={styles.summaryHint}>Preço mínimo conferido pelo servidor ao aprovar.</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.filesBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
        >
          <Text style={styles.filesBtnText}>👁️ Voltar para ver os arquivos (suas respostas ficam salvas)</Text>
        </TouchableOpacity>

        {!stillReviewable && (
          <View style={styles.staleBox}>
            <Text style={styles.staleText}>
              Este produto não está mais aguardando análise. Volte para a lista de moderação.
            </Text>
          </View>
        )}

        <View style={styles.rule}>
          <Text style={styles.ruleText}>
            Todos os itens precisam estar ✅ para publicar. Na dúvida, marque ❌ — negar e pedir ajuste custa pouco.
          </Text>
        </View>

        {PRODUCT_CHECKLIST.map(group => (
          <View key={group.id} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.warning ? <Text style={styles.groupWarning}>⚠️ {group.warning}</Text> : null}
            {group.items.map(item => (
              <ChecklistItemCard
                key={item.id}
                title={item.title}
                icon={item.childSafety ? '🛡️' : undefined}
                look={item.look}
                ok={item.ok}
                notOk={item.notOk}
                answer={draft.answers[item.id]}
                note={draft.notes[item.id] ?? ''}
                onAnswer={answer => setAnswer(item.id, answer)}
                onNote={note => setNote(item.id, note)}
                reasonLabel="Motivo enviado ao criador:"
                reasonText={item.reason}
                rejectWarnings={item.childSafety ? [CHILD_SAFETY_WARNING] : undefined}
                notePlaceholder="Observação para o criador (opcional, até 300 letras)"
                disabled={submitting}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.round((answered / TOTAL_ITEMS) * 100)}%` as const }]} />
        </View>
        <Text style={styles.progressText}>
          {answered} de {TOTAL_ITEMS} respondidos{rejectedCount > 0 ? ` · ${rejectedCount} negado(s)` : ''}
        </Text>

        {submitting ? (
          <ActivityIndicator color={colors.gold} style={{ paddingVertical: spacing.md }} />
        ) : canReject ? (
          <TouchableOpacity
            style={styles.rejectBtn}
            onPress={confirmReject}
            disabled={!stillReviewable}
            accessibilityRole="button"
          >
            <Text style={styles.rejectBtnText}>
              ❌ {mode === 'changes' ? 'Recusar alterações' : 'Recusar produto'} ({rejectedCount} motivo{rejectedCount > 1 ? 's' : ''})
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.approveBtn, (!canApprove || !stillReviewable) && styles.btnDisabled]}
            onPress={confirmApprove}
            disabled={!canApprove || !stillReviewable}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canApprove || !stillReviewable }}
          >
            <Text style={styles.approveBtnText}>
              {complete
                ? (mode === 'changes' ? '✅ Aprovar alterações' : '✅ Aprovar e publicar')
                : `Responda os ${TOTAL_ITEMS - answered} item(ns) que faltam`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  headerBtn: { color: colors.gold, fontSize: 28, width: 40 },
  headerHome: { fontSize: 22, width: 40, textAlign: 'right' },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },

  summary: {
    flexDirection: 'row', gap: spacing.md, padding: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.grayDark,
  },
  summaryCover: { width: 88, height: 88, borderRadius: borderRadius.sm, backgroundColor: colors.background },
  noCover: { color: colors.gray, fontSize: fonts.sizes.xs },
  summaryInfo: { flex: 1, gap: 2 },
  summaryTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  summaryMeta: { color: colors.gray, fontSize: fonts.sizes.sm, textTransform: 'capitalize' },
  summaryHint: { color: colors.gray, fontSize: fonts.sizes.xs, marginTop: 2 },

  filesBtn: {
    padding: spacing.sm, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.gold + '66', alignItems: 'center',
  },
  filesBtnText: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold', textAlign: 'center' },
  staleBox: { padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.error + '18', borderWidth: 1, borderColor: colors.error },
  staleText: { color: colors.error, fontSize: fonts.sizes.sm, textAlign: 'center' },
  rule: { padding: spacing.sm, borderRadius: borderRadius.sm, backgroundColor: colors.gold + '11' },
  ruleText: { color: colors.gold, fontSize: fonts.sizes.sm, textAlign: 'center' },

  group: { gap: spacing.sm },
  groupTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', marginTop: spacing.sm },
  groupWarning: { color: colors.error, fontSize: fonts.sizes.sm, fontWeight: 'bold' },




  footer: {
    padding: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.grayDark, backgroundColor: colors.surface,
  },
  progressBar: { height: 6, borderRadius: borderRadius.full, backgroundColor: colors.grayDark, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.gold },
  progressText: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center' },
  approveBtn: {
    backgroundColor: colors.success + '22', borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.success,
    padding: spacing.md, alignItems: 'center',
  },
  approveBtnText: { color: colors.success, fontWeight: 'bold', fontSize: fonts.sizes.md },
  rejectBtn: {
    backgroundColor: colors.error + '18', borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.error,
    padding: spacing.md, alignItems: 'center',
  },
  rejectBtnText: { color: colors.error, fontWeight: 'bold', fontSize: fonts.sizes.md },
  btnDisabled: { opacity: 0.45 },

  errorIcon: { fontSize: 44 },
  errorText: { color: colors.error, fontSize: fonts.sizes.md, textAlign: 'center', marginTop: spacing.sm },
  retryBtn: { marginTop: spacing.md, backgroundColor: colors.gold, borderRadius: borderRadius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryText: { color: colors.background, fontWeight: 'bold' },
});
