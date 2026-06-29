// ============================================
// LUMINA — CHAT SCREEN (IA) v5.1
// src/screens/Chat/ChatScreen.tsx
//
// CORREÇÕES:
// - getChatId → chatId local calculado
// - aiResponses/aiModels → removidos (IA removida)
// - sendMessage: último arg é string (senderName)
// - isAI removido de ChatMessage
// - onMessageSent: apenas 2 args (uid, targetUid)
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth }           from '../../context/AuthContext';
import { sendMessage, listenToMessages, Message } from '../../services/chatService';
import { registerMessage }   from '../../utils/dynamicSintonia';
import { onMessageSent }     from '../../services/engagementService';
import Header                from '../../components/Header';
import { RootStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Fallback simples já que IA foi removida
// ChatScreen de IA não deve mais ser acessada
// mas mantemos para não quebrar imports existentes
export default function ChatScreen() {
  const { user }     = useAuth();
  const navigation   = useNavigation<NavProp>();
  const route        = useRoute<any>();

  const targetUserId: string   = route.params?.userId   || '';
  const targetUserName: string = route.params?.userName || 'Usuário';
  const targetUserPhoto: string = route.params?.userPhoto || '';

  // chatId calculado localmente (sem getChatId do service)
  const chatId = user && targetUserId
    ? [user.uid, targetUserId].sort().join('_')
    : '';

  const [messages, setMessages]   = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading]     = useState(true);
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
    // sendMessage: (chatId, text, senderId, senderName) — sem boolean isAI
    await sendMessage(chatId, messageText, user.uid, user.email || 'Você');
    try {
      await registerMessage(user.uid, targetUserId);
      await onMessageSent(user.uid, targetUserId); // apenas 2 args v5.1
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
          <Text style={[styles.messageText, isMe ? styles.messageTextUser : styles.messageTextOther]}>
            {item.text}
          </Text>
          <Text style={[styles.messageTime, isMe ? styles.messageTimeUser : styles.messageTimeOther]}>
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
      <Header title={targetUserName} showBack={true} showHome={true} />
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
              <Text style={styles.emptyTitle}>Início da conversa com {targetUserName}</Text>
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
  container:        { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messagesList:     { padding: spacing.md, paddingBottom: spacing.xl, flexGrow: 1 },
  messageRow:       { flexDirection: 'row', marginBottom: spacing.sm, alignItems: 'flex-end', gap: spacing.xs },
  messageRowUser:   { justifyContent: 'flex-end' },
  messageRowOther:  { justifyContent: 'flex-start' },
  avatar:           { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.gold },
  messageBubble:    { maxWidth: '75%', borderRadius: borderRadius.md, padding: spacing.md },
  bubbleUser:       { backgroundColor: colors.gold, borderBottomRightRadius: 4 },
  bubbleOther:      { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.grayDark },
  messageText:      { fontSize: fonts.sizes.md, lineHeight: 22 },
  messageTextUser:  { color: colors.background, fontWeight: '500' },
  messageTextOther: { color: colors.white },
  messageTime:      { fontSize: fonts.sizes.xs, marginTop: 4 },
  messageTimeUser:  { color: colors.background + 'AA', textAlign: 'right' },
  messageTimeOther: { color: colors.gray },
  inputContainer:   { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.grayDark, gap: spacing.sm },
  input:            { flex: 1, backgroundColor: colors.background, color: colors.white, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fonts.sizes.md, borderWidth: 1, borderColor: colors.grayDark, maxHeight: 100 },
  sendButton:       { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: colors.grayDark },
  sendIcon:         { color: colors.background, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  emptyContainer:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.md },
  emptyIcon:        { fontSize: 60 },
  emptyTitle:       { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', textAlign: 'center' },
});