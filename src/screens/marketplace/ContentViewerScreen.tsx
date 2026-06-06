// ============================================
// CONTENT VIEWER SCREEN — DRM PROTEGIDO
//
// ⚠️ API_TODO #12:
// Substituir mock por Cloud Function getSignedUrl:
// const functions = getFunctions(app, 'us-central1');
// const getUrl = httpsCallable(functions, 'getSignedUrl');
// const result = await getUrl({ productId, fileIndex });
// const { url } = result.data;
//
// A Cloud Function deve:
// → verificar purchase ativa
// → verificar isBlocked
// → gerar Signed URL temporária (15 min)
// → usar Admin SDK (ignora Storage Rules)
// ============================================

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  Alert, TouchableOpacity, Dimensions, Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ScreenCapture from 'expo-screen-capture';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, spacing } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import app from '../../core/firebase';
import { Platform } from 'react-native';

type RouteProps = RouteProp<RootStackParamList, 'ContentViewer'>;
const { width } = Dimensions.get('window');

// Modais de aviso iOS
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

export default function ContentViewerScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { productId, purchaseId } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [contentHidden, setContentHidden] = useState(false);
  const screenshotCount = useRef(0);

  useEffect(() => {
    // Android — bloqueia print completamente
    if (Platform.OS === 'android') {
      ScreenCapture.preventScreenCaptureAsync();
    }

    // iOS — detecta print
    let subscription: any;
    if (Platform.OS === 'ios') {
      subscription = ScreenCapture.addScreenshotListener(() => {
        handleScreenshot();
      });
    }

    loadContent();

    return () => {
      if (Platform.OS === 'android') {
        ScreenCapture.allowScreenCaptureAsync();
      }
      if (subscription) subscription.remove();
    };
  }, []);

  async function loadContent() {
    setLoading(true);
    try {
      // ⚠️ API_TODO #12: substituir por Cloud Function real
      // Por enquanto exibe placeholder até Signed URL ser implementada
      // const functions = getFunctions(app, 'us-central1');
      // const getUrl = httpsCallable(functions, 'getSignedUrl');
      // const result = await getUrl({ productId, fileIndex: 0 }) as any;
      // setContentUrl(result.data.url);

      // Placeholder MVP
      setContentUrl(null);
    } catch (error: any) {
      Alert.alert('Erro', 'Não foi possível carregar o conteúdo.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  async function handleScreenshot() {
    screenshotCount.current += 1;
    const count = screenshotCount.current;

    // Esconde conteúdo momentaneamente
    setContentHidden(true);
    setTimeout(() => setContentHidden(false), 3000);

    // Reporta para Cloud Function
    if (user?.uid) {
      try {
        const functions = getFunctions(app, 'us-central1');
        const report = httpsCallable(functions, 'reportScreenshot');
        await report({ productId });
      } catch {
        // Falha silenciosa
      }
    }

    // Modal por nível
    const warningIndex = Math.min(count - 1, WARNING_MESSAGES.length - 1);
    const warning = WARNING_MESSAGES[warningIndex];

    Alert.alert(warning.title, warning.message, [
      { text: warning.button, style: 'default' },
    ]);
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Conteúdo</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Carregando conteúdo seguro...</Text>
        </View>
      ) : contentHidden ? (
        <View style={styles.center}>
          <Text style={styles.hiddenIcon}>🔒</Text>
          <Text style={styles.hiddenText}>Conteúdo temporariamente oculto</Text>
        </View>
      ) : contentUrl ? (
        // Viewer real — quando API_TODO #12 estiver implementado
        <Image
          source={{ uri: contentUrl }}
          style={styles.content}
          resizeMode="contain"
        />
      ) : (
        // ⚠️ API_TODO #12 — placeholder até Signed URL estar pronto
        <View style={styles.center}>
          <Text style={styles.todoIcon}>🔐</Text>
          <Text style={styles.todoTitle}>Conteúdo protegido</Text>
          <Text style={styles.todoText}>
            O visualizador de conteúdo estará disponível em breve.{'\n'}
            A integração de download seguro está sendo configurada.
          </Text>
        </View>
      )}

      {/* Watermark com UID */}
      <View style={styles.watermark} pointerEvents="none">
        <Text style={styles.watermarkText}>{user?.uid?.slice(0, 8)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loadingText: { color: colors.gray, marginTop: spacing.md, fontSize: fonts.sizes.md },
  hiddenIcon: { fontSize: 64, marginBottom: spacing.md },
  hiddenText: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
  todoIcon: { fontSize: 64, marginBottom: spacing.md },
  todoTitle: { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold', marginBottom: spacing.md },
  todoText: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center', lineHeight: 22 },
  content: { flex: 1, width },
  watermark: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.md,
    opacity: 0.15,
  },
  watermarkText: { color: colors.white, fontSize: fonts.sizes.xs },
});