// ============================================
// CONTENT VIEWER SCREEN — DRM PROTEGIDO
//
// getSignedUrl real implementado.
// URL expira em 5 minutos — auto-refresh on error.
// Screenshot: apenas DETECTADO e SINALIZADO em ambos os SOs
//   (não bloqueia — FLAG_SECURE não é confiável em MIUI etc.)
//   Dupla detecção sem permissão: addScreenshotListener + AppState.
// Watermark com UID do usuário.
// ============================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  Alert, TouchableOpacity, Dimensions, Image,
  FlatList, Platform, AppState, AppStateStatus,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ScreenCapture from 'expo-screen-capture';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import app from '../../core/firebase';
import { getProduct } from '../../services/marketplace/productService';
import { Product } from '../../shared/types/marketplace';
import ScreenContainer from '../../components/ScreenContainer';

type RouteProps = RouteProp<RootStackParamList, 'ContentViewer'>;
const { width, height } = Dimensions.get('window');

interface ProductFile {
  storagePath: string;
  type: string;
  name: string;
  size: number;
  mimeType: string;
}

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
  const { productId, purchaseId } = route.params;
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [files, setFiles] = useState<ProductFile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [urlLoading, setUrlLoading] = useState(false);
  const [contentHidden, setContentHidden] = useState(false);
  const [imageError, setImageError] = useState(false);

  const screenshotCount = useRef(0);
  const urlExpiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce anti-duplicidade: se listener e AppState dispararem
  // quase juntos para o MESMO print, conta só uma vez.
  const lastReportRef = useRef<number>(0);

  // AppState: marca quando o app deixou de ficar ativo
  const backgroundedAtRef = useRef<number | null>(null);

  // handleScreenshot precisa ser estável para os listeners
  const handleScreenshot = useCallback(async () => {
    // Debounce de 1.2s — evita contagem dupla no mesmo print
    const now = Date.now();
    if (now - lastReportRef.current < 1200) return;
    lastReportRef.current = now;

    screenshotCount.current += 1;
    const count = screenshotCount.current;

    setContentHidden(true);
    setTimeout(() => setContentHidden(false), 3000);

    if (user?.uid) {
      try {
        const functions = getFunctions(app, 'us-central1');
        const report = httpsCallable(functions, 'reportScreenshot');
        await report({ productId });
      } catch {
        // Falha silenciosa — não bloqueia o fluxo
      }
    }

    const warningIndex = Math.min(count - 1, WARNING_MESSAGES.length - 1);
    const warning = WARNING_MESSAGES[warningIndex];
    Alert.alert(warning.title, warning.message, [
      { text: warning.button, style: 'default' },
    ]);
  }, [productId, user?.uid]);

  // ============================================
  // DRM — Detecção de screenshot (ambos SOs, sem bloqueio)
  // ============================================
  useEffect(() => {
    // 1. Listener nativo de screenshot (iOS + Android)
    const subscription = ScreenCapture.addScreenshotListener(() => {
      handleScreenshot();
    });

    // 2. AppState — indício de print por perda rápida de foco.
    //    Complementa o listener no Android sem exigir permissão.
    //    Só conta se voltar em menos de 1.5s (padrão de screenshot),
    //    não uma troca de app comum.
    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        const bgAt = backgroundedAtRef.current;
        if (bgAt !== null) {
          const away = Date.now() - bgAt;
          if (away > 0 && away < 1500) {
            handleScreenshot();
          }
        }
        backgroundedAtRef.current = null;
      } else {
        // inactive / background
        backgroundedAtRef.current = Date.now();
      }
    };
    const appStateSub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      subscription.remove();
      appStateSub.remove();
      if (urlExpiryTimer.current) clearTimeout(urlExpiryTimer.current);
    };
  }, [handleScreenshot]);

  // ============================================
  // Load product + files
  // ============================================
  useEffect(() => {
    loadProduct();
  }, []);

  async function loadProduct() {
    setLoading(true);
    try {
      const p = await getProduct(productId);
      if (!p) {
        Alert.alert('Erro', 'Produto não encontrado.');
        navigation.goBack();
        return;
      }

      setProduct(p);
      const productFiles = (p.files ?? []) as ProductFile[];

      if (productFiles.length === 0) {
        Alert.alert('Aviso', 'Este produto não possui arquivos disponíveis.');
        navigation.goBack();
        return;
      }

      setFiles(productFiles);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar o conteúdo.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  // ============================================
  // Load signed URL for selected file
  // ============================================
  useEffect(() => {
    if (files.length > 0 && files[selectedIndex]) {
      loadSignedUrl(files[selectedIndex].storagePath);
    }
  }, [selectedIndex, files]);

  async function loadSignedUrl(storagePath: string) {
    setUrlLoading(true);
    setSignedUrl(null);
    setImageError(false);

    // Clear previous expiry timer
    if (urlExpiryTimer.current) clearTimeout(urlExpiryTimer.current);

    try {
      const functions = getFunctions(app, 'us-central1');
      const getUrl = httpsCallable(functions, 'getSignedUrl');
      const result = await getUrl({ productId, storagePath }) as any;
      const url: string = result.data.url;
      setSignedUrl(url);

      // Auto-refresh a 4min30s (URL expira em 5min)
      urlExpiryTimer.current = setTimeout(() => {
        loadSignedUrl(storagePath);
      }, 4 * 60 * 1000 + 30 * 1000);
    } catch (error: any) {
      const code = error?.code ?? '';
      if (code === 'functions/permission-denied') {
        Alert.alert(
          'Acesso negado',
          'Você não tem acesso a este conteúdo.',
          [{ text: 'Voltar', onPress: () => navigation.goBack() }]
        );
      } else if (code === 'functions/resource-exhausted') {
        Alert.alert('Limite atingido', 'Você atingiu o limite de acessos. Tente novamente mais tarde.');
        navigation.goBack();
      } else {
        Alert.alert('Erro', 'Não foi possível carregar o conteúdo. Tente novamente.');
      }
    } finally {
      setUrlLoading(false);
    }
  }

  // ============================================
  // Render file content
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

    // Imagem
    if (mimeType.startsWith('image/')) {
      if (imageError) {
        return (
          <View style={styles.center}>
            <Text style={styles.bigIcon}>⚠️</Text>
            <Text style={styles.errorText}>Erro ao carregar imagem</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setImageError(false);
                loadSignedUrl(currentFile.storagePath);
              }}
            >
              <Text style={styles.retryBtnText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <Image
          source={{ uri: signedUrl }}
          style={styles.imageContent}
          resizeMode="contain"
          onError={() => setImageError(true)}
        />
      );
    }

    // Outros tipos — info do arquivo
    return (
      <View style={styles.center}>
        <Text style={styles.bigIcon}>{getFileIcon(mimeType)}</Text>
        <Text style={styles.fileTitle}>{currentFile.name}</Text>
        <Text style={styles.fileMeta}>{formatBytes(currentFile.size)}</Text>
        <View style={styles.protectedBox}>
          <Text style={styles.protectedText}>
            🔒 Conteúdo protegido carregado
          </Text>
          <Text style={styles.protectedSubtext}>
            Visualização disponível no app
          </Text>
        </View>
      </View>
    );
  }

  // ============================================
  // Loading state
  // ============================================
  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
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

  // ============================================
  // Main render
  // ============================================
  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {product?.title ?? 'Conteúdo'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Seletor de arquivo — se múltiplos */}
      {files.length > 1 && (
        <View style={styles.fileSelector}>
          <FlatList
            data={files}
            keyExtractor={(_, i) => String(i)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.fileSelectorContent}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  styles.fileTab,
                  index === selectedIndex && styles.fileTabActive,
                ]}
                onPress={() => {
                  if (index !== selectedIndex) {
                    setSelectedIndex(index);
                    setImageError(false);
                  }
                }}
              >
                <Text style={styles.fileTabIcon}>{getFileIcon(item.mimeType)}</Text>
                <Text
                  style={[styles.fileTabText, index === selectedIndex && styles.fileTabTextActive]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Conteúdo */}
      <View style={styles.contentArea}>
        {renderContent()}
      </View>

      {/* Watermark com UID */}
      <View style={styles.watermark} pointerEvents="none">
        <Text style={styles.watermarkText}>{user?.uid?.slice(0, 8)}</Text>
      </View>
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
  headerTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  fileSelector: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.grayDark,
    maxHeight: 60,
  },
  fileSelectorContent: { paddingHorizontal: spacing.md, gap: spacing.sm, alignItems: 'center' },
  fileTab: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.grayDark,
    maxWidth: 160,
  },
  fileTabActive: { borderColor: colors.gold, backgroundColor: colors.gold + '11' },
  fileTabIcon: { fontSize: 16 },
  fileTabText: { color: colors.gray, fontSize: fonts.sizes.xs },
  fileTabTextActive: { color: colors.gold, fontWeight: 'bold' },
  contentArea: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loadingText: { color: colors.gray, marginTop: spacing.md, fontSize: fonts.sizes.md },
  bigIcon: { fontSize: 64, marginBottom: spacing.md },
  hiddenText: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
  imageContent: { flex: 1, width },
  fileTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', textAlign: 'center', marginBottom: spacing.xs },
  fileMeta: { color: colors.gray, fontSize: fonts.sizes.sm, marginBottom: spacing.lg },
  protectedBox: {
    backgroundColor: colors.gold + '11', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gold + '33',
    padding: spacing.md, alignItems: 'center', gap: spacing.xs,
  },
  protectedText: { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  protectedSubtext: { color: colors.gray, fontSize: fonts.sizes.sm },
  errorText: { color: colors.error, fontSize: fonts.sizes.md, textAlign: 'center', marginBottom: spacing.lg },
  retryBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  retryBtnText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
  watermark: { position: 'absolute', bottom: spacing.xl, right: spacing.md, opacity: 0.15 },
  watermarkText: { color: colors.white, fontSize: fonts.sizes.xs },
});