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
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import Header from '../../../components/Header';
import { useAIChat } from '../hooks/useChat';
import { AI_MODELS, AIModel } from '../../../utils/aiModels';
import { ChatMessage } from '../../../shared/types';
import { formatTime } from '../../../shared/utils';

export default function ChatScreen() {
  const { user } = useAuth();
  const route = useRoute<any>();

  const aiModel: AIModel =
    route.params?.model ||
    route.params?.params?.model ||
    AI_MODELS[0];

  const {
    messages,
    inputText,
    setInputText,
    isTyping,
    loading,
    flatListRef,
    sendUserMessage,
  } = useAIChat(aiModel);

  function renderMessage({ item }: { item: ChatMessage }) {
    const isUser = !item.isAI;
    return (
      <View style={[
        styles.messageRow,
        isUser ? styles.rowUser : styles.rowAI,
      ]}>
        {!isUser && (
          <Image
            source={{ uri: aiModel.photoURL }}
            style={styles.avatar}
          />
        )}
        <View style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAI,
        ]}>
          <Text style={[
            styles.messageText,
            isUser ? styles.textUser : styles.textAI,
          ]}>
            {item.text}
          </Text>
          <Text style={[
            styles.messageTime,
            isUser ? styles.timeUser : styles.timeAI,
          ]}>
            {formatTime(item.timestamp)}
          </Text>
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
        title={aiModel.name}
        showBack={true}
        showHome={true}
        rightElement={
          <Text style={styles.sintonia}>{aiModel.sintonia}% ✦</Text>
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
                Comece uma conversa com {aiModel.name}!
              </Text>
              <Text style={styles.emptySubtitle}>
                {aiModel.sintonia}% de Sintonia
              </Text>
            </View>
          }
        />
      )}

      {isTyping && (
        <View style={styles.typingContainer}>
          <Image source={{ uri: aiModel.photoURL }} style={styles.typingAvatar} />
          <View style={styles.typingBubble}>
            <Text style={styles.typingText}>
              {aiModel.name} está digitando...
            </Text>
          </View>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={`Mensagem para ${aiModel.name}...`}
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
  sintonia: {
    color: colors.gold,
    fontSize: fonts.sizes.sm,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  rowUser: { justifyContent: 'flex-end' },
  rowAI: { justifyContent: 'flex-start' },
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
  bubbleUser: {
    backgroundColor: colors.gold,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  messageText: { fontSize: fonts.sizes.md, lineHeight: 22 },
  textUser: { color: colors.background, fontWeight: '500' },
  textAI: { color: colors.white },
  messageTime: { fontSize: fonts.sizes.xs, marginTop: 4 },
  timeUser: { color: colors.background + 'AA', textAlign: 'right' },
  timeAI: { color: colors.gray },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  typingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  typingBubble: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderBottomLeftRadius: 4,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gold + '44',
  },
  typingText: {
    color: colors.gold,
    fontSize: fonts.sizes.xs,
    fontStyle: 'italic',
  },
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
    color: colors.gold,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
  },
});