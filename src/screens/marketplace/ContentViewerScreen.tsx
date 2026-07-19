import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  Alert, Dimensions, Image, TouchableOpacity,
  FlatList, Platform, AppState, AppStateStatus,
} from 'react-native';
import { Button } from '../../components/ui';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ScreenCapture from 'expo-screen-capture';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS , alpha} from '../../theme/tokens';
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
  const lastReportRef = useRef<number>(0);
  const backgroundedAtRef = useRef<number | null>(null);

  const handleScreenshot = useCallback(async () => {
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
      }
    }

    const warningIndex = Math.min(count - 1, WARNING_MESSAGES.length - 1);
    const warning = WARNING_MESSAGES[warningIndex];
    Alert.alert(warning.title, warning.message, [
      { text: warning.button, style: 'default' },
    ]);
  }, [productId, user?.uid]);

  useEffect(() => {
    const subscription = ScreenCapture.addScreenshotListener(() => {
      handleScreenshot();
    });

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

  useEffect(() => {
    if (files.length > 0 && files[selectedIndex]) {
      loadSignedUrl(files[selectedIndex].storagePath);
    }
  }, [selectedIndex, files]);

  async function loadSignedUrl(storagePath: string) {
    setUrlLoading(true);
    setSignedUrl(null);
    setImageError(false);

    if (urlExpiryTimer.current) clearTimeout(urlExpiryTimer.current);

    try {
      const functions = getFunctions(app, 'us-central1');
      const getUrl = httpsCallable(functions, 'getSignedUrl');
      const result = await getUrl({ productId, storagePath }) as any;
      const url: string = result.data.url;
      setSignedUrl(url);

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

  function renderContent() {
    if (urlLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.gold} size="large" />
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

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Conteúdo</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.gold} size="large" />
          <Text style={styles.loadingText}>Verificando acesso...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {product?.title ?? 'Conteúdo'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

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

      <View style={styles.contentArea}>
        {renderContent()}
      </View>

      <View style={styles.watermark} pointerEvents="none">
        <Text style={styles.watermarkText}>{user?.uid?.slice(0, 8)}</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    borderBottomWidth: 0.5, borderBottomColor: alpha(COLORS.gold, 0.27),
  },
  // backBtn removed — now uses Button
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, flex: 1, textAlign: 'center' },
  fileSelector: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    maxHeight: 60,
  },
  fileSelectorContent: { paddingHorizontal: SPACING.md, gap: SPACING.sm, alignItems: 'center' },
  fileTab: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.border,
    maxWidth: 160,
  },
  fileTabActive: { borderColor: COLORS.gold, backgroundColor: alpha(COLORS.gold, 0.07) },
  fileTabIcon: { fontSize: FONT_SIZE.subtitle },
  fileTabText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  fileTabTextActive: { color: COLORS.gold, fontWeight: FONT_WEIGHT.bold },
  contentArea: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  loadingText: { color: COLORS.textSecondary, marginTop: SPACING.md, fontSize: FONT_SIZE.body },
  bigIcon: { fontSize: 64, marginBottom: SPACING.md },
  hiddenText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body, textAlign: 'center' },
  imageContent: { flex: 1, width },
  fileTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, textAlign: 'center', marginBottom: SPACING.xs },
  fileMeta: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, marginBottom: SPACING.lg },
  protectedBox: {
    backgroundColor: alpha(COLORS.gold, 0.07), borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: alpha(COLORS.gold, 0.2),
    padding: SPACING.md, alignItems: 'center', gap: SPACING.xs,
  },
  protectedText: { color: COLORS.gold, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  protectedSubtext: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  errorText: { color: COLORS.error, fontSize: FONT_SIZE.body, textAlign: 'center', marginBottom: SPACING.lg },
  retryBtn: {
    backgroundColor: COLORS.gold, borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
  },
  retryBtnText: { color: COLORS.background, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.body },
  watermark: { position: 'absolute', bottom: SPACING.xl, right: SPACING.md, opacity: 0.15 },
  watermarkText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xs },
});
