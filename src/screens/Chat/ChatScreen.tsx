import React, { useState, useEffect, useRef } from 'react';
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
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import {
  sendMessage,
  listenToMessages,
  getChatId,
  Message,
} from '../../services/chatService';
import { generateAIResponse, getTypingDelay } from '../../utils/aiResponses';
import { AI_MODELS, AIModel } from '../../utils/aiModels';
import { registerMessage } from '../../utils/dynamicSintonia';
import Header from '../../components/Header';
import { RootStackParamList } from '../../navigation/types';
import { onMessageSent } from '../../services/engagementService';
type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function ChatScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<any>();

  const aiModel: AIModel = route.params?.model || route.params?.params?.model || AI_MODELS[0];
  const chatId = user ? getChatId(user.uid, aiModel.id) : '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!chatId) return;
    const unsubscribe = listenToMessages(chatId, (newMessages) => {
      setMessages(newMessages);
      setLoading(false);
    });
    return unsubscribe;
  }, [chatId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      setTimeout(() => setIsTyping(true), 1500);
      setTimeout(() => setIsTyping(false), 5000);
    }
  }, []);

  async function handleSend() {
    if (!inputText.trim() || !user || !chatId) return;

    const messageText = inputText.trim();
    setInputText('');

    await sendMessage(
      chatId,
      messageText,
      user.uid,
      user.email || 'Você',
      false
    );

    // Registra no sistema de engajamento central
    try {
      await registerMessage(user.uid, aiModel.id);
      await onMessageSent(user.uid, aiModel.id, aiModel.name);
    } catch (error) {
      console.error('Erro ao registrar mensagem:', error);
    }
    

    setIsTyping(true);
    const delay = getTypingDelay(messageText);
    setTimeout(async () => {
      const aiResponse = generateAIResponse(messageText, aiModel.name);
      setIsTyping(false);
      await sendMessage(chatId, aiResponse, aiModel.id, aiModel.name, true);
    }, delay);
  }

  function formatTime(date: Date): string {
    if (!date) return '';
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function renderMessage({ item }: { item: Message }) {
    const isUser = !item.isAI;
    return (
      <View style={[
        styles.messageRow,
        isUser ? styles.messageRowUser : styles.messageRowAI,
      ]}>
        {!isUser && (
          <Image source={{ uri: aiModel.photoURL }} style={styles.avatar} />
        )}
        <View style={[
          styles.messageBubble,
          isUser ? styles.bubbleUser : styles.bubbleAI,
        ]}>
          <Text style={[
            styles.messageText,
            isUser ? styles.messageTextUser : styles.messageTextAI,
          ]}>
            {item.text}
          </Text>
          <Text style={[
            styles.messageTime,
            isUser ? styles.messageTimeUser : styles.messageTimeAI,
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
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <Header
        title={aiModel.name}
        showBack={true}
        showHome={true}
        rightElement={
          <Text style={styles.sintoniaText}>
            {aiModel.sintonia}% ✦
          </Text>
        }
      />

      {/* Mensagens */}
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
                Você tem {aiModel.sintonia}% de Sintonia
              </Text>
            </View>
          }
        />
      )}

      {/* Indicador digitando */}
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

      {/* Input */}
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
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sintoniaText: {
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
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowAI: { justifyContent: 'flex-start' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  messageBubble: {
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
  messageText: {
    fontSize: fonts.sizes.md,
    lineHeight: 22,
  },
  messageTextUser: {
    color: colors.background,
    fontWeight: '500',
  },
  messageTextAI: { color: colors.white },
  messageTime: {
    fontSize: fonts.sizes.xs,
    marginTop: 4,
  },
  messageTimeUser: {
    color: colors.background + 'AA',
    textAlign: 'right',
  },
  messageTimeAI: { color: colors.gray },
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
  },
  emptyIcon: { fontSize: 60, marginBottom: spacing.lg },
  emptyTitle: {
    color: colors.white,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    color: colors.gold,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
  },
});