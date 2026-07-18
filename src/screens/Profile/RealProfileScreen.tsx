// ============================================
// LUMINA — REAL PROFILE SCREEN v5.2
// src/screens/RealProfile/RealProfileScreen.tsx
//
// v5.2: botão ❤️ integrado ao ProfileLikeOrchestrator
// Alterações: imports Firestore/Functions, estados liked/liking,
// checkAlreadyLiked(), handleLike(), likeButton atualizado,
// likeButtonActive no StyleSheet.
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getProfile } from '../../services/profileService';
import { RootStackParamList } from '../../navigation/types';
import Header from '../../components/Header';
import SintoniaBar from '../../components/SintoniaBar';
import { calcularSintonia } from '../../utils/sintoniaEngine';
import {
  enviarSolicitacao,
  estaoConectados,
  getSolicitacaoEntre,
} from '../../services/requestsService';
import { estaBloqueado, bloquearUsuario } from '../../services/blockService';
import { UserProfile } from '../../types';
import { registrarVisita } from '../../services/visitsService';
// v5.2 — adicionado
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable }           from 'firebase/functions';
import { db }                                    from '../../services/firebase';

const { width, height } = Dimensions.get('window');
const functions         = getFunctions(); // v5.2

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function RealProfileScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<any>();
  const targetUserId: string = route.params?.userId;

  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [sintonia, setSintonia] = useState(0);
  const [sintoniaBreakdown, setSintoniaBreakdown] = useState({
    localizacao: 0,
    preferencia: 0,
    perfil: 0,
    interesses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [sending, setSending] = useState(false);
  // v5.2 — adicionado
  const [liked,  setLiked]  = useState(false);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!user) return;
    try {
      const [target, current] = await Promise.all([
        getProfile(targetUserId),
        getProfile(user.uid),
      ]);

      if (target && current) {
        setTargetProfile(target);
        setCurrentProfile(current);

        const result = calcularSintonia(current, target);
        setSintonia(result.score);
        setSintoniaBreakdown(result.breakdown);

        const [isConnected, request, isBlocked] = await Promise.all([
          estaoConectados(user.uid, targetUserId),
          getSolicitacaoEntre(user.uid, targetUserId),
          estaBloqueado(user.uid, targetUserId),
        ]);

        setConnected(isConnected);
        setRequestSent(!!request);
        setBlocked(isBlocked);

        // v5.2 — verifica se já curtiu hoje
        const alreadyLiked = await checkAlreadyLiked(user.uid, targetUserId);
        setLiked(alreadyLiked);

        // Registra visita — só se ambos os IDs forem válidos
        if (user?.uid && targetUserId) {
          await registrarVisita(user.uid, targetUserId);

          // Gamificação — XP por visita (fire-and-forget)
          const earnXPFn = httpsCallable(functions, 'earnXP');
          earnXPFn({ action: 'VISIT_PROFILE', targetUid: targetUserId, actionId: `visit_${user.uid}_${targetUserId}` })
            .catch(() => { /* silencioso */ });
        }
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendRequest() {
    if (!user || !currentProfile || !targetProfile) return;
    setSending(true);
    try {
      await enviarSolicitacao(
        user.uid,
        currentProfile.name,
        currentProfile.photoURL,
        targetUserId,
        targetProfile.name
      );
      setRequestSent(true);
      Alert.alert('✦ Solicitação enviada!', `Aguarde ${targetProfile.name} aceitar.`);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível enviar a solicitação.');
    } finally {
      setSending(false);
    }
  }

  async function handleBlock() {
    if (!user || !targetProfile) return;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Deseja bloquear ${targetProfile.name}?`);
      if (confirmed) {
        await bloquearUsuario(
          user.uid,
          targetUserId,
          targetProfile.name,
          targetProfile.photoURL
        );
        setBlocked(true);
        navigation.goBack();
      }
    } else {
      Alert.alert(
        '⚠️ Bloquear usuário',
        `Deseja bloquear ${targetProfile.name}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Bloquear',
            style: 'destructive',
            onPress: async () => {
              await bloquearUsuario(
                user.uid,
                targetUserId,
                targetProfile.name,
                targetProfile.photoURL
              );
              setBlocked(true);
              navigation.goBack();
            },
          },
        ]
      );
    }
  }

  // v5.2 — verifica curtida do dia
  async function checkAlreadyLiked(uid: string, targetUid: string): Promise<boolean> {
    const todayStr = new Date().toISOString().slice(0, 10);
    const likeId   = `${uid}_${targetUid}_${todayStr}`;
    const likeDoc  = await getDoc(doc(db, 'likes', likeId));
    return likeDoc.exists();
  }

  // v5.2 — curtir perfil
  async function handleLike() {
    if (!user || liked || liking) return;
    setLiking(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const likeId   = `${user.uid}_${targetUserId}_${todayStr}`;

      // Salva curtida no Firestore
      await setDoc(doc(db, 'likes', likeId), {
        likerUid:  user.uid,
        targetUid: targetUserId,
        date:      todayStr,
        createdAt: serverTimestamp(),
      });

      setLiked(true);

      // Dispara gamificação — fire-and-forget
      const processLike = httpsCallable(functions, 'onProfileLike');
      processLike({ likerUid: user.uid, targetUid: targetUserId }).catch(err => {
        console.warn('[RealProfileScreen] onProfileLike falhou:', err);
      });

    } catch (error) {
      Alert.alert('Erro', 'Não foi possível registrar a curtida.');
      setLiked(false);
    } finally {
      setLiking(false);
    }
  }

  function getSintoniaLabel(): string {
    if (sintonia >= 95) return '✦ Sintonia Perfeita';
    if (sintonia >= 85) return '🔥 Alta Sintonia';
    if (sintonia >= 70) return '⚡ Boa Sintonia';
    if (sintonia >= 50) return '💫 Sintonia Moderada';
    return '🌱 Sintonia Inicial';
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (blocked) {
    return (
      <View style={styles.container}>
        <Header title="Perfil" showBack={true} showHome={true} />
        <View style={styles.blockedContent}>
          <Text style={styles.blockedIcon}>🚫</Text>
          <Text style={styles.blockedText}>Usuário bloqueado</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title={targetProfile?.name || 'Perfil'}
        showBack={true}
        showHome={true}
        rightElement={
          <TouchableOpacity onPress={handleBlock}>
            <Text style={styles.blockIcon}>🚫</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Foto principal — estilo AIProfile */}
        <View style={styles.photoContainer}>
          {targetProfile?.photoURL ? (
            <Image
              source={{ uri: targetProfile.photoURL }}
              style={styles.mainPhoto}
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderIcon}>👤</Text>
            </View>
          )}
          <View style={styles.photoOverlay} />
          <View style={styles.photoInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>
                {targetProfile?.name}, {targetProfile?.age}
              </Text>
              <View style={styles.realBadge}>
                <Text style={styles.realBadgeText}>👤 Real</Text>
              </View>
            </View>
            <Text style={styles.location}>
              📍 {targetProfile?.city}, {targetProfile?.state}
            </Text>
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Ativo recentemente</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {/* Sintonia */}
          <View style={styles.card}>
            <Text style={styles.milestoneText}>{getSintoniaLabel()}</Text>
            <SintoniaBar
              score={sintonia}
              showLabel={true}
              showBreakdown={true}
              breakdown={sintoniaBreakdown}
            />
          </View>

          {sintonia >= 60 && (
            <View style={styles.connectionCard}>
              <Text style={styles.connectionText}>
                💫 Vocês têm uma conexão forte!
              </Text>
            </View>
          )}

          {/* Bio */}
          {targetProfile?.bio ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Sobre mim</Text>
              <Text style={styles.bio}>{targetProfile.bio}</Text>
            </View>
          ) : null}

          {/* Informações */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Informações</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>🎂</Text>
              <Text style={styles.infoText}>{targetProfile?.age} anos</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📍</Text>
              <Text style={styles.infoText}>
                {targetProfile?.city}, {targetProfile?.state}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>💫</Text>
              <Text style={styles.infoText}>
                {targetProfile?.gender || 'Não informado'}
              </Text>
            </View>
          </View>

          {/* Preferências */}
          {targetProfile?.preferences && targetProfile.preferences.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Interesse em</Text>
              <View style={styles.tagsRow}>
                {targetProfile.preferences.map((pref, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{pref}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Botões de ação */}
          <View style={styles.actions}>
            {connected ? (
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() => navigation.navigate('UserChat', {
                  userId: targetUserId,
                  userName: targetProfile?.name || '',
                  userPhoto: targetProfile?.photoURL || '',
                })}
              >
                <Text style={styles.chatButtonText}>💬 Conversar</Text>
              </TouchableOpacity>
            ) : requestSent ? (
              <View style={styles.pendingButton}>
                <Text style={styles.pendingButtonText}>⏳ Solicitação enviada</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.connectButton}
                onPress={handleSendRequest}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.connectButtonText}>✦ Conectar</Text>
                )}
              </TouchableOpacity>
            )}

            {/* v5.2 — botão de curtida integrado ao ProfileLikeOrchestrator */}
            <TouchableOpacity
              style={[styles.likeButton, liked && styles.likeButtonActive]}
              onPress={handleLike}
              disabled={liked || liking}
              activeOpacity={0.8}
            >
              {liking
                ? <ActivityIndicator color={liked ? '#fff' : colors.gray} size="small" />
                : <Text style={styles.likeButtonText}>{liked ? '❤️' : '🤍'}</Text>
              }
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  blockedIcon: { fontSize: 60 },
  blockedText: { color: colors.gray, fontSize: fonts.sizes.lg },
  backButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  backButtonText: { color: colors.white, fontWeight: 'bold' },
  blockIcon: { fontSize: 20 },

  // Foto principal — igual AIProfile
  photoContainer: {
    width,
    height: height * 0.45,
    position: 'relative',
  },
  mainPhoto: { width: '100%', height: '100%' },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderIcon: { fontSize: 80 },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: '#0D0D0D99',
  },
  photoInfo: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    gap: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    color: colors.white,
    fontSize: fonts.sizes.xxl,
    fontWeight: 'bold',
  },
  realBadge: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  realBadgeText: {
    color: colors.background,
    fontSize: fonts.sizes.xs,
    fontWeight: 'bold',
  },
  location: { color: colors.grayLight, fontSize: fonts.sizes.md },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#44FF88',
  },
  onlineText: {
    color: '#44FF88',
    fontSize: fonts.sizes.sm,
    fontWeight: 'bold',
  },

  // Conteúdo
  content: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  milestoneText: {
    color: colors.gold,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: 1,
  },
  connectionCard: {
    backgroundColor: colors.gold + '22',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold + '44',
    alignItems: 'center',
  },
  connectionText: {
    color: colors.gold,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sectionTitle: {
    color: colors.gold,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  bio: {
    color: colors.grayLight,
    fontSize: fonts.sizes.md,
    lineHeight: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  infoIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  infoText: { color: colors.grayLight, fontSize: fonts.sizes.md },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    backgroundColor: colors.grayDark,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  tagText: { color: colors.grayLight, fontSize: fonts.sizes.sm },

  // Botões
  actions: { flexDirection: 'row', gap: spacing.md },
  chatButton: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
  },
  chatButtonText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: fonts.sizes.lg,
  },
  connectButton: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
  },
  connectButtonText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: fonts.sizes.lg,
  },
  pendingButton: {
    flex: 1,
    backgroundColor: colors.grayDark,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray,
  },
  pendingButtonText: { color: colors.gray, fontSize: fonts.sizes.md },
  likeButton: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.grayDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // v5.2 — adicionado
  likeButtonActive: {
    backgroundColor: '#E91E63',
    borderColor: '#E91E63',
  },
  likeButtonText: { fontSize: 24 },
});