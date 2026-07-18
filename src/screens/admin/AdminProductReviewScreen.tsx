import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput,
  Linking, Dimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Video, ResizeMode } from 'expo-av';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { getProduct } from '../../services/marketplace/productService';
import { getUserById } from '../../services/marketplace/adminService';
import { Product, ProductFile } from '../../shared/types/marketplace';
import { UserProfile } from '../../shared/types';
import { useSuperAdminGuard } from '../../hooks/useAdminGuard';
import app from '../../core/firebase';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'AdminProductReview'>;
const { width } = Dimensions.get('window');

interface ModeratorFileResult {
  name: string;
  type: string;
  mimeType: string;
  size: number;
  url: string;
  expiresInSeconds: number;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: any): string {
  try {
    const d = value?.toDate ? value.toDate() : value instanceof Date ? value : null;
    if (!d) return '';
    return d.toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
}

function fileIcon(file: ProductFile): string {
  const m = file.mimeType ?? '';
  if (m.startsWith('image/')) return '🖼️';
  if (m.startsWith('video/')) return '🎬';
  if (m === 'application/pdf') return '📄';
  if (m.includes('zip')) return '📦';
  return '📁';
}

function isImage(mimeType: string): boolean {
  return typeof mimeType === 'string' && mimeType.startsWith('image/');
}

function isVideo(mimeType: string): boolean {
  return typeof mimeType === 'string' && mimeType.startsWith('video/');
}

export default function AdminProductReviewScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const { productId } = route.params;
  const { user } = useAuth();
  const { blocked, loading: guardLoading } = useSuperAdminGuard();

  const [product, setProduct] = useState<Product | null>(null);
  const [ownerName, setOwnerName] = useState<string>('');
  const [ownerSince, setOwnerSince] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Visualização de arquivo sob demanda
  const [loadingFileIndex, setLoadingFileIndex] = useState<number | null>(null);
  const [openedImages, setOpenedImages] = useState<Record<number, string>>({});
  const [openedVideos, setOpenedVideos] = useState<Record<number, string>>({});

  // Ações
  const [processing, setProcessing] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await getProduct(productId);
      if (!p) {
        setError('Produto não encontrado');
        return;
      }
      setProduct(p);

      try {
        const profile = await getUserById(p.ownerId) as (UserProfile & { createdAt?: any }) | null;
        setOwnerName(profile?.name ?? p.ownerId.slice(0, 16) + '...');
        const since = formatDate(profile?.createdAt);
        if (since) setOwnerSince(since);
      } catch {
        setOwnerName(p.ownerId.slice(0, 16) + '...');
      }
    } catch (e: any) {
      setError(e.message ?? 'Erro ao carregar produto');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { loadData(); }, [productId]);

  if (guardLoading || blocked) return null;

  async function handleViewFile(file: ProductFile, index: number) {
    setLoadingFileIndex(index);
    try {
      const functions = getFunctions(app, 'us-central1');
      const fn = httpsCallable<{ productId: string; fileIndex: number }, { file: ModeratorFileResult }>(
        functions, 'getModeratorFileUrl'
      );
      const result = await fn({ productId, fileIndex: index });
      const signed = result.data.file;

      if (isImage(signed.mimeType) || isImage(file.mimeType)) {
        // Renderiza imagem inline
        setOpenedImages(prev => ({ ...prev, [index]: signed.url }));
      } else if (isVideo(signed.mimeType) || isVideo(file.mimeType)) {
        // Renderiza vídeo inline com player (streaming pela signed URL)
        setOpenedVideos(prev => ({ ...prev, [index]: signed.url }));
      } else {
        // PDF / zip / outros — abre externo
        const canOpen = await Linking.canOpenURL(signed.url);
        if (canOpen) {
          await Linking.openURL(signed.url);
        } else {
          Alert.alert('Não foi possível abrir', 'O sistema não conseguiu abrir este arquivo.');
        }
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível carregar o arquivo.');
    } finally {
      setLoadingFileIndex(null);
    }
  }

  async function handleApprove() {
    if (!product) return;
    Alert.alert('Aprovar produto?', `Aprovar "${product.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aprovar',
        onPress: async () => {
          setProcessing(true);
          try {
            const functions = getFunctions(app, 'us-central1');
            const approve = httpsCallable(functions, 'onApproveProduct');
            await approve({ productId });
            Alert.alert('✅ Produto aprovado!', undefined, [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } catch (e: any) {
            Alert.alert('Erro', e.message);
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  }

  async function confirmReject() {
    if (!product) return;
    if (!rejectReason.trim()) {
      Alert.alert('Erro', 'Informe o motivo da rejeição.');
      return;
    }
    setRejectModal(false);
    setProcessing(true);
    try {
      const functions = getFunctions(app, 'us-central1');
      const reject = httpsCallable(functions, 'onRejectProduct');
      await reject({ productId, reason: rejectReason.trim() });
      Alert.alert('❌ Produto rejeitado', undefined, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer style={styles.center}>
        <ActivityIndicator color={colors.gold} size="large" />
      </ScreenContainer>
    );
  }

  if (error || !product) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Revisar Produto</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[styles.center, { flex: 1, padding: spacing.xl }]}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error ?? 'Produto não encontrado'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const files = product.files ?? [];
  const totalBytes = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
  const cover = product.coverImage;
  const previews = (product.previewImages ?? []).filter(Boolean);
  const isPending = product.status === 'pending';

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Revisar Produto</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Capa */}
        {cover ? (
          <Image source={{ uri: cover }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, styles.center]}>
            <Text style={styles.noCover}>Sem capa</Text>
          </View>
        )}

        {/* Previews públicas (se houver) */}
        {previews.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewRow}>
            {previews.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.previewThumb} resizeMode="cover" />
            ))}
          </ScrollView>
        )}

        {/* Info do produto */}
        <View style={styles.block}>
          <Text style={styles.title}>{product.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.category}>{product.category}</Text>
            <Text style={styles.price}>
              {product.isFree ? 'Grátis' : `R$ ${product.price.toFixed(2).replace('.', ',')}`}
            </Text>
          </View>
          {product.tags?.length > 0 && (
            <View style={styles.chipRow}>
              {product.tags.map(tag => (
                <View key={tag} style={styles.chip}>
                  <Text style={styles.chipText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.sectionLabel}>Descrição</Text>
          <Text style={styles.description}>{product.description || '—'}</Text>
        </View>

        {/* ⚠️ Bloco de atenção */}
        <View style={styles.attentionBox}>
          <Text style={styles.attentionTitle}>⚠️ Resumo para moderação</Text>
          <Text style={styles.attentionLine}>• {files.length} arquivo(s) enviado(s)</Text>
          <Text style={styles.attentionLine}>• {formatBytes(totalBytes)} no total</Text>
          <Text style={styles.attentionLine}>• Criado em: {formatDate(product.createdAt) || '—'}</Text>
          {ownerSince ? (
            <Text style={styles.attentionLine}>• Criador desde: {ownerSince}</Text>
          ) : null}
        </View>

        {/* Arquivos enviados */}
        <View style={styles.block}>
          <Text style={styles.sectionLabel}>Conteúdo enviado ({files.length})</Text>
          {files.length === 0 ? (
            <Text style={styles.description}>Nenhum arquivo enviado.</Text>
          ) : (
            files.map((file, index) => (
              <View key={index} style={styles.fileItem}>
                <View style={styles.fileHeader}>
                  <Text style={styles.fileIconText}>{fileIcon(file)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                    <Text style={styles.fileMeta}>
                      {file.mimeType} · {formatBytes(file.size)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.viewBtn}
                    onPress={() => handleViewFile(file, index)}
                    disabled={loadingFileIndex === index}
                  >
                    {loadingFileIndex === index ? (
                      <ActivityIndicator color={colors.gold} size="small" />
                    ) : (
                      <Text style={styles.viewBtnText}>👁️ Ver</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Imagem renderizada inline */}
                {openedImages[index] && (
                  <Image
                    source={{ uri: openedImages[index] }}
                    style={styles.openedImage}
                    resizeMode="contain"
                  />
                )}

                {/* Vídeo renderizado inline com player (streaming) */}
                {openedVideos[index] && (
                  <Video
                    source={{ uri: openedVideos[index] }}
                    style={styles.openedVideo}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    isLooping={false}
                  />
                )}
              </View>
            ))
          )}
        </View>

        {/* Criador */}
        <View style={styles.block}>
          <Text style={styles.sectionLabel}>Criador</Text>
          <Text style={styles.ownerName}>👤 {ownerName}</Text>
          <Text style={styles.ownerUid}>UID: {product.ownerId}</Text>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('AdminUserDetail', { userId: product.ownerId })}
          >
            <Text style={styles.profileBtnText}>Ver perfil completo →</Text>
          </TouchableOpacity>
        </View>

        {/* Ações — só se pending */}
        {isPending && (
          <View style={styles.actions}>
            {processing ? (
              <ActivityIndicator color={colors.gold} style={{ paddingVertical: spacing.md }} />
            ) : (
              <>
                <TouchableOpacity style={styles.approveBtn} onPress={handleApprove}>
                  <Text style={styles.approveBtnText}>✅ Aprovar produto</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => { setRejectReason(''); setRejectModal(true); }}
                >
                  <Text style={styles.rejectBtnText}>❌ Rejeitar produto</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Status atual (se não pending) */}
        {!isPending && (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>
              Status atual: {product.status === 'approved' ? '✅ Aprovado' : product.status === 'rejected' ? '❌ Rejeitado' : product.status}
            </Text>
            {product.status === 'rejected' && product.rejectionReason && (
              <Text style={styles.statusReason}>Motivo: {product.rejectionReason}</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal de rejeição */}
      <Modal
        visible={rejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>❌ Rejeitar produto</Text>
            <Text style={styles.modalSubtitle}>{product.title}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Informe o motivo da rejeição..."
              placeholderTextColor={colors.gray}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRejectModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmReject}>
                <Text style={styles.modalConfirmBtnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  content: { paddingBottom: spacing.xl },
  cover: { width, height: 240, backgroundColor: colors.surface },
  noCover: { color: colors.gray, fontSize: fonts.sizes.md },
  previewRow: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  previewThumb: {
    width: 90, height: 90, borderRadius: borderRadius.sm, marginRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  block: { padding: spacing.md, gap: spacing.xs },
  title: { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  category: { color: colors.gold, fontSize: fonts.sizes.sm, textTransform: 'capitalize' },
  price: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  chip: {
    backgroundColor: colors.surface, borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.grayDark,
  },
  chipText: { color: colors.gray, fontSize: fonts.sizes.xs },
  sectionLabel: {
    color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold',
    marginTop: spacing.sm, marginBottom: spacing.xs,
  },
  description: { color: colors.gray, fontSize: fonts.sizes.md, lineHeight: 22 },
  attentionBox: {
    marginHorizontal: spacing.md, padding: spacing.md,
    backgroundColor: colors.gold + '11', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gold + '44', gap: 2,
  },
  attentionTitle: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold', marginBottom: spacing.xs },
  attentionLine: { color: colors.white, fontSize: fonts.sizes.sm },
  fileItem: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  fileHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fileIconText: { fontSize: 24 },
  fileName: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  fileMeta: { color: colors.gray, fontSize: fonts.sizes.xs },
  viewBtn: {
    backgroundColor: colors.gold + '22', borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gold,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  viewBtnText: { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  openedImage: {
    width: '100%', height: 320, marginTop: spacing.md,
    borderRadius: borderRadius.sm, backgroundColor: colors.background,
  },
  openedVideo: {
    width: '100%', height: 240, marginTop: spacing.md,
    borderRadius: borderRadius.sm, backgroundColor: '#000',
  },
  ownerName: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  ownerUid: { color: colors.gray, fontSize: fonts.sizes.xs },
  profileBtn: {
    marginTop: spacing.sm, alignSelf: 'flex-start',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.grayDark,
  },
  profileBtnText: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  actions: { padding: spacing.md, gap: spacing.sm },
  approveBtn: {
    backgroundColor: colors.success + '22', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.success, padding: spacing.md, alignItems: 'center',
  },
  approveBtnText: { color: colors.success, fontWeight: 'bold', fontSize: fonts.sizes.md },
  rejectBtn: {
    backgroundColor: colors.error + '11', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.error, padding: spacing.md, alignItems: 'center',
  },
  rejectBtnText: { color: colors.error, fontWeight: 'bold', fontSize: fonts.sizes.md },
  statusBox: {
    margin: spacing.md, padding: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark,
  },
  statusText: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  statusReason: { color: colors.gray, fontSize: fonts.sizes.sm, marginTop: spacing.xs },
  errorIcon: { fontSize: 48 },
  errorText: { color: colors.error, fontSize: fonts.sizes.md, textAlign: 'center', marginTop: spacing.md },
  retryBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.sm,
    padding: spacing.md, paddingHorizontal: spacing.xl, marginTop: spacing.md,
  },
  retryBtnText: { color: colors.background, fontWeight: 'bold' },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: '#00000088',
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.lg, width: '100%', gap: spacing.md,
  },
  modalTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  modalSubtitle: { color: colors.gray, fontSize: fonts.sizes.sm },
  modalInput: {
    backgroundColor: colors.background, borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: colors.grayDark, color: colors.white, padding: spacing.md,
    fontSize: fonts.sizes.md, textAlignVertical: 'top', minHeight: 80,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalCancelBtn: {
    flex: 1, backgroundColor: colors.grayDark, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center',
  },
  modalCancelBtnText: { color: colors.white, fontWeight: 'bold' },
  modalConfirmBtn: {
    flex: 1, backgroundColor: colors.error, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center',
  },
  modalConfirmBtnText: { color: colors.white, fontWeight: 'bold' },
});