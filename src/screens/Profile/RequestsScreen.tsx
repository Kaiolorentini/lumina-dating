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
import { colors, fonts, spacing, borderRadius } from '../../theme';
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
      await aceitarSolicitacao(
        request.id,
        myProfile?.name || 'Usuário',
        request.fromUserId
      );
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
        <TouchableOpacity
          onPress={() => navigation.navigate('RealProfile', { userId: item.fromUserId })}
        >
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
          <ActivityIndicator color={colors.gold} />
        ) : (
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAccept(item)}
            >
              <Text style={styles.acceptButtonText}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => handleReject(item)}
            >
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
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✦</Text>
          <Text style={styles.emptyTitle}>Nenhuma solicitação</Text>
          <Text style={styles.emptySubtitle}>
            Quando alguém quiser se conectar com você, aparecerá aqui
          </Text>
        </View>
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
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.grayDark,
  },
  avatarIcon: { fontSize: 24 },
  requestInfo: { flex: 1 },
  requestName: {
    color: colors.white,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
  },
  requestText: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    marginTop: 2,
  },
  requestActions: { flexDirection: 'row', gap: spacing.sm },
  acceptButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: colors.background,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
  },
  rejectButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButtonText: {
    color: colors.error,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    backgroundColor: colors.grayDark,
    marginLeft: spacing.lg + 56 + spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: { fontSize: 60, color: colors.gold },
  emptyTitle: {
    color: colors.white,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
  },
  emptySubtitle: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },
});