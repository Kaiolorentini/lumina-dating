import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { AIModel } from '../../utils/aiModels';
import SintoniaBar from '../../components/SintoniaBar';
import SintoniaToast from '../../components/SintoniaToast';
import Header from '../../components/Header';
import ProgressiveGallery from '../../components/ProgressiveGallery';
import { useAuth } from '../../context/AuthContext';
import { useSintonia } from '../../modules/ai/hooks/useSintonia';
import { dispararMensagemAutomatica } from '../../services/autoMessageService';
import { RootStackParamList } from '../../navigation/types';

const { width, height } = Dimensions.get('window');

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AIProfile'>;
  route: RouteProp<RootStackParamList, 'AIProfile'>;
};

function StatusBadge({ status }: { status: AIModel['status'] }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'online') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.4,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [status]);

  const statusConfig = {
    online: { color: '#44FF88', label: 'Online agora' },
    offline: { color: colors.gray, label: 'Offline' },
    ocupada: { color: '#FFB344', label: 'Ocupada' },
  };

  const config = statusConfig[status];

  return (
    <View style={statusStyles.container}>
      <View style={statusStyles.dotWrapper}>
        {status === 'online' && (
          <Animated.View
            style={[
              statusStyles.pulse,
              {
                backgroundColor: config.color + '44',
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        )}
        <View style={[statusStyles.dot, { backgroundColor: config.color }]} />
      </View>
      <Text style={[statusStyles.label, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

const statusStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dotWrapper: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', width: 12, height: 12, borderRadius: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: fonts.sizes.sm, fontWeight: 'bold' },
});

export default function AIProfileScreen({ navigation, route }: Props) {
  const { model } = route.params;
  const { user } = useAuth();
  const [typing, setTyping] = useState(false);
  const typingAnim = useRef(new Animated.Value(0)).current;

  // Hook de Sintonia — cuida de visita, tempo e estado
  const {
    sintonia,
    milestone,
    toastMessage,
    toastVisible,
  } = useSintonia(model.id, model.sintonia);

  // Dispara mensagem automática ao entrar no perfil
  useEffect(() => {
    if (!user) return;
    dispararMensagemAutomatica(user.uid, model).catch(console.error);
  }, []);

  // Animação de "digitando..."
  useEffect(() => {
    if (model.status === 'online') {
      const timer = setTimeout(() => {
        setTyping(true);
        Animated.loop(
          Animated.sequence([
            Animated.timing(typingAnim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(typingAnim, {
              toValue: 0,
              duration: 600,
              useNativeDriver: true,
            }),
          ])
        ).start();
        setTimeout(() => setTyping(false), 4000);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <View style={styles.container}>
      <SintoniaToast
        message={toastMessage}
        milestone={milestone}
        visible={toastVisible}
      />

      <Header
        title={model.name}
        showBack={true}
        showHome={true}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Foto principal */}
        <View style={styles.photoContainer}>
          <Image source={{ uri: model.photoURL }} style={styles.mainPhoto} />
          <View style={styles.photoOverlay} />
          <View style={styles.photoInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{model.name}, {model.age}</Text>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>🤖 IA</Text>
              </View>
            </View>
            <Text style={styles.location}>📍 {model.location}</Text>
            <StatusBadge status={model.status} />
          </View>
        </View>

        <View style={styles.content}>
          {/* Sintonia */}
          <View style={styles.card}>
            <Text style={styles.milestoneText}>{milestone}</Text>
            <SintoniaBar
              score={sintonia}
              showLabel={true}
              showBreakdown={true}
              breakdown={{
                localizacao: 20,
                preferencia: 35,
                perfil: 25,
                interesses: Math.min(Math.round((sintonia - 50) * 0.3), 15),
              }}
            />
          </View>

          {sintonia >= 60 && (
            <View style={styles.connectionCard}>
              <Text style={styles.connectionText}>
                💫 Vocês estão criando uma conexão forte
              </Text>
            </View>
          )}

          {typing && (
            <Animated.View
              style={[styles.typingContainer, { opacity: typingAnim }]}
            >
              <Text style={styles.typingText}>
                {model.name} está digitando...
              </Text>
            </Animated.View>
          )}

          {/* Bio */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sobre mim</Text>
            <Text style={styles.bio}>{model.bio}</Text>
          </View>

          {/* O que busca */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>O que busco</Text>
            <Text style={styles.lookingFor}>💭 {model.lookingFor}</Text>
          </View>

          {/* Interesses */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Interesses</Text>
            <View style={styles.tagsRow}>
              {model.interests.map((interest, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Personalidade */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Personalidade</Text>
            <View style={styles.tagsRow}>
              {model.personality.map((trait, index) => (
                <View key={index} style={[styles.tag, styles.tagGold]}>
                  <Text style={[styles.tagText, styles.tagTextGold]}>
                    {trait}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Galeria Progressiva */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Galeria</Text>
            {user && (
              <ProgressiveGallery
                userId={user.uid}
                profileId={model.id}
                sintonia={sintonia}
                gallery={model.gallery}
              />
            )}
          </View>

          <Text style={styles.lastSeen}>
            Visto por último: {model.lastSeen}
          </Text>

          {/* Botões */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.chatButton}
              onPress={() => navigation.navigate('Chat', { model })}
            >
              <Text style={styles.chatButtonText}>💬 Conversar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.likeButton}>
              <Text style={styles.likeButtonText}>❤️</Text>
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
  photoContainer: { width, height: height * 0.45, position: 'relative' },
  mainPhoto: { width: '100%', height: '100%' },
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { color: colors.white, fontSize: fonts.sizes.xxl, fontWeight: 'bold' },
  aiBadge: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  aiBadgeText: {
    color: colors.background,
    fontSize: fonts.sizes.xs,
    fontWeight: 'bold',
  },
  location: { color: colors.grayLight, fontSize: fonts.sizes.md },
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
  bio: { color: colors.grayLight, fontSize: fonts.sizes.md, lineHeight: 24 },
  lookingFor: {
    color: colors.grayLight,
    fontSize: fonts.sizes.md,
    lineHeight: 24,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    backgroundColor: colors.grayDark,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  tagGold: {
    backgroundColor: colors.gold + '22',
    borderWidth: 1,
    borderColor: colors.gold + '44',
  },
  tagText: { color: colors.grayLight, fontSize: fonts.sizes.sm },
  tagTextGold: { color: colors.gold },
  lastSeen: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    textAlign: 'center',
  },
  typingContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold + '44',
  },
  typingText: {
    color: colors.gold,
    fontSize: fonts.sizes.sm,
    fontStyle: 'italic',
  },
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
  likeButtonText: { fontSize: 24 },
});