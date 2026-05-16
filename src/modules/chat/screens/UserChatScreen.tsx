import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import Header from '../../../components/Header';
import { RootStackParamList } from '../../../navigation/types';
import { useUserChat } from '../hooks/useChat';
import { useBlock } from '../../profile/hooks/useBlock';
import { ChatMessage } from '../../../shared/types';
import { formatTime } from '../../../shared/utils';

// ============================================
// USER CHAT SCREEN — MÓDULO CHAT
// Screen limpa: apenas renderiza UI.
// Lógica em useUserChat e useBlock.
// ============================================

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function UserChatScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<any>();

  const targetUserId: string = route.params?.userId;
  const targetUserName: string = route.params?.userName;
  const targetUserPhoto: string = route.params?.userPhoto;

  const {
    messages,
    inputText,
    setInputText,
    loading,
    flatListRef,
    sendUserMessage,
  } = useUserChat(targetUserId);

  const { blocked, block } = useBlock(
    targetUserId,
    targetUserName,
    targetUserPhoto,
    () => navigation.goBack()
  );

  function renderMessage({ item }: { item: ChatMessage }) {
    const isMe = item.senderId === user?.uid;
    return (
      <View style={[
        styles.messageRow,
        isMe ? styles.rowMe : styles.rowOther,
      ]}>
        {!isMe && targetUserPhoto ? (
          <Image
            source={{ uri: targetUserPhoto }}
            style={styles.avatar}
          />
        ) : null}
        <View style={[
          styles.bubble,
          isMe ? styles.bubbleMe : styles.bubbleOther,
        ]}>
          <Text style={[
            styles.messageText,
            isMe ? styles.textMe : styles.textOther,
          ]}>
            {item.text}
          </Text>
          <Text style={[
            styles.messageTime,
            isMe ? styles.timeMe : styles.timeOther,
          ]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  }

  if (blocked) {
    return (
      <View style={styles.container}>
        <Header
          title={targetUserName}
          showBack={true}
          showHome={true}
        />
        <View style={styles.blockedContainer}>
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Header
        title={targetUserName}
        showBack={true}
        showHome={true}
        rightElement={
          <TouchableOpacity onPress={block}>
            <Text style={styles.blockIcon}>🚫</Text>
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>
                Início da conversa com {targetUserName}
              </Text>
              <Text style={styles.emptySubtitle}>
                Diga olá! 👋
              </Text>
            </View>
          }
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={`Mensagem para ${targetUserName}...`}
          placeholderTextColor={colors.gray}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            !inputText.trim() && styles.sendButtonDisabled,
          ]}
          onPress={sendUserMessage}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  blockIcon: { fontSize: 20 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  blockedIcon: { fontSize: 60 },
  blockedText: {
    color: colors.gray,
    fontSize: fonts.sizes.lg,
  },
  backButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  backButtonText: { color: colors.white, fontWeight: 'bold' },
  messagesList: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  rowMe: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  bubbleMe: {
    backgroundColor: colors.gold,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  messageText: { fontSize: fonts.sizes.md, lineHeight: 22 },
  textMe: { color: colors.background, fontWeight: '500' },
  textOther: { color: colors.white },
  messageTime: { fontSize: fonts.sizes.xs, marginTop: 4 },
  timeMe: { color: colors.background + 'AA', textAlign: 'right' },
  timeOther: { color: colors.gray },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.grayDark,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    color: colors.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fonts.sizes.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: colors.grayDark },
  sendIcon: {
    color: colors.background,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: spacing.sm,
  },
  emptyIcon: { fontSize: 60 },
  emptyTitle: {
    color: colors.white,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
  },
});