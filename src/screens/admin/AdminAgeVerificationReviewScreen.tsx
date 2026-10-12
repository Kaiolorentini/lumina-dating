// ============================================
// LUMINA — ANÁLISE DA VERIFICAÇÃO DE IDADE (QUESTIONÁRIO)
// src/screens/admin/AdminAgeVerificationReviewScreen.tsx
//
// 12/10/2026. Aberta pela fila (AdminAgeVerification) no botão
// "📋 Analisar". Substitui os modais antigos de aprovar/recusar.
//
// • Mostra documento (frente e verso), selfie com documento e a foto
//   de perfil, com visualização em tela cheia. Os links duram 10
//   minutos — há botão para renovar.
// • O admin digita a data de nascimento do documento; o app mostra a
//   idade calculada (prévia — o servidor calcula de novo).
// • 12 itens com "Como analisar" e Aprovado / Negado.
// • Aprovar: todos ✅ e data válida dando 18+.
//   Recusar: todos respondidos e pelo menos um ❌. O SERVIDOR decide o
//   motivo (o mais grave) e o texto que vai para o usuário.
// • Menoridade (item "18 anos ou mais" negado) ENCERRA A CONTA: exige
//   a data dando menos de 18 e confirmação dupla.
// • Rascunho em memória por usuário (ageModerationService).
// • 12/10/2026 (ajuste): os botões do rodapé nunca ficam "mortos" —
//   pronto para concluir, o botão é sólido; faltando algo, o toque
//   explica o que falta em vez de não fazer nada.
// ============================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, Dimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useSuperAdminGuard } from '../../hooks/useAdminGuard';
import ScreenContainer from '../../components/ScreenContainer';
import ChecklistItemCard from '../../components/moderation/ChecklistItemCard';
import {
  AGE_CHECKLIST, AGE_CHECKLIST_ITEMS, AgeChecklistAnswer, AgeChecklistItem,
  OUTCOME_LABEL, previewAgeRejection,
} from '../../config/moderation/ageChecklist';
import {
  AgeChecklistDraft, PendingVerification, ageModerationErrorMessage, approveAge,
  clearAgeDraft, getAgeDraft, listPendingVerifications, maskBirthDate, previewAge,
  rejectAge, saveAgeDraft,
} from '../../services/moderation/ageModerationService';

type NavProp    = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'AdminAgeVerificationReview'>;

const { width: SCREEN_W } = Dimensions.get('window');
const TOTAL_ITEMS = AGE_CHECKLIST_ITEMS.length;
const MIN_AGE = 18;
const GENERIC_MESSAGE = 'Não foi possível concluir sua verificação.';
const IMAGE_LABELS = ['Frente do documento', 'Verso do documento', 'Selfie com documento'];

function formatIso(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Avisos em vermelho de cada item quando negado. */
function warningsFor(item: AgeChecklistItem): string[] {
  const list: string[] = [];
  if (item.outcome === 'underage') {
    list.push('⛔ Negar este item ENCERRA A CONTA. Exige a data de nascimento acima dando menos de 18 anos.');
  }
  if (item.hideFromUser) {
    list.push('🔒 Sigiloso: o usuário recebe só um texto genérico. Sua observação fica apenas no registro interno.');
  }
  if (item.alert) {
    list.push('🚨 Negar avisa os superadmins para revisar a conta.');
  }
  return list;
}

export default function AdminAgeVerificationReviewScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteProps>();
  const { userId } = params;
  const { blocked, loading: guardLoading } = useSuperAdminGuard();

  const [row, setRow]             = useState<PendingVerification | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [stale, setStale]         = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [draft, setDraft]         = useState<AgeChecklistDraft>(() => getAgeDraft(userId));
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPendingVerifications(userId);
      const found = result.items[0] ?? null;
      setRow(found);
      setStale(!found);
      setExpiresAt(Date.now() + result.signedUrlMinutes * 60 * 1000);
    } catch (e) {
      console.error('[AdminAgeVerificationReview] Erro ao carregar:', e);
      setError(ageModerationErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Rascunho em memória a cada mudança.
  useEffect(() => { saveAgeDraft(userId, draft); }, [userId, draft]);

  const age = useMemo(() => previewAge(draft.birthDateInput), [draft.birthDateInput]);
  const dateComplete = draft.birthDateInput.replace(/\D/g, '').length === 8;

  const answered = useMemo(
    () => AGE_CHECKLIST_ITEMS.filter(item => draft.answers[item.id]).length,
    [draft.answers],
  );
  const rejectedCount = useMemo(
    () => AGE_CHECKLIST_ITEMS.filter(item => draft.answers[item.id] === 'rejected').length,
    [draft.answers],
  );
  const preview = useMemo(() => previewAgeRejection(draft.answers), [draft.answers]);

  const complete      = answered === TOTAL_ITEMS;
  const isUnderage    = preview?.outcome === 'underage';
  const ageItemAnswer = draft.answers.age_18;

  // Coerência entre a data digitada e o item "18 anos ou mais".
  const ageConflict =
    age !== null && ((age < MIN_AGE && ageItemAnswer === 'approved') || (age >= MIN_AGE && ageItemAnswer === 'rejected'));

  const canApprove = complete && rejectedCount === 0 && age !== null && age >= MIN_AGE && !stale;
  const canReject  = complete && rejectedCount > 0 && !stale && !ageConflict
    && (!isUnderage || (age !== null && age < MIN_AGE));

  const setAnswer = useCallback((id: string, answer: AgeChecklistAnswer) => {
    setDraft(prev => ({ ...prev, answers: { ...prev.answers, [id]: answer } }));
  }, []);

  const setNote = useCallback((id: string, note: string) => {
    setDraft(prev => ({ ...prev, notes: { ...prev.notes, [id]: note } }));
  }, []);

  function setBirthDate(text: string) {
    setDraft(prev => ({ ...prev, birthDateInput: maskBirthDate(text) }));
  }

  function finish(title: string, message: string) {
    clearAgeDraft(userId);
    Alert.alert(title, message, [
      { text: 'OK', onPress: () => navigation.navigate('AdminAgeVerification') },
    ]);
  }

  async function doApprove() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await approveAge(userId, draft);
      const parts = [`Idade verificada: ${result.verifiedAge} anos.`];
      if (result.ageCorrected) parts.push(`A idade do perfil foi corrigida (declarava ${row?.declaredAge ?? '—'}).`);
      if (result.founderNumber) parts.push(`🌟 Fundador nº ${result.founderNumber} de 2000.`);
      parts.push('As imagens foram apagadas e a análise ficou registrada.');
      finish('✅ Conta liberada', parts.join('\n'));
    } catch (e) {
      Alert.alert('Não foi possível aprovar', ageModerationErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function doReject() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await rejectAge(userId, draft);
      finish(
        result.accountBanned ? '🚫 Conta encerrada' : '❌ Verificação recusada',
        result.accountBanned
          ? 'A conta foi encerrada por menoridade, as sessões foram derrubadas e as imagens apagadas.'
          : `O usuário recebeu: "${result.userMessage}"\nTentativas restantes: ${result.attemptsLeft}. As imagens foram apagadas.`,
      );
    } catch (e) {
      Alert.alert('Não foi possível recusar', ageModerationErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  /** O que falta para concluir — mostrado no toque, em vez de botão mudo. */
  function explainBlocked(kind: 'approve' | 'reject') {
    const missing: string[] = [];
    if (stale) missing.push('Esta verificação não está mais pendente.');
    if (!complete) missing.push(`Responda os ${TOTAL_ITEMS - answered} item(ns) que faltam.`);
    if (kind === 'approve') {
      if (rejectedCount > 0) missing.push('Há itens negados — para liberar, todos precisam estar aprovados.');
      if (age === null) {
        missing.push(dateComplete
          ? 'A data de nascimento digitada é inválida — confira dia, mês e ano.'
          : 'Digite a data de nascimento do documento (DD/MM/AAAA), no quadro acima dos itens.');
      } else if (age < MIN_AGE) {
        missing.push(`A data dá ${age} anos: negue o item "18 anos ou mais" e recuse.`);
      }
    } else {
      if (ageConflict) missing.push('A data digitada não combina com o item "18 anos ou mais". Confira os dois.');
      if (isUnderage && (age === null || age >= MIN_AGE)) {
        missing.push('Para encerrar por menoridade, digite a data do documento (precisa dar menos de 18 anos).');
      }
    }
    Alert.alert('Ainda não dá para concluir', missing.join('\n\n') || 'Confira as respostas e tente de novo.');
  }

  function confirmApprove() {
    if (!canApprove) { explainBlocked('approve'); return; }
    Alert.alert(
      'Liberar a conta?',
      `Idade pelo documento: ${age} anos. Você confirma que conferiu os 12 itens nas imagens. A análise fica registrada com o seu usuário.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aprovar', onPress: doApprove },
      ],
    );
  }

  function confirmReject() {
    if (!canReject || !preview) { explainBlocked('reject'); return; }

    if (isUnderage) {
      Alert.alert(
        '⛔ Encerrar a conta?',
        `O documento indica ${age} anos. A conta será ENCERRADA e não haverá reenvio.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Continuar',
            style: 'destructive',
            onPress: () => Alert.alert(
              'Confirme de novo',
              'Confira a data digitada com o documento. Isto não pode ser desfeito pelo app.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Encerrar conta', style: 'destructive', onPress: doReject },
              ],
            ),
          },
        ],
      );
      return;
    }

    const message = preview.hidden
      ? `O usuário recebe só: "${GENERIC_MESSAGE}"`
      : 'O usuário recebe o motivo de cada item negado.';
    Alert.alert(
      'Recusar a verificação?',
      `Motivo: ${OUTCOME_LABEL[preview.outcome]}.\n${message}${preview.alert ? '\nOs superadmins serão avisados.' : ''}\nAs imagens serão apagadas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Recusar', style: 'destructive', onPress: doReject },
      ],
    );
  }

  if (guardLoading || blocked) return null;

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
        <Text style={styles.headerBtn}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>Analisar verificação</Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('MainTabs')}
        accessibilityRole="button"
        accessibilityLabel="Ir para o início"
      >
        <Text style={styles.headerHome}>🏠</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && !row) {
    return (
      <ScreenContainer>
        {header}
        <View style={styles.center}><ActivityIndicator color={colors.gold} size="large" /></View>
      </ScreenContainer>
    );
  }

  if (error && !row) {
    return (
      <ScreenContainer>
        {header}
        <View style={styles.center}>
          <Text style={styles.bigIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} accessibilityRole="button">
            <Text style={styles.retryText}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  if (stale || !row) {
    return (
      <ScreenContainer>
        {header}
        <View style={styles.center}>
          <Text style={styles.bigIcon}>📭</Text>
          <Text style={styles.emptyText}>
            Esta verificação não está mais pendente — outro admin pode ter concluído, ou o usuário excluiu a conta.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { clearAgeDraft(userId); navigation.navigate('AdminAgeVerification'); }}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Voltar para a fila</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const linksExpired = expiresAt !== null && Date.now() > expiresAt;
  const images: Array<{ url: string; label: string }> = [
    ...row.imageUrls.map((url, i) => ({ url, label: IMAGE_LABELS[i] ?? `Imagem ${i + 1}` })),
    { url: row.photoURL ?? '', label: 'Foto de perfil' },
  ];

  return (
    <ScreenContainer>
      {header}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Dados declarados */}
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.cardName} numberOfLines={1}>👤 {row.declaredName ?? `${row.uid.slice(0, 16)}...`}</Text>
            {row.attempts > 1 && (
              <View style={styles.attemptBadge}>
                <Text style={styles.attemptBadgeText}>{row.attempts}ª tentativa</Text>
              </View>
            )}
          </View>
          <Text style={styles.field}>Idade declarada: <Text style={styles.value}>{row.declaredAge ?? '—'} anos</Text></Text>
          <Text style={styles.field}>
            Cidade: <Text style={styles.value}>{row.city ? `${row.city}, ${row.state ?? ''}` : '—'}</Text>
          </Text>
          <Text style={styles.field}>E-mail: <Text style={styles.value}>{row.email ?? '—'}</Text></Text>
          <Text style={styles.small}>Enviado em {formatIso(row.submittedAt)}</Text>
          <Text style={styles.small}>UID: {row.uid}</Text>
        </View>

        {/* Imagens */}
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.sectionTitle}>Imagens</Text>
            <TouchableOpacity onPress={load} disabled={loading} accessibilityRole="button" accessibilityLabel="Renovar links das imagens">
              {loading
                ? <ActivityIndicator color={colors.gold} size="small" />
                : <Text style={styles.link}>🔄 Renovar links</Text>}
            </TouchableOpacity>
          </View>
          <Text style={[styles.small, linksExpired && { color: colors.error }]}>
            {linksExpired
              ? 'Os links expiraram — toque em "Renovar links".'
              : expiresAt ? `Links válidos até ${formatTime(expiresAt)}. Toque numa imagem para ampliar.` : ''}
          </Text>
          <View style={styles.thumbGrid}>
            {images.map(image => (
              <TouchableOpacity
                key={image.label}
                style={styles.thumbWrap}
                onPress={() => image.url && setViewerUrl(image.url)}
                disabled={!image.url}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Ampliar ${image.label}`}
              >
                {image.url ? (
                  <Image source={{ uri: image.url }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbBroken]}>
                    <Text style={styles.thumbBrokenText}>sem imagem</Text>
                  </View>
                )}
                <Text style={styles.thumbLabel} numberOfLines={2}>{image.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Data de nascimento */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Data de nascimento no documento</Text>
          <TextInput
            style={styles.dateInput}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={colors.gray}
            value={draft.birthDateInput}
            onChangeText={setBirthDate}
            keyboardType="number-pad"
            maxLength={10}
            accessibilityLabel="Data de nascimento no documento"
          />
          {age !== null ? (
            <Text style={[styles.ageText, age < MIN_AGE && { color: colors.error }]}>
              {age < MIN_AGE ? `⛔ ${age} anos — MENOR DE IDADE` : `✅ ${age} anos`}
              {row.declaredAge !== null && row.declaredAge !== age ? `  (declarou ${row.declaredAge} — o perfil será corrigido)` : ''}
            </Text>
          ) : dateComplete ? (
            <Text style={[styles.ageText, { color: colors.error }]}>Data inválida — confira dia, mês e ano.</Text>
          ) : (
            <Text style={styles.small}>
              Digite exatamente o que está no documento. Obrigatória para aprovar e para recusar por menoridade.
              Se o documento estiver ilegível, pode deixar em branco e recusar.
            </Text>
          )}
          {ageConflict && (
            <Text style={styles.conflict}>
              {age !== null && age < MIN_AGE
                ? 'A data dá menos de 18 anos, mas o item "18 anos ou mais" está aprovado. Confira.'
                : 'A data dá 18 anos ou mais, mas o item "18 anos ou mais" está negado. Confira.'}
            </Text>
          )}
        </View>

        <View style={styles.rule}>
          <Text style={styles.ruleText}>
            Todos os itens precisam estar ✅ para liberar a conta. Na dúvida, marque ❌ — o usuário pode reenviar (exceto menoridade).
          </Text>
        </View>

        {AGE_CHECKLIST.map(group => (
          <View key={group.id} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.warning ? <Text style={styles.groupWarning}>⚠️ {group.warning}</Text> : null}
            {group.items.map(item => (
              <ChecklistItemCard
                key={item.id}
                title={item.title}
                icon={item.outcome === 'underage' ? '⛔' : item.alert ? '🚨' : undefined}
                look={item.look}
                ok={item.ok}
                notOk={item.notOk}
                answer={draft.answers[item.id]}
                note={draft.notes[item.id] ?? ''}
                onAnswer={answer => setAnswer(item.id, answer)}
                onNote={note => setNote(item.id, note)}
                reasonLabel={item.hideFromUser ? 'O usuário recebe só o texto genérico:' : 'Motivo enviado ao usuário:'}
                reasonText={item.hideFromUser ? GENERIC_MESSAGE : item.reason}
                rejectWarnings={warningsFor(item)}
                notePlaceholder={item.hideFromUser
                  ? 'Observação interna (NÃO vai para o usuário, até 300 letras)'
                  : 'Observação para o usuário (opcional, até 300 letras)'}
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
          {preview ? ` · ${OUTCOME_LABEL[preview.outcome]}` : ''}
        </Text>

        {submitting ? (
          <ActivityIndicator color={colors.gold} style={{ paddingVertical: spacing.md }} />
        ) : rejectedCount > 0 ? (
          <TouchableOpacity
            style={[styles.rejectBtn, canReject ? styles.rejectBtnReady : styles.btnDisabled]}
            onPress={confirmReject}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canReject }}
          >
            <Text style={[styles.rejectBtnText, canReject && styles.rejectBtnTextReady]}>
              {!complete
                ? `Responda os ${TOTAL_ITEMS - answered} item(ns) que faltam`
                : ageConflict
                  ? 'Corrija a data ou o item da idade'
                  : isUnderage && (age === null || age >= MIN_AGE)
                    ? 'Digite a data do documento para encerrar'
                    : isUnderage
                      ? '⛔ Encerrar conta (menor de idade)'
                      : `❌ Recusar verificação (${rejectedCount} motivo${rejectedCount > 1 ? 's' : ''})`}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.approveBtn, canApprove ? styles.approveBtnReady : styles.btnDisabled]}
            onPress={confirmApprove}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canApprove }}
          >
            <Text style={[styles.approveBtnText, canApprove && styles.approveBtnTextReady]}>
              {!complete
                ? `Responda os ${TOTAL_ITEMS - answered} item(ns) que faltam`
                : age === null
                  ? 'Digite a data de nascimento do documento'
                  : age < MIN_AGE
                    ? 'Menor de idade — negue o item da idade'
                    : '✅ Aprovar e liberar a conta'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Visualizador em tela cheia */}
      <Modal visible={!!viewerUrl} transparent animationType="fade" onRequestClose={() => setViewerUrl(null)}>
        <TouchableOpacity
          style={styles.viewerOverlay}
          onPress={() => setViewerUrl(null)}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Fechar imagem"
        >
          {viewerUrl && <Image source={{ uri: viewerUrl }} style={styles.viewerImage} resizeMode="contain" />}
          <Text style={styles.viewerHint}>Toque para fechar</Text>
        </TouchableOpacity>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  headerBtn: { color: colors.gold, fontSize: 28, width: 40 },
  headerHome: { fontSize: 22, width: 40, textAlign: 'right' },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },

  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, gap: spacing.xs,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardName: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', flex: 1 },
  sectionTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  attemptBadge: {
    backgroundColor: colors.error + '22', borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.error,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  attemptBadgeText: { color: colors.error, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  field: { color: colors.gray, fontSize: fonts.sizes.sm },
  value: { color: colors.white, fontWeight: 'bold' },
  small: { color: colors.gray, fontSize: fonts.sizes.xs, lineHeight: 16 },
  link: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },

  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  thumbWrap: { width: '48%', gap: 4 },
  thumb: {
    width: '100%', height: 130, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gold + '55', backgroundColor: colors.background,
  },
  thumbBroken: { alignItems: 'center', justifyContent: 'center', borderColor: colors.error },
  thumbBrokenText: { color: colors.error, fontSize: fonts.sizes.xs, textAlign: 'center' },
  thumbLabel: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center' },

  dateInput: {
    backgroundColor: colors.background, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.grayDark,
    color: colors.white, padding: spacing.md, fontSize: fonts.sizes.lg, letterSpacing: 2, textAlign: 'center',
    marginTop: spacing.xs,
  },
  ageText: { color: colors.success, fontSize: fonts.sizes.md, fontWeight: 'bold', textAlign: 'center' },
  conflict: { color: colors.error, fontSize: fonts.sizes.sm, fontWeight: 'bold', textAlign: 'center' },

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
  approveBtnText: { color: colors.success, fontWeight: 'bold', fontSize: fonts.sizes.md, textAlign: 'center' },
  rejectBtn: {
    backgroundColor: colors.error + '18', borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.error,
    padding: spacing.md, alignItems: 'center',
  },
  rejectBtnText: { color: colors.error, fontWeight: 'bold', fontSize: fonts.sizes.md, textAlign: 'center' },
  btnDisabled: { opacity: 0.45 },
  // Pronto para concluir: botão sólido, sem dúvida de que está ativo.
  approveBtnReady: { backgroundColor: colors.success, borderColor: colors.success },
  approveBtnTextReady: { color: colors.background },
  rejectBtnReady: { backgroundColor: colors.error, borderColor: colors.error },
  rejectBtnTextReady: { color: colors.white },

  bigIcon: { fontSize: 44 },
  errorText: { color: colors.error, fontSize: fonts.sizes.md, textAlign: 'center' },
  emptyText: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
  retryBtn: { backgroundColor: colors.gold, borderRadius: borderRadius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryText: { color: colors.background, fontWeight: 'bold' },

  viewerOverlay: { flex: 1, backgroundColor: '#000000EE', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  viewerImage: { width: SCREEN_W, height: '80%' },
  viewerHint: { color: colors.gray, fontSize: fonts.sizes.sm },
});
