// ============================================
// LUMINA — USER CHAT SCREEN v5.1
// src/screens/Chat/UserChatScreen.tsx
//
// CORREÇÃO: sendMessage sem boolean no último arg
// sendMessage(chatId, text, senderId, senderName)
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  Alert, Image,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth }     from '../../context/AuthContext';
import { sendMessage, listenToMessages, Message } from '../../services/chatService';
import Header          from '../../components/Header';
import { RootStackParamList }  from '../../navigation/types';
import { bloquearUsuario, estaBloqueado } from '../../services/blockService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function UserChatScreen() {
  const { user }     = useAuth();
  const navigation   = useNavigation<NavProp>();
  const route        = useRoute<any>();

  const targetUserId: string    = route.params?.userId;
  const targetUserName: string  = route.params?.userName;
  const targetUserPhoto: string = route.params?.userPhoto;

  const chatId = [user?.uid, targetUserId].sort().join('_');

  const [messages, setMessages]   = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading]     = useState(true);
  const [blocked, setBlocked]     = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    checkBlocked();
    const unsubscribe = listenToMessages(chatId, (msgs) => {
      setMessages(msgs);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  async function checkBlocked() {
    if (!user) return;
    const isBlocked = await estaBloqueado(user.uid, targetUserId);
    setBlocked(isBlocked);
  }

  async function handleSend() {
    if (!inputText.trim() || !user) return;
    const text = inputText.trim();
    setInputText('');
    // v5.1: sem boolean — último arg é senderName (string)
    await sendMessage(chatId, text, user.uid, user.email || 'Você');
  }

  async function handleBlock() {
    if (!user) return;
    Alert.alert(
      '🚫 Bloquear usuário',
      `Deseja bloquear ${targetUserName}? Você não receberá mais mensagens.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: async () => {
            await bloquearUsuario(user.uid, targetUserId, targetUserName, targetUserPhoto);
            setBlocked(true);
            navigation.goBack();
          },
        },
      ]
    );
  }

  function formatTime(date: Date): string {
    if (!date) return '';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function renderMessage({ item }: { item: Message }) {
    const isMe = item.senderId === user?.uid;
    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
        {!isMe && targetUserPhoto ? (
          <Image source={{ uri: targetUserPhoto }} style={styles.avatar} />
        ) : null}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextOther]}>
            {item.text}
          </Text>
          <Text style={[styles.messageTime, isMe ? styles.messageTimeMe : styles.messageTimeOther]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Header
        title={targetUserName}
        showBack={true}
        showHome={true}
        rightElement={
          <TouchableOpacity onPress={handleBlock}>
            <Text style={styles.blockIcon}>🚫</Text>
          </TouchableOpacity>
        }
      />
      {blocked ? (
        <View style={styles.blockedContainer}>
          <Text style={styles.blockedIcon}>🚫</Text>
          <Text style={styles.blockedText}>Usuário bloqueado</Text>
          <TouchableOpacity style={styles.unblockButton} onPress={() => navigation.goBack()}>
            <Text style={styles.unblockButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
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
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: colors.background },
  blockIcon:         { fontSize: 20 },
  blockedContainer:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  blockedIcon:       { fontSize: 60 },
  blockedText:       { color: colors.gray, fontSize: fonts.sizes.lg },
  unblockButton:     { backgroundColor: colors.surface, borderRadius: borderRadius.sm, padding: spacing.md, paddingHorizontal: spacing.xl, borderWidth: 1, borderColor: colors.grayDark },
  unblockButtonText: { color: colors.white, fontWeight: 'bold' },
  messagesList:      { padding: spacing.md, paddingBottom: spacing.xl, flexGrow: 1 },
  messageRow:        { flexDirection: 'row', marginBottom: spacing.sm, alignItems: 'flex-end', gap: spacing.xs },
  messageRowMe:      { justifyContent: 'flex-end' },
  messageRowOther:   { justifyContent: 'flex-start' },
  avatar:            { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.gold },
  bubble:            { maxWidth: '75%', borderRadius: borderRadius.md, padding: spacing.md },
  bubbleMe:          { backgroundColor: colors.gold, borderBottomRightRadius: 4 },
  bubbleOther:       { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.grayDark },
  messageText:       { fontSize: fonts.sizes.md, lineHeight: 22 },
  messageTextMe:     { color: colors.background, fontWeight: '500' },
  messageTextOther:  { color: colors.white },
  messageTime:       { fontSize: fonts.sizes.xs, marginTop: 4 },
  messageTimeMe:     { color: colors.background + 'AA', textAlign: 'right' },
  messageTimeOther:  { color: colors.gray },
  inputContainer:    { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.grayDark, gap: spacing.sm },
  input:             { flex: 1, backgroundColor: colors.background, color: colors.white, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fonts.sizes.md, borderWidth: 1, borderColor: colors.grayDark, maxHeight: 100 },
  sendButton:        { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: colors.grayDark },
  sendIcon:          { color: colors.background, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  emptyContainer:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.md },
  emptyIcon:         { fontSize: 60 },
  emptyTitle:        { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', textAlign: 'center' },
});