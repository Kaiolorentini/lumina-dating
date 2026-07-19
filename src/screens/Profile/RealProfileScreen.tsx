import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card } from '../../components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS , alpha} from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { getProfile } from '../../services/profileService';
import { RootStackParamList } from '../../navigation/types';
import Header from '../../components/Header';
import SintoniaBar from '../../components/SintoniaBar';
import { calcularSintonia } from '../../utils/sintoniaEngine';
import { enviarSolicitacao, estaoConectados, getSolicitacaoEntre } from '../../services/requestsService';
import { estaBloqueado, bloquearUsuario } from '../../services/blockService';
import { UserProfile } from '../../types';
import { registrarVisita } from '../../services/visitsService';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../services/firebase';
import { Badge } from '../../components/ui/Badge';

const { width, height } = Dimensions.get('window');
const functions = getFunctions();

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function RealProfileScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<any>();
  const targetUserId: string = route.params?.userId;

  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [sintonia, setSintonia] = useState(0);
  const [sintoniaBreakdown, setSintoniaBreakdown] = useState({ localizacao: 0, preferencia: 0, perfil: 0, interesses: 0 });
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [sending, setSending] = useState(false);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    if (!user) return;
    try {
      const [target, current] = await Promise.all([getProfile(targetUserId), getProfile(user.uid)]);
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
          const earnXPFn = httpsCallable(functions, 'earnXP');
          earnXPFn({ action: 'VISIT_PROFILE', targetUid: targetUserId, actionId: `visit_${user.uid}_${targetUserId}` }).catch(() => {});
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
      await enviarSolicitacao(user.uid, currentProfile.name, currentProfile.photoURL, targetUserId, targetProfile.name);
      setRequestSent(true);
      Alert.alert('✦ Solicitação enviada!', `Aguarde ${targetProfile.name} aceitar.`);
    } catch {
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
      Alert.alert('⚠️ Bloquear usuário', `Deseja bloquear ${targetProfile.name}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Bloquear', style: 'destructive', onPress: async () => {
          await bloquearUsuario(user.uid, targetUserId, targetProfile.name, targetProfile.photoURL);
          setBlocked(true);
          navigation.goBack();
        }},
      ]);
    }
  }

  async function checkAlreadyLiked(uid: string, targetUid: string): Promise<boolean> {
    const todayStr = new Date().toISOString().slice(0, 10);
    const likeId = `${uid}_${targetUid}_${todayStr}`;
    const likeDoc = await getDoc(doc(db, 'likes', likeId));
    return likeDoc.exists();
  }

  async function handleLike() {
    if (!user || liked || liking) return;
    setLiking(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const likeId = `${user.uid}_${targetUserId}_${todayStr}`;
      await setDoc(doc(db, 'likes', likeId), { likerUid: user.uid, targetUid: targetUserId, date: todayStr, createdAt: serverTimestamp() });
      setLiked(true);
      const processLike = httpsCallable(functions, 'onProfileLike');
      processLike({ likerUid: user.uid, targetUid: targetUserId }).catch(err => console.warn('[RealProfileScreen] onProfileLike falhou:', err));
    } catch {
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
        <ActivityIndicator color={COLORS.gold} size="large" />
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
          <Button label="Voltar" onPress={() => navigation.goBack()} variant="ghost" />
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
          <Button label="🚫" variant="ghost" onPress={handleBlock} />
        }
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.photoContainer}>
          {targetProfile?.photoURL ? (
            <Image source={{ uri: targetProfile.photoURL }} style={styles.mainPhoto} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderIcon}>👤</Text>
            </View>
          )}
          <View style={styles.photoOverlay} />
          <View style={styles.photoInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{targetProfile?.name}, {targetProfile?.age}</Text>
              <Badge label="👤 Real" variant="premium" size="sm" />
            </View>
            <Text style={styles.location}>📍 {targetProfile?.city}, {targetProfile?.state}</Text>
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Ativo recentemente</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <Card variant="default" padding={SPACING.lg}>
            <Text style={styles.milestoneText}>{getSintoniaLabel()}</Text>
            <SintoniaBar score={sintonia} showLabel={true} showBreakdown={true} breakdown={sintoniaBreakdown} />
          </Card>

          {sintonia >= 60 && (
            <Card padding={SPACING.lg} style={styles.connectionCard}>
              <Text style={styles.connectionText}>💫 Vocês têm uma conexão forte!</Text>
            </Card>
          )}

          {targetProfile?.bio ? (
            <Card variant="default" padding={SPACING.lg}>
              <Text style={styles.sectionTitle}>Sobre mim</Text>
              <Text style={styles.bio}>{targetProfile.bio}</Text>
            </Card>
          ) : null}

          <Card variant="default" padding={SPACING.lg}>
            <Text style={styles.sectionTitle}>Informações</Text>
            <View style={styles.infoRow}><Text style={styles.infoIcon}>🎂</Text><Text style={styles.infoText}>{targetProfile?.age} anos</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoIcon}>📍</Text><Text style={styles.infoText}>{targetProfile?.city}, {targetProfile?.state}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoIcon}>💫</Text><Text style={styles.infoText}>{targetProfile?.gender || 'Não informado'}</Text></View>
          </Card>

          {targetProfile?.preferences && targetProfile.preferences.length > 0 && (
            <Card variant="default" padding={SPACING.lg}>
              <Text style={styles.sectionTitle}>Interesse em</Text>
              <View style={styles.tagsRow}>
                {targetProfile.preferences.map((pref, index) => (
                  <View key={index} style={styles.tag}><Text style={styles.tagText}>{pref}</Text></View>
                ))}
              </View>
            </Card>
          )}

          <View style={styles.actions}>
            {connected ? (
              <Button
                label="💬 Conversar"
                onPress={() => navigation.navigate('UserChat', { userId: targetUserId, userName: targetProfile?.name || '', userPhoto: targetProfile?.photoURL || '' })}
                variant="primary"
                size="md"
                fullWidth
              />
            ) : requestSent ? (
              <View style={styles.pendingButton}>
                <Text style={styles.pendingButtonText}>⏳ Solicitação enviada</Text>
              </View>
            ) : (
              <Button
                label="✦ Conectar"
                onPress={handleSendRequest}
                variant="primary"
                size="md"
                loading={sending}
                fullWidth
              />
            )}

            <Button
              variant="ghost"
              onPress={handleLike}
              disabled={liked || liking}
              loading={liking}
              label={liked ? '❤️' : '🤍'}
              style={{
                width: 56, height: 56,
                borderRadius: BORDER_RADIUS.lg,
                backgroundColor: liked ? COLORS.error : COLORS.card,
                borderWidth: 1,
                borderColor: liked ? COLORS.error : COLORS.border,
                alignItems: 'center', justifyContent: 'center',
              }}
              textStyle={{ fontSize: 24 }}
            />
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  blockedContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  blockedIcon: { fontSize: 60 },
  blockedText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.subtitle },
  blockIcon: { fontSize: FONT_SIZE.title },
  photoContainer: { width, height: height * 0.45, position: 'relative' },
  mainPhoto: { width: '100%', height: '100%' },
  photoPlaceholder: { width: '100%', height: '100%', backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderIcon: { fontSize: 80 },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', backgroundColor: COLORS.overlay },
  photoInfo: { position: 'absolute', bottom: SPACING.lg, left: SPACING.lg, gap: SPACING.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  name: { color: COLORS.textPrimary, fontSize: FONT_SIZE.hero, fontWeight: FONT_WEIGHT.bold },
  location: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  onlineText: { color: COLORS.success, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  content: { padding: SPACING.lg, gap: SPACING.md },
  milestoneText: { color: COLORS.gold, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, textAlign: 'center', marginBottom: SPACING.md, letterSpacing: 1 },
  connectionCard: { backgroundColor: alpha(COLORS.gold, 0.13), borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: alpha(COLORS.gold, 0.27), alignItems: 'center' },
  connectionText: { color: COLORS.gold, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  sectionTitle: { color: COLORS.gold, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1, marginBottom: SPACING.sm },
  bio: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body, lineHeight: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.xs },
  infoIcon: { fontSize: FONT_SIZE.xl, width: 24, textAlign: 'center' },
  infoText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  tag: { backgroundColor: COLORS.border, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  tagText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  actions: { flexDirection: 'row', gap: SPACING.md },
  pendingButton: { flex: 1, backgroundColor: COLORS.border, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.textSecondary },
  pendingButtonText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body }
});