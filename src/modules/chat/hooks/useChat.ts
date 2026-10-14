// ============================================
// LUMINA — USE USER CHAT
// src/modules/chat/hooks/useChat.ts
//
// 13/10/2026 (web D7):
// • Só as últimas 50 mensagens (MESSAGES_PAGE). "Carregar anteriores"
//   (loadOlder) amplia de 50 em 50. hasOlder: a página veio cheia.
// • Erro ao abrir a conversa mostra uma frase para a pessoa, não o
//   código técnico do Firebase (que continua no console).
// ============================================

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
  /** Há mensagens mais antigas que as carregadas. */
  hasOlder: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
}

/** Mensagens por página (a mais nova primeiro). */
export const MESSAGES_PAGE = 50;

export function useUserChat(targetUserId: string): UseUserChatReturn {
  const { user } = useAuth();
  const chatId = user ? generateChatId(user.uid, targetUserId) : '';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [messageLimit, setMessageLimit] = useState(MESSAGES_PAGE);
  const [loadingOlder, setLoadingOlder] = useState(false);
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
        setLoadingOlder(false);
      },
      (error: { code: string; message: string }) => {
        console.error('[CHAT_ERROR]', error.code, error.message);
        Alert.alert(
          'Não foi possível abrir a conversa',
          'Verifique sua conexão e tente de novo. Se continuar, fale com o Suporte.',
        );
        setLoading(false);
        setLoadingOlder(false);
      },
      messageLimit,
    );

    return unsubscribe;
  }, [chatId, messageLimit]);

  const hasOlder = !loading && messages.length >= messageLimit;

  function loadOlder() {
    if (!hasOlder || loadingOlder) return;
    setLoadingOlder(true);
    setMessageLimit(n => n + MESSAGES_PAGE);
  }

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

  return {
    messages, inputText, setInputText, loading, flatListRef, sendUserMessage, sendAudioMessage,
    hasOlder, loadingOlder, loadOlder,
  };
}
