import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { sendMessage, listenToMessages, Message } from '../../services/chatService';
import { registerMessage } from '../../utils/dynamicSintonia';
import { onMessageSent } from '../../services/engagementService';
import Header from '../../components/Header';
import { RootStackParamList } from '../../navigation/types';
import { Badge } from '../../components/ui/Badge';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function ChatScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<any>();
  const targetUserId: string = route.params?.userId || '';
  const targetUserName: string = route.params?.userName || 'Usuário';
  const targetUserPhoto: string = route.params?.userPhoto || '';
  const chatId = user && targetUserId ? [user.uid, targetUserId].sort().join('_') : '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
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
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  async function handleSend() {
    if (!inputText.trim() || !user || !chatId) return;
    const messageText = inputText.trim();
    setInputText('');
    await sendMessage(chatId, messageText, user.uid, user.email || 'Você');
    try {
      await registerMessage(user.uid, targetUserId);
      await onMessageSent(user.uid, targetUserId);
    } catch (error) {
      console.error('[ChatScreen] Erro ao registrar mensagem:', error);
    }
  }

  function formatTime(date: Date): string {
    if (!date) return '';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function renderMessage({ item }: { item: Message }) {
    const isMe = item.senderId === user?.uid;
    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowUser : styles.messageRowOther]}>
        {!isMe && targetUserPhoto ? (
          <Image source={{ uri: targetUserPhoto }} style={styles.avatar} />
        ) : null}
        <View style={[styles.messageBubble, isMe ? styles.bubbleUser : styles.bubbleOther]}>
          <Text style={[styles.messageText, isMe ? styles.messageTextUser : styles.messageTextOther]}>{item.text}</Text>
          <Text style={[styles.messageTime, isMe ? styles.messageTimeUser : styles.messageTimeOther]}>{formatTime(item.timestamp)}</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <Header title={targetUserName} showBack={true} showHome={true} />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.gold} size="large" />
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
              <Text style={styles.emptyTitle}>Início da conversa com {targetUserName}</Text>
            </View>
          }
        />
      )}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={`Mensagem para ${targetUserName}...`}
          placeholderTextColor={COLORS.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
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
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messagesList: { padding: SPACING.md, paddingBottom: SPACING.xl, flexGrow: 1 },
  messageRow: { flexDirection: 'row', marginBottom: SPACING.sm, alignItems: 'flex-end', gap: SPACING.xs },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: COLORS.gold },
  messageBubble: { maxWidth: '75%', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md },
  bubbleUser: { backgroundColor: COLORS.gold, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: COLORS.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  messageText: { fontSize: FONT_SIZE.body, lineHeight: 22 },
  messageTextUser: { color: COLORS.background, fontWeight: '500' },
  messageTextOther: { color: COLORS.textPrimary },
  messageTime: { fontSize: FONT_SIZE.xs, marginTop: 4 },
  messageTimeUser: { color: COLORS.background + 'AA', textAlign: 'right' },
  messageTimeOther: { color: COLORS.textSecondary },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border, gap: SPACING.sm },
  input: { flex: 1, backgroundColor: COLORS.background, color: COLORS.textPrimary, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONT_SIZE.body, borderWidth: 1, borderColor: COLORS.border, maxHeight: 100 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: COLORS.border },
  sendIcon: { color: COLORS.background, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: SPACING.md },
  emptyIcon: { fontSize: 60 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
});
