import React, { useState, useEffect, useRef } from 'react';
import { FlatList } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import {
  sendMessage,
  listenToMessages,
  generateAIChatId,
  generateChatId,
} from '../services/messageService';
import {
  generateAIResponse,
  getTypingDelay,
} from '../services/aiResponseService';
import { ChatMessage } from '../../../shared/types';
import { AIModel } from '../../../utils/aiModels';

interface UseAIChatReturn {
  messages: ChatMessage[];
  inputText: string;
  setInputText: (text: string) => void;
  isTyping: boolean;
  loading: boolean;
  flatListRef: React.MutableRefObject<FlatList<ChatMessage> | null>;
  sendUserMessage: () => Promise<void>;
}

export function useAIChat(aiModel: AIModel): UseAIChatReturn {
  const { user } = useAuth();
  const chatId = user ? generateAIChatId(user.uid, aiModel.id) : '';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList<ChatMessage> | null>(null);

  useEffect(() => {
    if (!chatId) return;
    const unsubscribe = listenToMessages(chatId, msgs => {
      setMessages(msgs);
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

  async function sendUserMessage() {
    if (!inputText.trim() || !user || !chatId) return;
    const text = inputText.trim();
    setInputText('');
    await sendMessage(chatId, text, user.uid, user.email || 'Voce', false);
    setIsTyping(true);
    const delay = getTypingDelay(text);
    setTimeout(async () => {
      const response = generateAIResponse(text, aiModel.name);
      setIsTyping(false);
      await sendMessage(chatId, response, aiModel.id, aiModel.name, true);
    }, delay);
  }

  return {
    messages,
    inputText,
    setInputText,
    isTyping,
    loading,
    flatListRef,
    sendUserMessage,
  };
}

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
    if (!chatId) return;
    const unsubscribe = listenToMessages(chatId, msgs => {
      setMessages(msgs);
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

  async function sendUserMessage() {
    if (!inputText.trim() || !user || !chatId) return;
    const text = inputText.trim();
    setInputText('');
    await sendMessage(
      chatId,
      text,
      user.uid,
      user.email || 'Voce',
      false,
      targetUserId
    );
  }

  async function sendAudioMessage(audioUrl: string, duration: number) {
    if (!user || !chatId) return;
    await sendMessage(
      chatId,
      '',
      user.uid,
      user.email || 'Voce',
      false,
      targetUserId,
      audioUrl,
      duration
    );
  }

  return {
    messages,
    inputText,
    setInputText,
    loading,
    flatListRef,
    sendUserMessage,
    sendAudioMessage,
  };
}