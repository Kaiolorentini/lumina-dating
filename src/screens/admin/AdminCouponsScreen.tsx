import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput, Modal,
  ScrollView, Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { getCoupons } from '../../services/marketplace/adminService';
import { Coupon, CouponDiscountType } from '../../shared/types/marketplace';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import app from '../../core/firebase';
import ScreenContainer from '../../components/ScreenContainer';

type FilterTab = 'all' | 'active' | 'expired' | 'inactive';
const FILTER_TABS: FilterTab[] = ['all', 'active', 'expired', 'inactive'];
const FILTER_LABEL: Record<FilterTab, string> = {
  all: 'Todos',
  active: 'Ativos',
  expired: 'Expirados',
  inactive: 'Desativados',
};

function formatDateBR(d: Date): string {
  try {
    return d.toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
}

// Date → "dd/mm/aaaa"
function dateToBR(d: Date): string {
  try {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
}

// "dd/mm/aaaa" → epoch ms (ou null se inválido)
function parseDateBR(text: string): number | null {
  const m = text.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d.getTime();
}

function isExpired(coupon: Coupon): boolean {
  return coupon.expiresAt.getTime() < Date.now();
}

function couponMatchesFilter(coupon: Coupon, filter: FilterTab): boolean {
  const expired = isExpired(coupon);
  switch (filter) {
    case 'active': return coupon.isActive && !expired;
    case 'expired': return expired;
    case 'inactive': return !coupon.isActive;
    case 'all':
    default: return true;
  }
}

function discountLabel(coupon: Coupon): string {
  if (coupon.discountType === 'percentage') return `${coupon.discountValue}%`;
  return `R$ ${coupon.discountValue.toFixed(2).replace('.', ',')}`;
}

function usesLabel(coupon: Coupon): string {
  const max = coupon.maxUses === 0 ? '∞' : String(coupon.maxUses);
  return `${coupon.usedCount ?? 0}/${max}`;
}

export default function AdminCouponsScreen() {
  const navigation = useNavigation();
  const { blocked, loading: guardLoading } = useAdminGuard();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  // Modal de formulário (criar OU editar)
  const [formModal, setFormModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);  // null = criar; id = editar
  const [fCode, setFCode] = useState('');
  const [fType, setFType] = useState<CouponDiscountType>('percentage');
  const [fValue, setFValue] = useState('');
  const [fStart, setFStart] = useState('');
  const [fEnd, setFEnd] = useState('');
  const [fMaxUses, setFMaxUses] = useState('0');
  const [fMinPurchase, setFMinPurchase] = useState('');

  const isEditing = editingId !== null;

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getCoupons();
      setCoupons(list);
    } catch (e: any) {
      console.error('[AdminCoupons] Erro:', e);
      setError(e.message ?? 'Erro ao carregar cupons');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadCoupons(); }, []);

  if (guardLoading || blocked) return null;

  async function handleToggle(coupon: Coupon) {
    if (!coupon.id) return;
    setProcessing(coupon.id);
    try {
      const functions = getFunctions(app, 'us-central1');
      const toggle = httpsCallable(functions, 'toggleCoupon');
      await toggle({ couponId: coupon.id, isActive: !coupon.isActive });
      loadCoupons();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setProcessing(null);
    }
  }

  function resetForm() {
    setFCode(''); setFType('percentage'); setFValue('');
    setFStart(''); setFEnd(''); setFMaxUses('0'); setFMinPurchase('');
  }

  function openCreate() {
    setEditingId(null);
    resetForm();
    setFormModal(true);
  }

  function openEdit(coupon: Coupon) {
    if (!coupon.id) return;
    setEditingId(coupon.id);
    setFCode(coupon.code);
    setFType(coupon.discountType);
    setFValue(String(coupon.discountValue));
    setFStart(dateToBR(coupon.startDate));
    setFEnd(dateToBR(coupon.expiresAt));
    setFMaxUses(String(coupon.maxUses ?? 0));
    setFMinPurchase(coupon.minimumPurchaseAmount ? String(coupon.minimumPurchaseAmount) : '');
    setFormModal(true);
  }

  function validateForm(): { ok: boolean; msg?: string; payload?: any } {
    const code = fCode.trim().toUpperCase().replace(/\s+/g, '');
    if (code.length < 3) return { ok: false, msg: 'Código deve ter ao menos 3 caracteres.' };

    const value = parseFloat(fValue.replace(',', '.'));
    if (isNaN(value) || value <= 0) return { ok: false, msg: 'Valor do desconto inválido.' };
    if (fType === 'percentage' && value > 100) return { ok: false, msg: 'Percentual não pode passar de 100%.' };

    const startMs = parseDateBR(fStart);
    const endMs = parseDateBR(fEnd);
    if (startMs === null) return { ok: false, msg: 'Data inicial inválida (use dd/mm/aaaa).' };
    if (endMs === null) return { ok: false, msg: 'Data final inválida (use dd/mm/aaaa).' };
    if (startMs >= endMs) return { ok: false, msg: 'Data inicial deve ser antes da final.' };

    const maxUses = parseInt(fMaxUses, 10);
    if (isNaN(maxUses) || maxUses < 0) return { ok: false, msg: 'Limite de uso inválido (0 = ilimitado).' };

    let minPurchase = 0;
    if (fMinPurchase.trim()) {
      minPurchase = parseFloat(fMinPurchase.replace(',', '.'));
      if (isNaN(minPurchase) || minPurchase < 0) return { ok: false, msg: 'Valor mínimo inválido.' };
    }

    return {
      ok: true,
      payload: {
        code,
        discountType: fType,
        discountValue: value,
        startDate: startMs,
        expiresAt: endMs,
        maxUses,
        minimumPurchaseAmount: minPurchase,
      },
    };
  }

  function confirmSave() {
    const v = validateForm();
    if (!v.ok) {
      Alert.alert('Erro', v.msg!);
      return;
    }
    const p = v.payload;

    if (isEditing) {
      Alert.alert(
        'Salvar alterações?',
        `Cupom: ${p.code}\n` +
        `Desconto: ${p.discountType === 'percentage' ? p.discountValue + '%' : 'R$ ' + p.discountValue}\n` +
        `Validade: ${fStart} até ${fEnd}\n` +
        `Limite: ${p.maxUses === 0 ? 'ilimitado' : p.maxUses}`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salvar', onPress: () => doUpdate(p) },
        ]
      );
    } else {
      Alert.alert(
        'Criar cupom?',
        `Código: ${p.code}\n` +
        `Desconto: ${p.discountType === 'percentage' ? p.discountValue + '%' : 'R$ ' + p.discountValue}\n` +
        `Validade: ${fStart} até ${fEnd}\n` +
        `Limite: ${p.maxUses === 0 ? 'ilimitado' : p.maxUses}`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Criar', onPress: () => doCreate(p) },
        ]
      );
    }
  }

  async function doCreate(payload: any) {
    setSaving(true);
    try {
      const functions = getFunctions(app, 'us-central1');
      const create = httpsCallable(functions, 'createCoupon');
      await create(payload);
      setFormModal(false);
      Alert.alert('✅ Cupom criado', `${payload.code} está ativo.`);
      loadCoupons();
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível criar o cupom.');
    } finally {
      setSaving(false);
    }
  }

  async function doUpdate(payload: any) {
    if (!editingId) return;
    setSaving(true);
    try {
      const functions = getFunctions(app, 'us-central1');
      const update = httpsCallable(functions, 'updateCoupon');
      // O código NÃO é alterado na edição (a CF ignora), mas enviamos o resto.
      await update({
        couponId: editingId,
        discountType: payload.discountType,
        discountValue: payload.discountValue,
        startDate: payload.startDate,
        expiresAt: payload.expiresAt,
        maxUses: payload.maxUses,
        minimumPurchaseAmount: payload.minimumPurchaseAmount,
      });
      setFormModal(false);
      Alert.alert('✅ Cupom atualizado');
      loadCoupons();
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível atualizar o cupom.');
    } finally {
      setSaving(false);
    }
  }

  const filtered = coupons.filter(c => couponMatchesFilter(c, filter));

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cupons</Text>
        <TouchableOpacity onPress={openCreate}>
          <Text style={styles.addBtn}>+ Novo</Text>
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTER_TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, filter === tab && styles.tabActive]}
              onPress={() => setFilter(tab)}
            >
              <Text style={[styles.tabText, filter === tab && styles.tabTextActive]}>
                {FILTER_LABEL[tab]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadCoupons}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id ?? item.code}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={loadCoupons} tintColor={colors.gold} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🎟️</Text>
              <Text style={styles.emptyText}>Nenhum cupom {FILTER_LABEL[filter].toLowerCase()}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const expired = isExpired(item);
            const statusLabel = expired ? 'EXPIRADO' : item.isActive ? 'ATIVO' : 'INATIVO';
            const statusColor = expired ? colors.gray : item.isActive ? colors.success : colors.error;
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.code}>{item.code}</Text>
                  <View style={[styles.statusBadge, { borderColor: statusColor }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>

                <View style={styles.cardRow}>
                  <Text style={styles.discount}>{discountLabel(item)} de desconto</Text>
                  <Text style={styles.uses}>Usos: {usesLabel(item)}</Text>
                </View>

                <Text style={styles.validity}>
                  Válido: {formatDateBR(item.startDate)} até {formatDateBR(item.expiresAt)}
                </Text>

                {item.minimumPurchaseAmount ? (
                  <Text style={styles.minPurchase}>
                    Mínimo: R$ {item.minimumPurchaseAmount.toFixed(2).replace('.', ',')}
                  </Text>
                ) : null}

                {/* Ações: editar + toggle */}
                <View style={styles.toggleRow}>
                  <TouchableOpacity onPress={() => openEdit(item)}>
                    <Text style={styles.editBtn}>✏️ Editar</Text>
                  </TouchableOpacity>
                  <View style={styles.toggleRight}>
                    <Text style={styles.toggleLabel}>
                      {item.isActive ? 'Ativo' : 'Desativado'}
                    </Text>
                    {processing === item.id ? (
                      <ActivityIndicator color={colors.gold} size="small" />
                    ) : (
                      <Switch
                        value={item.isActive}
                        onValueChange={() => handleToggle(item)}
                        trackColor={{ false: colors.grayDark, true: colors.success + '88' }}
                        thumbColor={item.isActive ? colors.success : colors.gray}
                      />
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Modal de formulário (criar OU editar) */}
      <Modal
        visible={formModal}
        transparent
        animationType="slide"
        onRequestClose={() => setFormModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {isEditing ? '✏️ Editar Cupom' : '🎟️ Novo Cupom'}
              </Text>

              <Text style={styles.fieldLabel}>Código {isEditing ? '(não editável)' : ''}</Text>
              <TextInput
                style={[styles.input, isEditing && styles.inputDisabled]}
                placeholder="PROMO10"
                placeholderTextColor={colors.gray}
                value={fCode}
                onChangeText={t => setFCode(t.toUpperCase())}
                autoCapitalize="characters"
                editable={!isEditing}
              />

              <Text style={styles.fieldLabel}>Tipo de desconto</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[styles.typeBtn, fType === 'percentage' && styles.typeBtnActive]}
                  onPress={() => setFType('percentage')}
                >
                  <Text style={[styles.typeBtnText, fType === 'percentage' && styles.typeBtnTextActive]}>
                    (%) Percentual
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, fType === 'fixed' && styles.typeBtnActive]}
                  onPress={() => setFType('fixed')}
                >
                  <Text style={[styles.typeBtnText, fType === 'fixed' && styles.typeBtnTextActive]}>
                    (R$) Valor fixo
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>
                Valor {fType === 'percentage' ? '(1 a 100)' : '(R$)'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={fType === 'percentage' ? '10' : '5,00'}
                placeholderTextColor={colors.gray}
                value={fValue}
                onChangeText={setFValue}
                keyboardType="decimal-pad"
              />

              <Text style={styles.fieldLabel}>Data inicial (dd/mm/aaaa)</Text>
              <TextInput
                style={styles.input}
                placeholder="01/07/2026"
                placeholderTextColor={colors.gray}
                value={fStart}
                onChangeText={setFStart}
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.fieldLabel}>Data final (dd/mm/aaaa)</Text>
              <TextInput
                style={styles.input}
                placeholder="31/07/2026"
                placeholderTextColor={colors.gray}
                value={fEnd}
                onChangeText={setFEnd}
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.fieldLabel}>Limite de uso (0 = ilimitado)</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={colors.gray}
                value={fMaxUses}
                onChangeText={setFMaxUses}
                keyboardType="number-pad"
              />

              <Text style={styles.fieldLabel}>Valor mínimo de compra (opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="0,00"
                placeholderTextColor={colors.gray}
                value={fMinPurchase}
                onChangeText={setFMinPurchase}
                keyboardType="decimal-pad"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setFormModal(false)}
                  disabled={saving}
                >
                  <Text style={styles.modalCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={confirmSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.background} size="small" />
                  ) : (
                    <Text style={styles.modalConfirmBtnText}>
                      {isEditing ? 'Salvar' : 'Criar cupom'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  addBtn: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  tabsWrap: { borderBottomWidth: 0.5, borderBottomColor: colors.grayDark },
  tab: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabText: { color: colors.gray, fontSize: fonts.sizes.sm },
  tabTextActive: { color: colors.gold, fontWeight: 'bold' },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md,
    gap: spacing.xs,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { color: colors.gold, fontSize: fonts.sizes.lg, fontWeight: 'bold', letterSpacing: 1 },
  statusBadge: {
    borderRadius: borderRadius.sm, borderWidth: 1,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  statusText: { fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  discount: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  uses: { color: colors.gray, fontSize: fonts.sizes.sm },
  validity: { color: colors.gray, fontSize: fonts.sizes.xs },
  minPurchase: { color: colors.gray, fontSize: fonts.sizes.xs },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.grayDark,
    paddingTop: spacing.sm,
  },
  editBtn: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  toggleRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggleLabel: { color: colors.gray, fontSize: fonts.sizes.sm },
  errorContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl,
  },
  errorIcon: { fontSize: 48 },
  errorText: { color: colors.error, fontSize: fonts.sizes.md, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.sm,
    padding: spacing.md, paddingHorizontal: spacing.xl,
  },
  retryBtnText: { color: colors.background, fontWeight: 'bold' },
  empty: { flex: 1, alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: '#000000aa',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.grayDark,
    padding: spacing.lg, maxHeight: '90%',
  },
  modalTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', marginBottom: spacing.md },
  fieldLabel: { color: colors.gray, fontSize: fonts.sizes.sm, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.background, borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: colors.grayDark, color: colors.white, padding: spacing.md,
    fontSize: fonts.sizes.md,
  },
  inputDisabled: { opacity: 0.5 },
  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeBtn: {
    flex: 1, padding: spacing.md, alignItems: 'center',
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.grayDark,
  },
  typeBtnActive: { borderColor: colors.gold, backgroundColor: colors.gold + '11' },
  typeBtnText: { color: colors.gray, fontSize: fonts.sizes.sm },
  typeBtnTextActive: { color: colors.gold, fontWeight: 'bold' },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  modalCancelBtn: {
    flex: 1, backgroundColor: colors.grayDark, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center',
  },
  modalCancelBtnText: { color: colors.white, fontWeight: 'bold' },
  modalConfirmBtn: {
    flex: 1, backgroundColor: colors.gold, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center',
  },
  modalConfirmBtnText: { color: colors.background, fontWeight: 'bold' },
});