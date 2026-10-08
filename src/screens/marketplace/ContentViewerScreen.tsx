// ============================================
// LUMINA — CONTEÚDO COMPRADO (visualizador protegido)
// src/screens/marketplace/ContentViewerScreen.tsx
//
// v3 (29/09):
// - VÍDEO: reprodutor protegido (expo-video). Antes, vídeo comprado
//   não abria — só aparecia o nome do arquivo.
// - BLOQUEIO de captura: Android (print e gravação saem pretos) e
//   iOS (gravação sai preta). O print do iOS não pode ser bloqueado
//   por app nenhum: ali ficam os dois detectores.
// - Detectores: listener nativo de print (os dois SOs) + perda de
//   foco rápida (só iOS, com carência de 2 s ao abrir). No Android a
//   captura é bloqueada — o detector de foco só puniria falsos
//   positivos (cortina de notificações, chamada).
// - Marca d'água móvel (e-mail parcial + uid) em imagem e vídeo.
// - Link renovado só quando FALHA — antes, a troca a cada 4min30
//   recarregava a imagem e reiniciaria o vídeo.
// - Tamanho da tela acompanha a rotação (useWindowDimensions).
//
// O acesso é decidido pelo servidor (getPurchasedContent e
// getSignedUrl): compra, arquivos removidos depois dela, produto
// tirado da venda.
// ============================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  Alert, TouchableOpacity, Image, FlatList, Platform,
  AppState, AppStateStatus, useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ScreenCapture from 'expo-screen-capture';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import app from '../../core/firebase';
import { getPurchasedContent } from '../../services/marketplace/productService';
import ScreenContainer from '../../components/ScreenContainer';
import ProtectedVideoPlayer from '../../components/media/ProtectedVideoPlayer';
import ProtectedPdfViewer from '../../components/media/ProtectedPdfViewer';
import MovingWatermark, { maskEmail } from '../../components/media/MovingWatermark';

type RouteProps = RouteProp<RootStackParamList, 'ContentViewer'>;

interface ProductFile {
  storagePath: string;
  type:        string;
  name:        string;
  size:        number;
  mimeType:    string;
}

type SignedUrlReq = { productId: string; storagePath: string };
type SignedUrlRes = { url: string };

/** Perda de foco mais curta que isto conta como possível print (iOS). */
const FOCUS_LOSS_MAX_MS = 1500;
/** Ao abrir, transições do sistema também tiram o foco — ignoradas. */
const FOCUS_GRACE_MS = 2000;
/** Um print pode disparar os dois detectores — conta uma vez. */
const REPORT_DEBOUNCE_MS = 1200;
const HIDE_AFTER_CAPTURE_MS = 3000;

const WARNING_MESSAGES = [
  {
    title: '🔒 Conteúdo Protegido',
    message: 'Este conteúdo é protegido por direitos autorais. Capturas de tela violam os Termos de Uso do Lumina e a Lei 9.610/98.\n\nSua conta pode ser banida.',
    button: 'Entendi, não farei mais',
  },
  {
    title: '⚠️ Último aviso',
    message: 'Esta é sua última oportunidade.\n\nUma nova captura de tela resultará no banimento permanente da sua conta.',
    button: 'Me arrependo, não farei mais',
  },
  {
    title: '🚨 Limite atingido',
    message: 'Você atingiu o limite de avisos.\n\nA próxima captura resultará em banimento imediato. Nossa equipe foi notificada.',
    button: 'Entendi',
  },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('zip')) return '📦';
  return '📁';
}

export default function ContentViewerScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { productId } = route.params;
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  // Bloqueio de captura enquanto a tela estiver aberta.
  ScreenCapture.usePreventScreenCapture();

  const [title, setTitle]               = useState('Conteúdo');
  const [files, setFiles]               = useState<ProductFile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [signedUrl, setSignedUrl]       = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [urlLoading, setUrlLoading]     = useState(false);
  const [contentHidden, setContentHidden] = useState(false);
  const [imageError, setImageError]     = useState(false);
  const [fullscreen, setFullscreen]     = useState(false);

  const screenshotCount  = useRef(0);
  const lastReportRef    = useRef(0);
  const backgroundedAt   = useRef<number | null>(null);
  const mountedAt        = useRef(Date.now());
  const hideTimer        = useRef<ReturnType<typeof setTimeout> | null>(null);

  const watermark = [maskEmail(user?.email), user?.uid?.slice(0, 8)].filter(Boolean).join(' · ');

  // ============================================
  // Captura detectada (listener nativo ou perda de foco no iOS)
  // ============================================
  const handleScreenshot = useCallback(async () => {
    const now = Date.now();
    if (now - lastReportRef.current < REPORT_DEBOUNCE_MS) return;
    lastReportRef.current = now;

    screenshotCount.current += 1;
    const count = screenshotCount.current;

    setContentHidden(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setContentHidden(false), HIDE_AFTER_CAPTURE_MS);

    if (user?.uid) {
      httpsCallable(getFunctions(app, 'us-central1'), 'reportScreenshot')({ productId })
        .catch(() => { /* não bloqueia o fluxo */ });
    }

    const warning = WARNING_MESSAGES[Math.min(count - 1, WARNING_MESSAGES.length - 1)];
    Alert.alert(warning.title, warning.message, [{ text: warning.button, style: 'default' }]);
  }, [productId, user?.uid]);

  useEffect(() => {
    // 1. Listener nativo de print (iOS + Android)
    const subscription = ScreenCapture.addScreenshotListener(() => { handleScreenshot(); });

    // 2. Perda de foco rápida — só iOS, onde o print não é bloqueável.
    let appStateSub: { remove: () => void } | null = null;
    if (Platform.OS === 'ios') {
      appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
        if (state === 'active') {
          const bgAt = backgroundedAt.current;
          backgroundedAt.current = null;
          if (bgAt === null) return;
          if (bgAt - mountedAt.current < FOCUS_GRACE_MS) return;
          const away = Date.now() - bgAt;
          if (away > 0 && away < FOCUS_LOSS_MAX_MS) handleScreenshot();
        } else {
          backgroundedAt.current = Date.now();
        }
      });
    }

    return () => {
      subscription.remove();
      appStateSub?.remove();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [handleScreenshot]);

  // ============================================
  // Produto e arquivos (o servidor filtra pela compra)
  // ============================================
  useEffect(() => {
    loadProduct();
  }, []);

  async function loadProduct() {
    setLoading(true);
    try {
      const content = await getPurchasedContent(productId);
      setTitle(content.title);
      if (content.files.length === 0) {
        Alert.alert('Aviso', 'Este produto não possui arquivos disponíveis.');
        navigation.goBack();
        return;
      }
      setFiles(content.files as ProductFile[]);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar o conteúdo.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  // ============================================
  // Link temporário
  // ============================================
  const fetchSignedUrl = useCallback(async (storagePath: string): Promise<string> => {
    const getUrl = httpsCallable<SignedUrlReq, SignedUrlRes>(getFunctions(app, 'us-central1'), 'getSignedUrl');
    const result = await getUrl({ productId, storagePath });
    return result.data.url;
  }, [productId]);

  const loadSelected = useCallback(async (storagePath: string) => {
    setUrlLoading(true);
    setSignedUrl(null);
    setImageError(false);
    try {
      setSignedUrl(await fetchSignedUrl(storagePath));
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code ?? '';
      if (code === 'functions/permission-denied') {
        Alert.alert('Acesso negado', 'Você não tem acesso a este conteúdo.',
          [{ text: 'Voltar', onPress: () => navigation.goBack() }]);
      } else if (code === 'functions/resource-exhausted') {
        Alert.alert('Limite atingido', 'Você atingiu o limite de acessos. Tente novamente mais tarde.');
        navigation.goBack();
      } else {
        Alert.alert('Erro', 'Não foi possível carregar o conteúdo. Tente novamente.');
      }
    } finally {
      setUrlLoading(false);
    }
  }, [fetchSignedUrl, navigation]);

  useEffect(() => {
    const file = files[selectedIndex];
    if (file) loadSelected(file.storagePath);
  }, [selectedIndex, files, loadSelected]);

  // ============================================
  // Conteúdo
  // ============================================
  function renderContent() {
    if (urlLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Carregando conteúdo seguro...</Text>
        </View>
      );
    }

    if (contentHidden) {
      return (
        <View style={styles.center}>
          <Text style={styles.bigIcon}>🔒</Text>
          <Text style={styles.hiddenText}>Conteúdo temporariamente oculto</Text>
        </View>
      );
    }

    const currentFile = files[selectedIndex];
    if (!currentFile || !signedUrl) return null;
    const mimeType = currentFile.mimeType ?? '';

    // Vídeo
    if (mimeType.startsWith('video/')) {
      return (
        <View style={styles.videoArea}>
          <ProtectedVideoPlayer
            key={currentFile.storagePath}
            uri={signedUrl}
            watermark={watermark}
            refreshUrl={() => fetchSignedUrl(currentFile.storagePath)}
            onFullscreenChange={setFullscreen}
          />
          {!fullscreen && <Text style={styles.videoName} numberOfLines={2}>{currentFile.name}</Text>}
        </View>
      );
    }

    // Imagem
    if (mimeType.startsWith('image/')) {
      if (imageError) {
        return (
          <View style={styles.center}>
            <Text style={styles.bigIcon}>⚠️</Text>
            <Text style={styles.errorText}>Erro ao carregar imagem</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadSelected(currentFile.storagePath)}>
              <Text style={styles.retryBtnText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        );
      }
      return (
        <View style={styles.imageArea}>
          <Image
            source={{ uri: signedUrl }}
            style={[styles.imageContent, { width }]}
            resizeMode="contain"
            onError={() => setImageError(true)}
          />
          <MovingWatermark text={watermark} />
        </View>
      );
    }

    // PDF
    if (mimeType === 'application/pdf') {
      return (
        <ProtectedPdfViewer
          key={currentFile.storagePath}
          uri={signedUrl}
          watermark={watermark}
          refreshUrl={() => fetchSignedUrl(currentFile.storagePath)}
        />
      );
    }

    // Demais tipos (ex.: .zip) — não são exibidos dentro do app.
    return (
      <View style={styles.center}>
        <Text style={styles.bigIcon}>{getFileIcon(mimeType)}</Text>
        <Text style={styles.fileTitle}>{currentFile.name}</Text>
        <Text style={styles.fileMeta}>{formatBytes(currentFile.size)}</Text>
        <View style={styles.protectedBox}>
          <Text style={styles.protectedText}>🔒 Conteúdo protegido</Text>
          <Text style={styles.protectedSubtext}>Este formato não é exibido no app. Se precisar de ajuda, fale com o suporte.</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
            <Text style={styles.backBtn}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Conteúdo</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Verificando acesso...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {!fullscreen && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
            <Text style={styles.backBtn}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>
      )}

      {!fullscreen && files.length > 1 && (
        <View style={styles.fileSelector}>
          <FlatList
            data={files}
            keyExtractor={(_, i) => String(i)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.fileSelectorContent}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[styles.fileTab, index === selectedIndex && styles.fileTabActive]}
                onPress={() => { if (index !== selectedIndex) setSelectedIndex(index); }}
                accessibilityRole="tab"
              >
                <Text style={styles.fileTabIcon}>{getFileIcon(item.mimeType)}</Text>
                <Text style={[styles.fileTabText, index === selectedIndex && styles.fileTabTextActive]} numberOfLines={1}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <View style={styles.contentArea}>
        {renderContent()}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn:     { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  fileSelector: { borderBottomWidth: 0.5, borderBottomColor: colors.grayDark, maxHeight: 60 },
  fileSelectorContent: { paddingHorizontal: spacing.md, gap: spacing.sm, alignItems: 'center' },
  fileTab: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.grayDark, maxWidth: 160,
  },
  fileTabActive:     { borderColor: colors.gold, backgroundColor: colors.gold + '11' },
  fileTabIcon:       { fontSize: 16 },
  fileTabText:       { color: colors.gray, fontSize: fonts.sizes.xs },
  fileTabTextActive: { color: colors.gold, fontWeight: 'bold' },
  contentArea: { flex: 1 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loadingText: { color: colors.gray, marginTop: spacing.md, fontSize: fonts.sizes.md },
  bigIcon:     { fontSize: 64, marginBottom: spacing.md },
  hiddenText:  { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
  videoArea:   { flex: 1, justifyContent: 'center', gap: spacing.md },
  videoName:   { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center', paddingHorizontal: spacing.lg },
  imageArea:   { flex: 1 },
  imageContent: { flex: 1 },
  fileTitle:   { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', textAlign: 'center', marginBottom: spacing.xs },
  fileMeta:    { color: colors.gray, fontSize: fonts.sizes.sm, marginBottom: spacing.lg },
  protectedBox: {
    backgroundColor: colors.gold + '11', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gold + '33',
    padding: spacing.md, alignItems: 'center', gap: spacing.xs,
  },
  protectedText:    { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  protectedSubtext: { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center' },
  errorText:   { color: colors.error, fontSize: fonts.sizes.md, textAlign: 'center', marginBottom: spacing.lg },
  retryBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  retryBtnText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
});