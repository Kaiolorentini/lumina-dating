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
// 2. Aprovar EXIGE a data de nascimento lida no documento.
//    A CF calcula a idade em BRT e RECUSA menor de 18 —
//    o clique do admin não é a última barreira.
//
// 3. Só pendentes. Aprovadas e rejeitadas não têm aba
//    porque as imagens já foram apagadas e não há o que
//    revisar; o histórico fica no auditLogs.
// ============================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput, Modal,
  Image, ScrollView, Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useSuperAdminGuard } from '../../hooks/useAdminGuard';
import ScreenContainer from '../../components/ScreenContainer';
import app from '../../core/firebase';

const { width: SCREEN_W } = Dimensions.get('window');

const IMAGE_LABELS = ['Frente do documento', 'Verso do documento', 'Selfie com documento'];

const REJECTION_OPTIONS = [
  { reason: 'ILLEGIBLE', label: 'Ilegível', hint: 'Fotos sem nitidez ou incompletas' },
  { reason: 'MISMATCH',  label: 'Não corresponde', hint: 'Selfie difere do documento' },
  { reason: 'UNDERAGE',  label: 'Menor de idade', hint: 'ENCERRA A CONTA' },
  { reason: 'OTHER',     label: 'Outro', hint: 'Descreva no campo abaixo' },
] as const;

type RejectionReason = typeof REJECTION_OPTIONS[number]['reason'];

// Genéricos em tipos nomeados: httpsCallable< em fim de
// linha é corrompido ao colar.
interface PendingRow {
  uid: string;
  declaredName: string | null;
  declaredAge: number | null;
  city: string | null;
  state: string | null;
  email: string | null;
  attempts: number;
  submittedAt: string | null;
  imageUrls: string[];
}

interface ListPendingResult {
  items: PendingRow[];
  signedUrlMinutes: number;
}

interface ApprovePayload {
  userId: string;
  birthDate: string;
}

interface ApproveResult {
  success: boolean;
  verifiedAge: number;
  ageCorrected: boolean;
  founderNumber: number | null;
}

interface RejectPayload {
  userId: string;
  reason: RejectionReason;
  note?: string;
}

interface RejectResult {
  success: boolean;
  accountBanned: boolean;
  attemptsLeft: number;
}

function formatIso(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  })}`;
}

/** Aceita 31/12/1990 ou 31121990 e devolve AAAA-MM-DD. */
function toIsoDate(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  return `${year}-${month}-${day}`;
}

export default function AdminAgeVerificationScreen() {
  const navigation = useNavigation();
  const { blocked, loading: guardLoading } = useSuperAdminGuard();

  const [items, setItems] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  // Visualizador de imagem em tela cheia
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  // Aprovação
  const [approveTarget, setApproveTarget] = useState<PendingRow | null>(null);
  const [birthDateInput, setBirthDateInput] = useState('');

  // Rejeição
  const [rejectTarget, setRejectTarget] = useState<PendingRow | null>(null);
  const [rejectReason, setRejectReason] = useState<RejectionReason | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable<void, ListPendingResult>(
        getFunctions(app, 'us-central1'),
        'listPendingVerifications',
      );
      const result = await fn();
      setItems(result.data.items);
    } catch (e: any) {
      console.error('[AdminAgeVerification] Erro:', e);
      setError(e.message ?? 'Erro ao carregar a fila');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (guardLoading || blocked) return null;

  function openApprove(row: PendingRow) {
    setApproveTarget(row);
    setBirthDateInput('');
  }

  async function confirmApprove() {
    if (!approveTarget) return;

    const isoDate = toIsoDate(birthDateInput);
    if (!isoDate) {
      Alert.alert('Data inválida', 'Digite a data no formato DD/MM/AAAA.');
      return;
    }

    const target = approveTarget;
    setApproveTarget(null);
    setProcessing(target.uid);

    try {
      const fn = httpsCallable<ApprovePayload, ApproveResult>(
        getFunctions(app, 'us-central1'),
        'approveAgeVerification',
      );
      const result = await fn({ userId: target.uid, birthDate: isoDate });

      const parts = [`Idade verificada: ${result.data.verifiedAge} anos.`];
      if (result.data.ageCorrected) {
        parts.push(`A idade do perfil foi corrigida (declarava ${target.declaredAge ?? '—'}).`);
      }
      if (result.data.founderNumber) {
        parts.push(`🌟 Fundador nº ${result.data.founderNumber} de 2000.`);
      }

      Alert.alert('✅ Conta liberada', parts.join('\n'));
      load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setProcessing(null);
    }
  }

  function openReject(row: PendingRow) {
    setRejectTarget(row);
    setRejectReason(null);
    setRejectNote('');
  }

  async function confirmReject() {
    if (!rejectTarget || !rejectReason) {
      Alert.alert('Erro', 'Escolha o motivo da rejeição.');
      return;
    }

    const target = rejectTarget;
    const reason = rejectReason;
    const note = rejectNote.trim();

    // UNDERAGE encerra a conta e não permite reenvio:
    // confirmação extra porque não há como desfazer pelo app.
    if (reason === 'UNDERAGE') {
      Alert.alert(
        'Encerrar a conta?',
        `A conta de ${target.declaredName ?? target.uid} será ENCERRADA por menoridade. Não haverá reenvio. Confirme apenas se o documento realmente indica menos de 18 anos.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Encerrar conta', style: 'destructive', onPress: () => doReject(target, reason, note) },
        ],
      );
      return;
    }

    doReject(target, reason, note);
  }

  async function doReject(target: PendingRow, reason: RejectionReason, note: string) {
    setRejectTarget(null);
    setProcessing(target.uid);

    try {
      const fn = httpsCallable<RejectPayload, RejectResult>(
        getFunctions(app, 'us-central1'),
        'rejectAgeVerification',
      );
      const result = await fn({ userId: target.uid, reason, note: note || undefined });

      Alert.alert(
        result.data.accountBanned ? '🚫 Conta encerrada' : '❌ Verificação rejeitada',
        result.data.accountBanned
          ? 'A conta foi encerrada por menoridade e as imagens foram apagadas.'
          : `O usuário foi avisado e tem ${result.data.attemptsLeft} tentativa(s) restante(s). As imagens foram apagadas.`,
      );
      load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setProcessing(null);
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verificação de Idade</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.noticeBar}>
        <Text style={styles.noticeText}>
          Os links das imagens expiram em 10 minutos. Recarregue se as fotos não abrirem.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.bigIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.uid}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={load} tintColor={colors.gold} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.bigIcon}>📭</Text>
              <Text style={styles.emptyText}>Nenhuma verificação pendente</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isProcessing = processing === item.uid;

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

                {/* Dados declarados: o admin compara com o
                    documento e a CF corrige a idade se divergir. */}
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

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => openApprove(item)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color={colors.success} size="small" />
                    ) : (
                      <Text style={styles.approveBtnText}>✅ Aprovar</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => openReject(item)}
                    disabled={isProcessing}
                  >
                    <Text style={styles.rejectBtnText}>❌ Rejeitar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Visualizador em tela cheia */}
      <Modal visible={!!viewerUrl} transparent animationType="fade">
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

      {/* Modal de aprovação */}
      <Modal
        visible={!!approveTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setApproveTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✅ Aprovar verificação</Text>
            <Text style={styles.modalSubtitle}>
              {approveTarget?.declaredName ?? approveTarget?.uid.slice(0, 16)}
            </Text>

            <Text style={styles.modalLabel}>
              Data de nascimento NO DOCUMENTO *
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.gray}
              value={birthDateInput}
              onChangeText={setBirthDateInput}
              keyboardType="numeric"
              maxLength={10}
              autoFocus
            />
            <Text style={styles.modalHint}>
              Digite exatamente o que está no documento. O sistema calcula
              a idade e recusa a aprovação se der menos de 18 anos.
              {approveTarget?.declaredAge != null
                ? ` O usuário declarou ${approveTarget.declaredAge} anos no cadastro — se divergir, o perfil é corrigido.`
                : ''}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setApproveTarget(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalApproveBtn} onPress={confirmApprove}>
                <Text style={styles.modalApproveBtnText}>Aprovar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de rejeição */}
      <Modal
        visible={!!rejectTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>❌ Rejeitar verificação</Text>
            <Text style={styles.modalSubtitle}>
              {rejectTarget?.declaredName ?? rejectTarget?.uid.slice(0, 16)}
            </Text>

            <Text style={styles.modalLabel}>Motivo *</Text>
            <ScrollView style={styles.reasonList}>
              {REJECTION_OPTIONS.map(opt => {
                const selected = rejectReason === opt.reason;
                const danger = opt.reason === 'UNDERAGE';
                return (
                  <TouchableOpacity
                    key={opt.reason}
                    style={[
                      styles.reasonOption,
                      selected && styles.reasonOptionOn,
                      selected && danger && styles.reasonOptionDanger,
                    ]}
                    onPress={() => setRejectReason(opt.reason)}
                  >
                    <Text style={[
                      styles.reasonLabel,
                      selected && styles.reasonLabelOn,
                      danger && styles.reasonLabelDanger,
                    ]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.reasonHint}>{opt.hint}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TextInput
              style={styles.modalInput}
              placeholder="Observação para o usuário (opcional)"
              placeholderTextColor={colors.gray}
              value={rejectNote}
              onChangeText={setRejectNote}
              multiline
              numberOfLines={2}
              maxLength={500}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRejectTarget(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmReject}>
                <Text style={styles.modalConfirmBtnText}>Rejeitar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  noticeBar: {
    backgroundColor: colors.gold + '11',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.grayDark,
    padding: spacing.sm,
  },
  noticeText: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center' },
  list: { padding: spacing.md },
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
  cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  approveBtn: {
    backgroundColor: colors.success + '22', borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: colors.success, flex: 1, padding: spacing.sm, alignItems: 'center',
  },
  approveBtnText: { color: colors.success, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  rejectBtn: {
    backgroundColor: colors.error + '11', borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: colors.error, flex: 1, padding: spacing.sm, alignItems: 'center',
  },
  rejectBtnText: { color: colors.error, fontWeight: 'bold', fontSize: fonts.sizes.sm },
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
  modalOverlay: {
    flex: 1, backgroundColor: '#00000088',
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.lg, width: '100%', gap: spacing.md,
    maxHeight: '85%',
  },
  modalTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  modalSubtitle: { color: colors.gray, fontSize: fonts.sizes.sm },
  modalLabel: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  modalHint: { color: colors.gray, fontSize: fonts.sizes.xs, lineHeight: 16 },
  modalInput: {
    backgroundColor: colors.background, borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: colors.grayDark, color: colors.white, padding: spacing.md,
    fontSize: fonts.sizes.md, textAlignVertical: 'top',
  },
  reasonList: { maxHeight: 200 },
  reasonOption: {
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.grayDark,
    padding: spacing.sm, marginBottom: spacing.sm,
  },
  reasonOptionOn: { borderColor: colors.gold, backgroundColor: colors.gold + '11' },
  reasonOptionDanger: { borderColor: colors.error, backgroundColor: colors.error + '22' },
  reasonLabel: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  reasonLabelOn: { color: colors.gold },
  reasonLabelDanger: { color: colors.error },
  reasonHint: { color: colors.gray, fontSize: fonts.sizes.xs, marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalCancelBtn: {
    flex: 1, backgroundColor: colors.grayDark, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center',
  },
  modalCancelBtnText: { color: colors.white, fontWeight: 'bold' },
  modalApproveBtn: {
    flex: 1, backgroundColor: colors.success, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center',
  },
  modalApproveBtnText: { color: colors.background, fontWeight: 'bold' },
  modalConfirmBtn: {
    flex: 1, backgroundColor: colors.error, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center',
  },
  modalConfirmBtnText: { color: colors.white, fontWeight: 'bold' },
});