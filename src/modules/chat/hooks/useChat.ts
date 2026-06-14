import React, { useState, useEffect, useRef } from 'react';
import { Alert, FlatList } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import {
  sendMessage,
  listenToMessages,
  generateChatId,
} from '../services/messageService';
import { ChatMessage } from '../../../shared/types';

interface UseUserChatReturn {
  messages: ChatMessage[];
  inputText: string;
  setInputText: (text: string) => void;
  loading: boolean;
  flatListRef: React.MutableRefObject<FlatList<ChatMessage> | null>;
  sendUserMessage: () => Promise<void>;
  sendAudioMessage: (audioUrl: string, duration: number) => Promise<void>;
}

export function useUserChat(targetUserId: string): UseUserChatReturn {
  const { user } = useAuth();
  const chatId = user ? generateChatId(user.uid, targetUserId) : '';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList<ChatMessage> | null>(null);

  useEffect(() => {
    if (!chatId) {
      setLoading(false);
      return;
    }

    const unsubscribe = listenToMessages(
      chatId,
      msgs => {
        setMessages(msgs);
        setLoading(false);
      },
      (error: { code: string; message: string }) => {
        console.error('[CHAT_ERROR]', error.code, error.message);
        Alert.alert('Erro no chat', `${error.code}: ${error.message}`);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [chatId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  async function sendUserMessage() {
    if (!inputText.trim() || !user || !chatId) return;
    const text = inputText.trim();
    setInputText('');
    await sendMessage(
      chatId,
      text,
      user.uid,
      user.displayName || user.email || 'Você',
      targetUserId
    );
  }

  async function sendAudioMessage(audioUrl: string, duration: number) {
    if (!user || !chatId) return;
    await sendMessage(
      chatId,
      '',
      user.uid,
      user.displayName || user.email || 'Você',
      targetUserId,
      audioUrl,
      duration
    );
  }

  return { messages, inputText, setInputText, loading, flatListRef, sendUserMessage, sendAudioMessage };
}