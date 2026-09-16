// ============================================
// LUMINA — REAL PROFILE SCREEN v5.3
// src/screens/Profile/RealProfileScreen.tsx
//
// v5.3: progressMission chamado em visita e curtida
// para registrar progresso das missões diárias.
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
import { todayBr, todayBrUnderscore } from '../../utils/dateBr';
import { ProfileFrame } from '../../components/profile/ProfileFrame';
import { Badge } from '../../components/profile/Badge';
import {
  frameAppearanceById, badgeAppearanceById, badgeMeaningById, Rarity,
} from '../../config/cosmeticsCatalog';
import {
  enviarSolicitacao,
  estaoConectados,
  getSolicitacaoEntre,
} from '../../services/requestsService';
import { estaBloqueado, bloquearUsuario } from '../../services/blockService';
import { UserProfile } from '../../types';
import { registrarVisita } from '../../services/visitsService';
import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable }           from 'firebase/functions';
import { db }                                    from '../../services/firebase';

const { width, height } = Dimensions.get('window');
const functions         = getFunctions();

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Genéricos extraídos para evitar `httpsCallable<` em fim de linha,
// que é corrompido de forma recorrente no processo de cópia.
type CreateMatchReq = { targetUid: string };
type CreateMatchRes = { success: boolean; isMutual: boolean; alreadyLiked: boolean };

// v5.3 — helper: registra progresso de missão (fire-and-forget)
function notifyMission(missionType: string, targetUid?: string) {
  const missionId = `daily_${todayBrUnderscore()}_${missionType}`;
  const fn        = httpsCallable(functions, 'progressMission');
  fn({ missionIdParam: missionId, targetUid }).catch(() => { /* silencioso */ });
}

export default function RealProfileScreen() {
  const { user }     = useAuth();
  const navigation   = useNavigation<NavProp>();
  const route        = useRoute<any>();
  const targetUserId: string = route.params?.userId;

  const [targetProfile,  setTargetProfile]  = useState<UserProfile | null>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [sintonia,       setSintonia]       = useState(0);
  const [sintoniaBreakdown, setSintoniaBreakdown] = useState({
    localizacao: 0, preferencia: 0, perfil: 0, interesses: 0,
  });
  const [loading,      setLoading]      = useState(true);
  const [connected,    setConnected]    = useState(false);
  const [requestSent,  setRequestSent]  = useState(false);
  const [blocked,      setBlocked]      = useState(false);
  const [sending,      setSending]      = useState(false);
  const [liked,        setLiked]        = useState(false);
  const [liking,       setLiking]       = useState(false);

  useEffect(() => { loadData(); }, []);

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

        const alreadyLiked = await checkAlreadyLiked(user.uid, targetUserId);
        setLiked(alreadyLiked);

        if (user?.uid && targetUserId) {
          await registrarVisita(user.uid, targetUserId);

          // XP, conquista e cofre NÃO são emitidos aqui.
          //
          // registrarVisita grava em profile_visits, e o trigger
          // onProfileVisit (emotionalTriggers.ts) roda o
          // ProfileVisitOrchestrator, que chama handleProfileVisit
          // → XPService (VISIT_PROFILE), VaultService, ranking e
          // conquistas — tudo atrás do ProfileVisitValidator.
          // Emitir do cliente duplicava os três: o actionId do
          // cliente e o do servidor são chaves diferentes, então a
          // idempotência do earnXP não pegava.

          // Missão diária continua no cliente: não há equivalente
          // no caminho do PROFILE_VISIT.
          notifyMission('visit_profiles', targetUserId);
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
        await bloquearUsuario(user.uid, targetUserId, targetProfile.name, targetProfile.photoURL);
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
              await bloquearUsuario(user.uid, targetUserId, targetProfile.name, targetProfile.photoURL);
              setBlocked(true);
              navigation.goBack();
            },
          },
        ]
      );
    }
  }

  async function checkAlreadyLiked(uid: string, targetUid: string): Promise<boolean> {
    const likeId   = `${uid}_${targetUid}_${todayBr()}`;
    const likeDoc  = await getDoc(doc(db, 'likes', likeId));
    return likeDoc.exists();
  }

  async function handleLike() {
    if (!user || liked || liking) return;
    setLiking(true);
    // Otimista: o coração responde na hora, a CF confirma depois.
    setLiked(true);

    try {
      // onCreateMatch grava a curtida E roda o MatchService, que
      // detecta sintonia mútua e emite CREATE_SINTONIA (50 XP +
      // 50 treeXP + conquista). Gravar direto em 'likes' pelo
      // cliente fazia o MatchService NUNCA rodar — a coleção
      // Conector era inalcançável e a árvore jamais evoluía.
      const createMatch = httpsCallable<CreateMatchReq, CreateMatchRes>(functions, 'onCreateMatch');
      const result = await createMatch({ targetUid: targetUserId });

      if (result.data.isMutual) {
        Alert.alert('✦ Sintonia!', 'Vocês se curtiram. Que tal iniciar uma conversa?');
      }

      // Toda a gamificação derivada da curtida fica sob o mesmo
      // guard. Antes, só o earnXP checava `alreadyLiked`: missão,
      // cofre e onProfileLike rodavam de novo a cada reentrada na
      // tela, furando o limite diário de fragmentos e inflando a
      // missão like_profiles. A CF é a única fonte de verdade
      // sobre "esta curtida é nova".
      if (!result.data.alreadyLiked) {
        // Gamificação XP/Engine — fire-and-forget
        httpsCallable(functions, 'onProfileLike')({
          likerUid:  user.uid,
          targetUid: targetUserId,
        }).catch(err => {
          console.warn('[RealProfileScreen] onProfileLike falhou:', err);
        });

        // v5.3 — missão like_profiles (fire-and-forget)
        notifyMission('like_profiles', targetUserId);

        // XP GIVE_LIKE e depósito no cofre NÃO são emitidos aqui.
        // O onProfileLike acima já dispara ambos pela via correta:
        // XPService mapeia PROFILE_LIKE → GIVE_LIKE e VaultService
        // deposita 5, ambos atrás do ProfileLikeValidator e do
        // AntiFarmService. Emitir do cliente duplicava os dois — a
        // idempotência do earnXP não pegava, porque o actionId do
        // cliente e o do servidor são chaves diferentes.
      }

    } catch (error) {
      Alert.alert('Erro', 'Não foi possível registrar a curtida.');
      setLiked(false);
    } finally {
      setLiking(false);
    }
  }

  // Cosméticos equipados do perfil visitado. O aluguel vencido é
  // descartado aqui: `equippedFrameUntil` existe no documento
  // justamente porque a limpeza do getFramesStatus só roda quando
  // o próprio dono abre o app.
  function activeCosmetic(id: unknown, until: unknown): string | null {
    if (typeof id !== 'string' || !id) return null;
    if (until === null || until === undefined) return id;  // permanente
    const date = (until as { toDate?: () => Date })?.toDate?.() ?? null;
    if (!date) return id;
    return date.getTime() > Date.now() ? id : null;
  }

  const prog = (targetProfile as { progression?: Record<string, unknown> } | null)?.progression ?? {};
  const targetFrame = frameAppearanceById(
    activeCosmetic(prog.equippedFrame, prog.equippedFrameUntil)
  );
  const targetBadgeId = activeCosmetic(prog.equippedBadge, prog.equippedBadgeUntil);
  const targetBadge = targetBadgeId
    ? badgeAppearanceById(targetBadgeId, (prog.equippedBadgeRarity as Rarity) ?? 'COMMON')
    : null;
  const targetMeaning = badgeMeaningById(targetBadgeId);

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
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
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
        {/* Foto principal.
            Com moldura, a cena vira o FUNDO da área inteira e a
            foto fica por cima, centralizada a 80% da largura —
            a cena aparece nas margens e atrás do gradiente. É
            aqui que a moldura precisa se justificar: o perfil
            aberto é onde alguém decide mandar mensagem. */}
        <View style={styles.photoContainer}>
          {targetFrame && (
            <View style={StyleSheet.absoluteFill}>
              <ProfileFrame
                photoURL=""
                size={width}
                ratio={0.45 * height / width}
                frame={targetFrame}
                showPhoto={false}
              />
            </View>
          )}

          {targetProfile?.photoURL ? (
            <Image
              source={{ uri: targetProfile.photoURL }}
              style={targetFrame ? styles.mainPhotoFramed : styles.mainPhoto}
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderIcon}>👤</Text>
            </View>
          )}
          <View style={styles.photoOverlay} />
          <View style={styles.photoInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{targetProfile?.name}, {targetProfile?.age}</Text>
              <View style={styles.realBadge}>
                <Text style={styles.realBadgeText}>👤 Real</Text>
              </View>
            </View>
            <Text style={styles.location}>📍 {targetProfile?.city}, {targetProfile?.state}</Text>
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Ativo recentemente</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {/* O que a pessoa está dizendo sobre si. Vem antes da
              Sintonia de propósito: é o que ela escolheu declarar,
              e pesa mais numa decisão de mandar mensagem do que
              um número calculado. */}
          {targetMeaning && targetBadge && (
            <View style={styles.meaningCard}>
              <Badge appearance={targetBadge} size={44} />
              <Text style={styles.meaningText}>{targetMeaning}</Text>
            </View>
          )}

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
              <Text style={styles.connectionText}>💫 Vocês têm uma conexão forte!</Text>
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
              <Text style={styles.infoText}>{targetProfile?.city}, {targetProfile?.state}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>💫</Text>
              <Text style={styles.infoText}>{targetProfile?.gender || 'Não informado'}</Text>
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
                  userId:    targetUserId,
                  userName:  targetProfile?.name   || '',
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
                {sending
                  ? <ActivityIndicator color={colors.background} />
                  : <Text style={styles.connectButtonText}>✦ Conectar</Text>
                }
              </TouchableOpacity>
            )}

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
  container:            { flex: 1, backgroundColor: colors.background },
  loadingContainer:     { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  blockedContent:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  blockedIcon:          { fontSize: 60 },
  blockedText:          { color: colors.gray, fontSize: fonts.sizes.lg },
  backButton:           { backgroundColor: colors.surface, borderRadius: borderRadius.sm, padding: spacing.md, paddingHorizontal: spacing.xl, borderWidth: 1, borderColor: colors.grayDark },
  backButtonText:       { color: colors.white, fontWeight: 'bold' },
  blockIcon:            { fontSize: 20 },
  photoContainer:       { width, height: height * 0.45, position: 'relative', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  mainPhoto:            { width: '100%', height: '100%' },
  // Com moldura: 80% da largura, para a cena respirar nas laterais.
  mainPhotoFramed:      { width: width * 0.8, height: '100%' },
  photoPlaceholder:     { width: '100%', height: '100%', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderIcon: { fontSize: 80 },
  photoOverlay:         { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', backgroundColor: '#0D0D0D99' },
  photoInfo:            { position: 'absolute', bottom: spacing.lg, left: spacing.lg, gap: spacing.xs },
  nameRow:              { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name:                 { color: colors.white, fontSize: fonts.sizes.xxl, fontWeight: 'bold' },
  realBadge:            { backgroundColor: colors.gold, borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  realBadgeText:        { color: colors.background, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  location:             { color: colors.grayLight, fontSize: fonts.sizes.md },
  onlineBadge:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineDot:            { width: 8, height: 8, borderRadius: 4, backgroundColor: '#44FF88' },
  onlineText:           { color: '#44FF88', fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  content:              { padding: spacing.lg, gap: spacing.md },
  card:                 { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.grayDark },
  meaningCard:          { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.gold + '11', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.gold + '33' },
  meaningText:          { flex: 1, color: colors.gold, fontSize: fonts.sizes.md, fontStyle: 'italic', lineHeight: 20 },
  milestoneText:        { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold', textAlign: 'center', marginBottom: spacing.md, letterSpacing: 1 },
  connectionCard:       { backgroundColor: colors.gold + '22', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.gold + '44', alignItems: 'center' },
  connectionText:       { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold', textAlign: 'center' },
  sectionTitle:         { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold', letterSpacing: 1, marginBottom: spacing.sm },
  bio:                  { color: colors.grayLight, fontSize: fonts.sizes.md, lineHeight: 24 },
  infoRow:              { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  infoIcon:             { fontSize: 18, width: 24, textAlign: 'center' },
  infoText:             { color: colors.grayLight, fontSize: fonts.sizes.md },
  tagsRow:              { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag:                  { backgroundColor: colors.grayDark, borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  tagText:              { color: colors.grayLight, fontSize: fonts.sizes.sm },
  actions:              { flexDirection: 'row', gap: spacing.md },
  chatButton:           { flex: 1, backgroundColor: colors.gold, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center' },
  chatButtonText:       { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.lg },
  connectButton:        { flex: 1, backgroundColor: colors.gold, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center' },
  connectButtonText:    { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.lg },
  pendingButton:        { flex: 1, backgroundColor: colors.grayDark, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.gray },
  pendingButtonText:    { color: colors.gray, fontSize: fonts.sizes.md },
  likeButton:           { width: 56, height: 56, borderRadius: borderRadius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.grayDark, alignItems: 'center', justifyContent: 'center' },
  likeButtonActive:     { backgroundColor: '#E91E63', borderColor: '#E91E63' },
  likeButtonText:       { fontSize: 24 },
});