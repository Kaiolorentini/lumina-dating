import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, Alert, Modal,
  Linking, Dimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Button, Card, Input } from '../../components/ui';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Video, ResizeMode } from 'expo-av';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS , alpha , colors } from '../../theme/tokens';
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
        <ActivityIndicator color={COLORS.gold} size="large" />
      </ScreenContainer>
    );
  }

  if (error || !product) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Revisar Produto</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[styles.center, { flex: 1, padding: SPACING.xl }]}>
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
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
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
                      <ActivityIndicator color={COLORS.gold} size="small" />
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
              <ActivityIndicator color={COLORS.gold} style={{ paddingVertical: SPACING.md }} />
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
            <Input
              placeholder="Informe o motivo da rejeição..."
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button label="Cancelar" variant="ghost" onPress={() => setRejectModal(false)} />
              <Button label="Confirmar" variant="primary" onPress={confirmReject} />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.gold + '44',
  },
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, flex: 1, textAlign: 'center' },
  content: { paddingBottom: SPACING.xl },
  cover: { width, height: 240, backgroundColor: COLORS.card },
  noCover: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body },
  previewRow: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  previewThumb: {
    width: 90, height: 90, borderRadius: BORDER_RADIUS.sm, marginRight: SPACING.sm,
    backgroundColor: COLORS.card,
  },
  block: { padding: SPACING.md, gap: SPACING.xs },
  title: { color: COLORS.textPrimary, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.xs },
  category: { color: COLORS.gold, fontSize: FONT_SIZE.caption, textTransform: 'capitalize' },
  price: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.xs },
  chip: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  sectionLabel: {
    color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold,
    marginTop: SPACING.sm, marginBottom: SPACING.xs,
  },
  description: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body, lineHeight: 22 },
  attentionBox: {
    marginHorizontal: SPACING.md, padding: SPACING.md,
    backgroundColor: COLORS.gold + '11', borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: COLORS.gold + '44', gap: 2,
  },
  attentionTitle: { color: COLORS.gold, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs },
  attentionLine: { color: COLORS.textPrimary, fontSize: FONT_SIZE.caption },
  fileItem: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  fileHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  fileIconText: { fontSize: 24 },
  fileName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  fileMeta: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  viewBtn: {
    backgroundColor: COLORS.gold + '22', borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.gold,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  viewBtnText: { color: COLORS.gold, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.caption },
  openedImage: {
    width: '100%', height: 320, marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.sm, backgroundColor: COLORS.background,
  },
  openedVideo: {
    width: '100%', height: 240, marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.sm, backgroundColor: '#000',
  },
  ownerName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  ownerUid: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  profileBtn: {
    marginTop: SPACING.sm, alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  profileBtnText: { color: COLORS.gold, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  actions: { padding: SPACING.md, gap: SPACING.sm },
  approveBtn: {
    backgroundColor: COLORS.success + '22', borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: COLORS.success, padding: SPACING.md, alignItems: 'center',
  },
  approveBtnText: { color: COLORS.success, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.body },
  rejectBtn: {
    backgroundColor: COLORS.error + '11', borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: COLORS.error, padding: SPACING.md, alignItems: 'center',
  },
  rejectBtnText: { color: COLORS.error, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.body },
  statusBox: {
    margin: SPACING.md, padding: SPACING.md,
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  statusText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  statusReason: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, marginTop: SPACING.xs },
  errorIcon: { fontSize: 48 },
  errorText: { color: COLORS.error, fontSize: FONT_SIZE.body, textAlign: 'center', marginTop: SPACING.md },
  retryBtn: {
    backgroundColor: COLORS.gold, borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md, paddingHorizontal: SPACING.xl, marginTop: SPACING.md,
  },
  retryBtnText: { color: COLORS.background, fontWeight: FONT_WEIGHT.bold },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: alpha(colors.black, 0.53),
    alignItems: 'center', justifyContent: 'center', padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.lg, width: '100%', gap: SPACING.md,
  },
  modalTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  modalSubtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  modalActions: { flexDirection: 'row', gap: SPACING.sm },
});
