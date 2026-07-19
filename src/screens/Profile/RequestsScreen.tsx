import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import {
  ConnectionRequest,
  listenToRequests,
  aceitarSolicitacao,
  rejeitarSolicitacao,
} from '../../services/requestsService';
import Header from '../../components/Header';
import { RootStackParamList } from '../../navigation/types';
import { getProfile } from '../../services/profileService';
import { EmptyState } from '../../components/ui/EmptyState';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function RequestsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToRequests(user.uid, (reqs) => {
      setRequests(reqs);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  async function handleAccept(request: ConnectionRequest) {
    if (!user) return;
    setProcessingId(request.id);
    try {
      const myProfile = await getProfile(user.uid);
      await aceitarSolicitacao(request.id, myProfile?.name || 'Usuário', request.fromUserId);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(request: ConnectionRequest) {
    setProcessingId(request.id);
    try {
      await rejeitarSolicitacao(request.id);
    } finally {
      setProcessingId(null);
    }
  }

  function renderRequest({ item }: { item: ConnectionRequest }) {
    const isProcessing = processingId === item.id;
    return (
      <View style={styles.requestItem}>
        <TouchableOpacity onPress={() => navigation.navigate('RealProfile', { userId: item.fromUserId })}>
          {item.fromUserPhoto ? (
            <Image source={{ uri: item.fromUserPhoto }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarIcon}>👤</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.requestInfo}>
          <Text style={styles.requestName}>{item.fromUserName}</Text>
          <Text style={styles.requestText}>quer se conectar com você ✦</Text>
        </View>

        {isProcessing ? (
          <ActivityIndicator color={COLORS.gold} />
        ) : (
          <View style={styles.requestActions}>
            <TouchableOpacity style={styles.acceptButton} onPress={() => handleAccept(item)}>
              <Text style={styles.acceptButtonText}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectButton} onPress={() => handleReject(item)}>
              <Text style={styles.rejectButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Solicitações" showBack={true} showHome={true} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.gold} size="large" />
        </View>
      ) : requests.length === 0 ? (
        <EmptyState
          icon="✦"
          title="Nenhuma solicitação"
          subtitle="Quando alguém quiser se conectar com você, aparecerá aqui"
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          renderItem={renderRequest}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  requestItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, gap: SPACING.md },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: COLORS.gold },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border },
  avatarIcon: { fontSize: 24 },
  requestInfo: { flex: 1 },
  requestName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  requestText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: SPACING.sm },
  acceptButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  acceptButtonText: { color: COLORS.background, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  rejectButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.error, alignItems: 'center', justifyContent: 'center' },
  rejectButtonText: { color: COLORS.error, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  separator: { height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.lg + 56 + SPACING.md },
});
