import React from 'react';
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
import { Button, Card, EmptyState } from '../../../components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';
import Header from '../../../components/Header';
import { RootStackParamList } from '../../../navigation/types';
import { useRequests } from '../hooks/useRequests';
import { ConnectionRequest } from '../services/requestsService';

// ============================================
// REQUESTS SCREEN — MÓDULO PROFILE
// Screen limpa: apenas renderiza UI.
// Lógica em useRequests.
// ============================================

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function RequestsScreen() {
  const navigation = useNavigation<NavProp>();
  const { requests, loading, processingId, accept, reject } = useRequests();

  function renderRequest({ item }: { item: ConnectionRequest }) {
    const isProcessing = processingId === item.id;

    return (
      <Card padding={SPACING.md} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border }}>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('RealProfile', { userId: item.fromUserId })
          }
        >
          {item.fromUserPhoto ? (
            <Image
              source={{ uri: item.fromUserPhoto }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarIcon}>👤</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.requestName}>{item.fromUserName}</Text>
          <Text style={styles.requestText}>
            quer se conectar com você ✦
          </Text>
        </View>

        {isProcessing ? (
          <ActivityIndicator color={COLORS.gold} />
        ) : (
          <View style={styles.requestActions}>
            <Button
              label="✓"
              onPress={() => accept(item)}
              variant="ghost"
              size="sm"
              style={{ borderColor: COLORS.success, minWidth: 36, height: 36, borderRadius: 18 }}
              textStyle={{ color: COLORS.success, fontSize: FONT_SIZE.subtitle }}
            />
            <Button
              label="✕"
              onPress={() => reject(item)}
              variant="ghost"
              size="sm"
              style={{ borderColor: COLORS.error, minWidth: 36, height: 36, borderRadius: 18 }}
              textStyle={{ color: COLORS.error, fontSize: FONT_SIZE.subtitle }}
            />
          </View>
        )}
      </Card>
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
          subtitle="Quando alguém quiser se conectar, aparecerá aqui"
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          renderItem={renderRequest}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View style={styles.separator} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // requestItem removed — now uses <Card>
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  avatarIcon: { fontSize: 24 },
  requestName: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.bold,
  },
  requestText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.caption,
    marginTop: 2,
  },
  requestActions: { flexDirection: 'row', gap: SPACING.sm },
  // accept/reject buttons removed — now use <Button>
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: SPACING.lg + 56 + SPACING.md,
  },
  // empty state removed — now uses <EmptyState>
});