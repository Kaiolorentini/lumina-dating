// ============================================
// LUMINA — REAL PROFILE SCREEN v5.7
// src/screens/Profile/RealProfileScreen.tsx
//
// v5.7 (14/10/2026, web T1) — COMPUTADOR.
// A foto media a JANELA (Dimensions) e, no computador, ficava com
// 1.900 px de largura dentro da coluna — cortada e estourada. Agora,
// no computador, a tela tem duas colunas: à esquerda a foto em 4:5
// (380 px, moldura de fundo), nome, botões e galeria; à direita
// Sintonia, interesses, bio, conteúdos à venda, informações, títulos
// e conquistas. O JSX de cada parte virou um bloco nomeado usado
// pelos dois layouts — o celular monta exatamente a mesma ordem de
// antes. Nenhuma regra (visita, curtida, conexão, bloqueio) mudou.
//
// v5.6 (13/10/2026, web lote 4) — BLOQUEAR.
// Uma confirmação só, igual no Android e na web (o desvio
// window.confirm saiu: o navegador ganhou o Alert no lote 1).
// Falha ao bloquear agora avisa a pessoa e a tela fica onde está;
// antes o erro escapava sem aviso e o toque parecia não fazer nada.
//
// v5.5 — CONTEÚDOS DO CRIADOR NO PERFIL.
// Logo depois da galeria, a faixa com os produtos à venda de quem
// tem o perfil aberto (CreatorProductsRow). Só busca quando a
// pessoa pode vender (criador/admin) e o marketplace está aberto;
// perfil comum não gasta nenhuma leitura. Aparece também no modo
// "Seu perfil", para o criador ver como os outros veem.
//
// v5.4 — MODO "COMO OS OUTROS VEEM".
// O card do Meu Perfil abre esta tela com o uid do próprio
// usuário. Nesse modo (isSelf) a tela só MOSTRA: nada de visita
// registrada, curtida, conexão, bloqueio, denúncia ou Sintonia
// consigo mesmo. A visita a si mesmo já é recusada no servidor
// (registerProfileVisit → self_visit); aqui ela nem é chamada,
// para não gastar a chamada à toa.
//
// v5.3: progressMission chamado em visita e curtida
// para registrar progresso das missões diárias.
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getProfile } from '../../services/profileService';
// Perfil de OUTRA pessoa: sempre o público (12/10/2026).
import { getPublicProfile } from '../../services/publicProfileService';
import { invalidateBlockedUids } from '../../services/blockedUsersService';
import { EMPTY_SINTONIA_BREAKDOWN, SintoniaBreakdown } from '../../modules/ai/services/sintoniaCalculator';
import { interestLabel } from '../../config/sintonia/interestsCatalog';
import { RootStackParamList } from '../../navigation/types';
import Header from '../../components/Header';
import SintoniaBar from '../../components/SintoniaBar';
import { calcularSintonia } from '../../utils/sintoniaEngine';
import { todayBr } from '../../utils/dateBr';
import { ProfileFrame } from '../../components/profile/ProfileFrame';
import { Badge } from '../../components/profile/Badge';
import {
  frameAppearanceById, badgeAppearanceById, badgeMeaningById, Rarity,
} from '../../config/cosmeticsCatalog';
import { TitleSeal } from '../../components/profile/TitleSeal';
import { titleById } from '../../config/titlesCatalog';
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
import { galleryPhotos } from '../../modules/profile/services/photoService';
import GalleryViewer from '../../modules/profile/components/GalleryViewer';
import CreatorProductsRow from '../../components/marketplace/CreatorProductsRow';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useBreakpoint } from '../../hooks/useBreakpoint';

/** Foto principal no computador (4:5). */
const DESKTOP_PHOTO_W = 380;
const DESKTOP_PHOTO_RATIO = 1.25;

const { width, height } = Dimensions.get('window');
const functions         = getFunctions();

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Genéricos extraídos para evitar `httpsCallable<` em fim de linha,
// que é corrompido de forma recorrente no processo de cópia.
type CreateMatchReq = { targetUid: string };
type CreateMatchRes = { success: boolean; isMutual: boolean; alreadyLiked: boolean };

interface PublicAchievement {
  id:          string;
  title:       string;
  description: string;
  icon:        string;
  category:    string;
  rarity:      string;
  unlockedAt:  string | null;
}

type AchievementsReq = { userId: string };
type AchievementsRes = {
  achievements:   PublicAchievement[];
  totalUnlocked:  number;
  totalAvailable: number;
};



export default function RealProfileScreen() {
  const { user }     = useAuth();
  const navigation   = useNavigation<NavProp>();
  const route        = useRoute<any>();
  const targetUserId: string = route.params?.userId;
  /** O próprio usuário vendo o perfil como os outros veem. */
  const isSelf = Boolean(user?.uid) && targetUserId === user?.uid;
  const { isDesktop } = useBreakpoint();

  const [targetProfile,  setTargetProfile]  = useState<UserProfile | null>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [sintonia,       setSintonia]       = useState(0);
  const [sintoniaBreakdown, setSintoniaBreakdown] = useState<SintoniaBreakdown>(EMPTY_SINTONIA_BREAKDOWN);
  const [loading,      setLoading]      = useState(true);
  const [connected,    setConnected]    = useState(false);
  const [requestSent,  setRequestSent]  = useState(false);
  const [blocked,      setBlocked]      = useState(false);
  const [sending,      setSending]      = useState(false);
  const [liked,        setLiked]        = useState(false);
  const [liking,       setLiking]       = useState(false);
  const [achievements, setAchievements] = useState<PublicAchievement[]>([]);
  const [totalAch,     setTotalAch]     = useState(0);
  const [viewerIndex,  setViewerIndex]  = useState<number | null>(null);
  const { marketplaceEnabled } = useAppSettings();

  const openProduct = useCallback((productId: string) => {
    navigation.navigate('ProductDetail', { productId });
  }, [navigation]);

  // Perfil de outra pessoa: carrega uma vez (registra a visita).
  // O próprio perfil recarrega ao voltar para a tela — por exemplo,
  // depois de editar os interesses (12/10/2026).
  useEffect(() => { if (!isSelf) loadData(); }, []);
  useEffect(() => {
    if (!isSelf) return;
    return navigation.addListener('focus', () => { loadData(); });
  }, [navigation, isSelf]);

  async function loadData() {
    if (!user) return;

    // Prévia do próprio perfil: uma leitura só e as conquistas.
    // Conexão, bloqueio, curtida e visita não se aplicam.
    if (isSelf) {
      try {
        const me = await getProfile(user.uid);
        if (me) {
          setTargetProfile(me);
          setCurrentProfile(me);
        }
        const achFn = httpsCallable<AchievementsReq, AchievementsRes>(
          functions,
          'getPublicAchievements',
        );
        achFn({ userId: user.uid })
          .then(res => {
            setAchievements(res.data.achievements ?? []);
            setTotalAch(res.data.totalAvailable ?? 0);
          })
          .catch(() => { /* perfil sem conquistas não é erro */ });
      } catch (error) {
        console.error('Erro ao carregar o próprio perfil:', error);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const [target, current] = await Promise.all([
        getPublicProfile(targetUserId),
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

        // Conquistas desbloqueadas. Sem await no fluxo principal:
        // é informação complementar e não pode segurar a tela,
        // como o registrarVisita segurava.
        const achFn = httpsCallable<AchievementsReq, AchievementsRes>(
          functions,
          'getPublicAchievements',
        );
        achFn({ userId: targetUserId })
          .then(res => {
            setAchievements(res.data.achievements ?? []);
            setTotalAch(res.data.totalAvailable ?? 0);
          })
          .catch(() => { /* perfil sem conquistas não é erro */ });

        if (user?.uid && targetUserId) {
          // Sem await: a visita é registro em segundo plano e o
          // usuário não espera por ela. Com await, a CF
          // registerProfileVisit — que faz cinco leituras antes
          // de gravar — segurava o spinner da tela inteira.
          registrarVisita(user.uid, targetUserId).catch(() => {});

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

          // Missão "Visitar 3 perfis": registrada pelo
          // registerProfileVisit, no servidor.
        }
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendRequest() {
    if (!user || !currentProfile || !targetProfile || isSelf) return;
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

  function handleBlock() {
    if (!user || !targetProfile || isSelf) return;

    Alert.alert(
      '⚠️ Bloquear usuário',
      `Deseja bloquear ${targetProfile.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: async () => {
            try {
              await bloquearUsuario(user.uid, targetUserId, targetProfile.name, targetProfile.photoURL);
            } catch (error) {
              console.error('[RealProfileScreen] bloquear falhou:', error);
              Alert.alert('Não foi possível bloquear', 'Verifique a conexão e tente de novo.');
              return;
            }
            invalidateBlockedUids(); // some da Home/Sintonize na próxima busca
            setBlocked(true);
            navigation.goBack();
          },
        },
      ]
    );
  }

  async function checkAlreadyLiked(uid: string, targetUid: string): Promise<boolean> {
    const likeId   = `${uid}_${targetUid}_${todayBr()}`;
    const likeDoc  = await getDoc(doc(db, 'likes', likeId));
    return likeDoc.exists();
  }

  async function handleLike() {
    if (!user || liked || liking || isSelf) return;
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

        // Missão "Curtir 3 perfis": registrada pelo onCreateMatch.

        // XP GIVE_LIKE e depósito no cofre NÃO são emitidos aqui.
        // O onProfileLike acima já dispara ambos pela via correta:
        // XPService mapeia PROFILE_LIKE → GIVE_LIKE e VaultService
        // deposita 5, ambos atrás do ProfileLikeValidator e do
        // AntiFarmService. Emitir do cliente duplicava os dois — a
        // idempotência do earnXP não pegava, porque o actionId do
        // cliente e o do servidor são chaves diferentes.
      }

    } catch (error) {
      // Limite diário e perfil indisponível vêm com texto pronto do
      // servidor (12/10/2026); o resto, mensagem genérica.
      const code = (error as { code?: string } | null)?.code ?? '';
      const message = error instanceof Error ? error.message : '';
      Alert.alert(
        code.includes('resource-exhausted') ? 'Limite de curtidas' : 'Erro',
        (code.includes('resource-exhausted') || code.includes('failed-precondition')) && message
          ? message
          : 'Não foi possível registrar a curtida.',
      );
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

  // Todos os títulos conquistados, não só o equipado: aqui há
  // espaço, e a coleção conta uma história que o card não conta.
  // O equipado vem PRIMEIRO.
  const equippedTitleId = (prog.equippedTitle as string | undefined) ?? null;
  const targetTitles = ((prog.availableTitles as string[] | undefined) ?? [])
    .map(id => titleById(id))
    .filter((t): t is NonNullable<ReturnType<typeof titleById>> => t !== null)
    .sort((a, b) => {
      if (a.id === equippedTitleId) return -1;
      if (b.id === equippedTitleId) return 1;
      return 0;
    });

  // Quem pode vender: as mesmas funções do isCreator() das regras.
  const targetRole = (targetProfile as { role?: string } | null)?.role;
  const canSell = targetRole === 'creator' || targetRole === 'admin' || targetRole === 'superadmin';

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

  const galleryBlock = (
    <>
      {/* Galeria: até 3 fotos além da principal. */}
      {galleryPhotos(targetProfile).length > 0 && (
        <View style={styles.galleryRow}>
          {galleryPhotos(targetProfile).map((p, i) => (
            <TouchableOpacity
              key={p.slot}
              style={styles.galleryItem}
              onPress={() => setViewerIndex(i)}
              activeOpacity={0.85}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Foto ${i + 1} de ${targetProfile?.name ?? 'perfil'}`}
            >
              <Image source={{ uri: p.uri }} style={styles.galleryImage} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );
  const productsBlock = (
    <>
      {/* Conteúdos à venda — só criador com produto aprovado. */}
      <CreatorProductsRow
        ownerId={targetUserId}
        ownerName={targetProfile?.name}
        enabled={canSell && marketplaceEnabled === true}
        onOpenProduct={openProduct}
      />
    </>
  );
  const meaningBlock = (
    <>
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
    </>
  );
  const titlesBlock = (
    <>
      {/* Títulos conquistados. O equipado vem primeiro e
          destacado — é o símbolo que aparece no card dela. */}
      {targetTitles.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Títulos</Text>
          <View style={styles.titlesRow}>
            {targetTitles.map(t => (
              <View
                key={t.id}
                style={[
                  styles.titleChip,
                  t.id === equippedTitleId && styles.titleChipActive,
                ]}
              >
                <TitleSeal title={t} size={26} />
                <Text style={styles.titleChipLabel}>{t.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );
  const achievementsBlock = (
    <>
      {/* Conquistas — só as desbloqueadas, com descrição.
          O que falta para ELA conquistar não interessa a
          quem está visitando. */}
      {achievements.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Conquistas · {achievements.length}
            {totalAch > 0 ? ` de ${totalAch}` : ''}
          </Text>
          {achievements.map(ach => (
            <View key={ach.id} style={styles.achRow}>
              <Text style={styles.achIcon}>{ach.icon}</Text>
              <View style={styles.achInfo}>
                <Text style={styles.achTitle}>{ach.title}</Text>
                <Text style={styles.achDesc}>{ach.description}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </>
  );
  const sintoniaBlock = (
    <>
      {/* Sintonia — compara QUEM VÊ com o perfil. Não existe
          Sintonia consigo mesmo. */}
      {!isSelf && (
        <View style={styles.card}>
          <Text style={styles.milestoneText}>{getSintoniaLabel()}</Text>
          <SintoniaBar
            score={sintonia}
            showLabel={true}
            showBreakdown={true}
            breakdown={sintoniaBreakdown}
          />
        </View>
      )}

      {!isSelf && sintonia >= 60 && (
        <View style={styles.connectionCard}>
          <Text style={styles.connectionText}>💫 Vocês têm uma conexão forte!</Text>
        </View>
      )}
    </>
  );
  const interestsBlock = (
    <>
      {/* Interesses (Sintonia v2, 12/10/2026). Os que vocês dois
          marcaram ficam em dourado — é por onde a conversa começa. */}
      {(() => {
        const list = targetProfile?.interests ?? [];
        const common = new Set(isSelf ? [] : sintoniaBreakdown.commonInterests);
        if (list.length === 0 && !isSelf) return null;
        return (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Interesses</Text>
            {list.length > 0 ? (
              <View style={styles.tagsRow}>
                {list.map(id => (
                  <View key={id} style={[styles.tag, common.has(id) && styles.tagCommon]}>
                    <Text style={[styles.tagText, common.has(id) && styles.tagCommonText]}>
                      {common.has(id) ? '✦ ' : ''}{interestLabel(id)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.bio}>
                Você ainda não escolheu seus interesses. Eles ajudam a Sintonia a encontrar
                pessoas parecidas com você e aparecem aqui no seu perfil.
              </Text>
            )}
            {!isSelf && common.size > 0 && (
              <Text style={styles.commonHint}>✦ Em dourado: o que vocês têm em comum</Text>
            )}
            {isSelf && (
              <TouchableOpacity
                style={styles.editInterestsBtn}
                onPress={() => navigation.navigate('Interests')}
                accessibilityRole="button"
              >
                <Text style={styles.editInterestsText}>
                  {list.length > 0 ? '✏️ Editar interesses' : '✨ Escolher meus interesses'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })()}
    </>
  );
  const bioBlock = (
    <>
      {/* Bio */}
      {targetProfile?.bio ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Sobre mim</Text>
          <Text style={styles.bio}>{targetProfile.bio}</Text>
        </View>
      ) : null}
    </>
  );
  const infoBlock = (
    <>
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
    </>
  );
  const prefsBlock = (
    <>
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
    </>
  );
  const actionsBlock = (
    <>
      {/* Botões de ação — não existem no próprio perfil. */}
      {!isSelf && (
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
      )}
    </>
  );
  const headerBlock = (
    <>
      <Header
        title={isSelf ? 'Seu perfil' : (targetProfile?.name || 'Perfil')}
        showBack={true}
        showHome={true}
        rightElement={
          isSelf ? undefined : (
            <TouchableOpacity
              onPress={handleBlock}
              accessibilityRole="button"
              accessibilityLabel={`Bloquear ${targetProfile?.name ?? 'usuário'}`}
            >
              <Text style={styles.blockIcon}>🚫</Text>
            </TouchableOpacity>
          )
        }
      />

      {isSelf && (
        <View style={styles.selfBanner} accessibilityRole="text">
          <Text style={styles.selfBannerText}>
            👁️ É assim que as outras pessoas veem o seu perfil
          </Text>
        </View>
      )}
    </>
  );
  const viewerBlock = (
    <>
      <GalleryViewer
        photos={galleryPhotos(targetProfile).map(p => p.uri)}
        initialIndex={viewerIndex ?? 0}
        visible={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
        // Sem denúncia da própria foto: o botão some no isSelf.
        onReport={isSelf ? undefined : () => navigation.navigate('SupportNew', {
          reportUid:  targetUserId,
          reportName: targetProfile?.name ?? '',
        })}
      />
    </>
  );

  // ── Computador (T1, 14/10/2026): duas colunas ──
  // Esquerda: foto em 4:5 (com a moldura de fundo), nome,
  // galeria e os botões Conectar/Conversar/Curtir — a decisão fica
  // sempre à vista. Direita: o que ajuda a decidir (Sintonia,
  // interesses, bio...). Os blocos são os MESMOS do celular.
  if (isDesktop) {
    return (
      <View style={styles.container}>
        {headerBlock}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dScroll}>
          <View style={styles.dRow}>
            <View style={styles.dAside}>
              <View style={styles.dPhotoBox}>
                {targetFrame && (
                  <View style={StyleSheet.absoluteFill}>
                    <ProfileFrame
                      photoURL=""
                      size={DESKTOP_PHOTO_W}
                      ratio={DESKTOP_PHOTO_RATIO}
                      frame={targetFrame}
                      showPhoto={false}
                    />
                  </View>
                )}
                {targetProfile?.photoURL ? (
                  <Image
                    source={{ uri: targetProfile.photoURL }}
                    style={targetFrame ? styles.dPhotoFramed : styles.dPhoto}
                  />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoPlaceholderIcon}>👤</Text>
                  </View>
                )}
              </View>
              <View style={styles.dIdentity}>
                <View style={styles.nameRow}>
                  <Text style={styles.dName} numberOfLines={2}>{targetProfile?.name}, {targetProfile?.age}</Text>
                  <View style={styles.realBadge}>
                    <Text style={styles.realBadgeText}>👤 Real</Text>
                  </View>
                </View>
                <Text style={styles.dLocation}>📍 {targetProfile?.city}, {targetProfile?.state}</Text>
                <View style={styles.dOnline}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>Ativo recentemente</Text>
                </View>
              </View>
              {actionsBlock}
              {galleryBlock}
            </View>

            <View style={styles.dMain}>
              {meaningBlock}
              {sintoniaBlock}
              {interestsBlock}
              {bioBlock}
              {productsBlock}
              <View style={styles.dTwo}>
                <View style={styles.dCol}>{infoBlock}</View>
                <View style={styles.dCol}>{prefsBlock}</View>
              </View>
              {titlesBlock}
              {achievementsBlock}
            </View>
          </View>
        </ScrollView>
        {viewerBlock}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {headerBlock}

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
          {galleryBlock}
          {productsBlock}
          {meaningBlock}
          {titlesBlock}
          {achievementsBlock}
          {sintoniaBlock}
          {interestsBlock}
          {bioBlock}
          {infoBlock}
          {prefsBlock}
          {actionsBlock}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {viewerBlock}
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

  photoInfo:            { position: 'absolute', bottom: spacing.lg, left: spacing.lg, gap: spacing.xs },
  nameRow:              { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Sombra no texto em vez de camada escura sobre a foto: a
  // camada cobria 60% da foto no perfil, onde ela mais importa.
  name:                 { color: colors.white, fontSize: fonts.sizes.xxl, fontWeight: 'bold', textShadowColor: '#000000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  realBadge:            { backgroundColor: colors.gold, borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  realBadgeText:        { color: colors.background, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  location:             { color: colors.white, fontSize: fonts.sizes.md, textShadowColor: '#000000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  // Fundo próprio e pequeno: o verde sobre foto clara sumia sem a
  // camada escura.
  onlineBadge:          { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#0D0D0DAA', borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  onlineDot:            { width: 8, height: 8, borderRadius: 4, backgroundColor: '#44FF88' },
  onlineText:           { color: '#44FF88', fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  content:              { padding: spacing.lg, gap: spacing.md },
  galleryRow:           { flexDirection: 'row', gap: spacing.sm },
  galleryItem:          { flex: 1, aspectRatio: 4 / 5, borderRadius: borderRadius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.gold + '44', backgroundColor: colors.surface },
  galleryImage:         { width: '100%', height: '100%' },
  card:                 { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.grayDark },
  meaningCard:          { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.gold + '11', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.gold + '33' },
  meaningText:          { flex: 1, color: colors.gold, fontSize: fonts.sizes.md, fontStyle: 'italic', lineHeight: 20 },
  milestoneText:        { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold', textAlign: 'center', marginBottom: spacing.md, letterSpacing: 1 },
  titlesRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  titleChip:            { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.grayDark },
  titleChipActive:      { borderColor: colors.gold, backgroundColor: colors.gold + '15' },
  titleChipLabel:       { color: colors.grayLight, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  achRow:               { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.grayDark + '55' },
  achIcon:              { fontSize: 22, width: 30, textAlign: 'center' },
  achInfo:              { flex: 1, gap: 2 },
  achTitle:             { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  achDesc:              { color: colors.gray, fontSize: fonts.sizes.xs, lineHeight: 16 },
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
  tagCommon:            { backgroundColor: colors.gold + '22', borderWidth: 1, borderColor: colors.gold },
  tagCommonText:        { color: colors.gold, fontWeight: 'bold' },
  commonHint:           { color: colors.gray, fontSize: fonts.sizes.xs, marginTop: spacing.sm },
  editInterestsBtn:     { marginTop: spacing.md, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.gold, padding: spacing.sm, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  editInterestsText:    { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.sm },
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
  selfBanner:           { backgroundColor: colors.gold + '18', borderBottomWidth: 1, borderBottomColor: colors.gold + '44', paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  // ── Computador (v5.7) ──
  dScroll:      { padding: 28, paddingBottom: 48 },
  dRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  dAside:       { width: DESKTOP_PHOTO_W, gap: spacing.md },
  dMain:        { flex: 1, minWidth: 0, gap: spacing.md },
  dPhotoBox:    { width: DESKTOP_PHOTO_W, height: Math.round(DESKTOP_PHOTO_W * DESKTOP_PHOTO_RATIO), borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.gold + '44' },
  dPhoto:       { width: '100%', height: '100%' },
  dPhotoFramed: { width: '80%', height: '86%', borderRadius: 14 },
  dIdentity:    { gap: 6 },
  dName:        { flexShrink: 1, color: colors.white, fontSize: 28, fontWeight: 'bold' },
  dLocation:    { color: colors.grayLight, fontSize: fonts.sizes.md },
  dOnline:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dTwo:         { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  dCol:         { flex: 1, minWidth: 0 },
  selfBannerText:       { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold', textAlign: 'center' },
});

