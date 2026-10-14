// ============================================
// LUMINA — CONVERSA (corpo do chat)
// src/modules/chat/components/ChatConversation.tsx
//
// 13/10/2026 (web D6): o corpo do UserChatScreen v5.2 virou este
// componente, SEM mudar a lógica (mensagens, digitando, reações,
// áudio, bloqueio, lido/entregue). Ele é usado:
//   • variant="screen": pela tela UserChat (celular e app) — o mesmo
//     Header de antes, com voltar, 🏠 e bloquear;
//   • variant="pane": pelo painel da direita das Sintonias no
//     computador — cabeçalho próprio com "Ver perfil" e bloquear.
// Novidades (só aparecem quando a tela pai manda):
//   • `banner`: faixa "em comum" no topo da conversa;
//   • `suggestions`: respostas rápidas — tocar PREENCHE o campo (a
//     pessoa revisa e envia), nunca envia sozinho. Somem quando a
//     conversa engrena (6+ mensagens) ou com texto no campo.
// Na web: Enter envia (Shift+Enter quebra linha) e o botão de áudio
// não aparece — gravar/enviar áudio pelo navegador ainda não é
// suportado (W13). Ouvir áudios recebidos continua funcionando.
//
// Histórico do UserChatScreen:
// v5.2: progressMission send_message ao enviar (fire-and-forget)
// ============================================

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  Image, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { useSafeAreaInsets }                from 'react-native-safe-area-context';
import { getFunctions, httpsCallable }      from 'firebase/functions';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { useAuth }                          from '../../../context/AuthContext';
import Header                              from '../../../components/Header';
import { useUserChat }                     from '../hooks/useChat';
import { useBlock }                        from '../../profile/hooks/useBlock';
import { ChatMessage }                     from '../../../shared/types';
import { formatTime }                      from '../../../shared/utils';
import { todayBrUnderscore }               from '../../../utils/dateBr';
import { markAsDelivered, markAsRead, generateChatId } from '../services/messageService';
import { Audio }                           from 'expo-av';
import {
  setupAudio, startRecording, stopRecording,
  uploadAudio, playAudio, MAX_DURATION,
} from '../services/audioService';
import { setTyping, listenToTyping, addReaction } from '../services/typingService';

/** Respostas rápidas somem quando a conversa já tem isto de mensagens. */
const SUGGESTIONS_MAX_MESSAGES = 6;

export interface ChatConversationProps {
  targetUserId:    string;
  targetUserName:  string;
  targetUserPhoto: string;
  variant:         'screen' | 'pane';
  /** Depois de bloquear (tela: volta; painel: tira da lista). */
  onBlocked:       () => void;
  /** Só no painel: abre o perfil da pessoa. */
  onOpenProfile?:  () => void;
  /** Só no painel: linha abaixo do nome (ex.: "78% de Sintonia"). */
  subtitle?:       string;
  /** Faixa no topo da conversa (ex.: interesses em comum). */
  banner?:         string;
  /** Respostas rápidas (preenchem o campo). */
  suggestions?:    string[];
}

const fns = getFunctions();



function TypingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    function animate() {
      Animated.sequence([
        Animated.timing(dot1, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot1, { toValue: 0.3, duration: 300, useNativeDriver: true }),
      ]).start();
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(dot2, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot2, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ]).start();
      }, 200);
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(dot3, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot3, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ]).start();
      }, 400);
    }
    const interval = setInterval(animate, 900);
    animate();
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View key={i} style={{
          width: 5, height: 5, borderRadius: 3,
          backgroundColor: colors.gold, opacity: dot,
        }} />
      ))}
    </View>
  );
}

export default function ChatConversation({
  targetUserId, targetUserName, targetUserPhoto, variant, onBlocked,
  onOpenProfile, subtitle, banner, suggestions,
}: ChatConversationProps) {
  const { user }     = useAuth();
  const insets = useSafeAreaInsets();
  const isPane = variant === 'pane';
  const isWeb  = Platform.OS === 'web';
  const inputRef = useRef<TextInput>(null);

  const {
    messages, inputText, setInputText,
    loading, flatListRef, sendUserMessage, sendAudioMessage,
  } = useUserChat(targetUserId);

  const { blocked, block } = useBlock(
    targetUserId, targetUserName, targetUserPhoto,
    onBlocked,
  );

  const recordingRef     = useRef<Audio.Recording | null>(null);
  const soundRef         = useRef<Audio.Sound | null>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isRecording,     setIsRecording]     = useState(false);
  const [recordingSeconds,setRecordingSeconds] = useState(0);
  const [uploadingAudio,  setUploadingAudio]   = useState(false);
  const [playingId,       setPlayingId]        = useState<string | null>(null);
  const [otherIsTyping,   setOtherIsTyping]    = useState(false);
  const [showReactions,   setShowReactions]    = useState<string | null>(null);
  const isNearBottomRef  = useRef(true);

  useEffect(() => {
    if (!user?.uid || !targetUserId) return;
    const chatId = generateChatId(user.uid, targetUserId);
    const unsub  = listenToTyping(chatId, targetUserId, setOtherIsTyping);
    return unsub;
  }, [targetUserId]);

  useEffect(() => {
    if (!user?.uid || !targetUserId) return;
    const chatId = generateChatId(user.uid, targetUserId);
    markAsDelivered(chatId, user.uid);
    markAsRead(chatId, user.uid);
  }, [messages]);

  useEffect(() => {
    return () => {
      if (timerRef.current)         clearInterval(timerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (soundRef.current)         soundRef.current.unloadAsync();
      if (recordingRef.current)     recordingRef.current.stopAndUnloadAsync();
      if (user?.uid) {
        const chatId = generateChatId(user.uid, targetUserId);
        setTyping(chatId, user.uid, false);
      }
    };
  }, []);

  function handleInputChange(text: string) {
    setInputText(text);
    if (!user?.uid) return;
    const chatId = generateChatId(user.uid, targetUserId);
    setTyping(chatId, user.uid, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(chatId, user.uid, false);
    }, 3000);
  }

  // v5.2 — envia mensagem + registra missão send_message
  async function handleSend() {
    if (!inputText.trim()) return;
    await sendUserMessage();
    // Missões de mensagem: registradas pelo gatilho
    // onChatMessageCreated, a partir da mensagem gravada.
    // A conquista START_CONVO vem do earnXP, no servidor.
  }

  async function handleStartRecording() {
    const ok = await setupAudio();
    if (!ok) {
      Alert.alert('Permissao necessaria', 'Ative o microfone nas configuracoes.');
      return;
    }
    const recording = await startRecording();
    if (!recording) return;

    recordingRef.current = recording;
    setIsRecording(true);
    setRecordingSeconds(0);

    timerRef.current = setInterval(() => {
      setRecordingSeconds(prev => Math.min(prev + 1, MAX_DURATION));
    }, 1000);

    setTimeout(() => {
      if (recordingRef.current) handleStopRecording();
    }, MAX_DURATION);
  }

  async function handleStopRecording() {
    if (!recordingRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setIsRecording(false);
    setUploadingAudio(true);

    const uri = await stopRecording(recordingRef.current);
    recordingRef.current = null;

    if (!uri) { setUploadingAudio(false); return; }
    if (recordingSeconds < 1) { setUploadingAudio(false); setRecordingSeconds(0); return; }

    const audioUrl = await uploadAudio(uri);
    setUploadingAudio(false);
    setRecordingSeconds(0);

    if (audioUrl) {
      await sendAudioMessage(audioUrl, recordingSeconds);
    } else {
      Alert.alert('Erro', 'Nao foi possivel enviar o audio.');
    }
  }

  async function handlePlayAudio(item: ChatMessage) {
    if (!item.audioUrl) return;
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    if (playingId === item.id) { setPlayingId(null); return; }
    setPlayingId(item.id);
    const sound = await playAudio(item.audioUrl, () => setPlayingId(null));
    if (sound) soundRef.current = sound;
  }

  function handleReaction(item: ChatMessage, emoji: string) {
    if (!user?.uid) return;
    const chatId = generateChatId(user.uid, targetUserId);
    addReaction(chatId, item.id, user.uid, emoji);
    setShowReactions(null);
  }

  /** Resposta rápida: preenche o campo para a pessoa revisar. */
  function applySuggestion(text: string) {
    handleInputChange(text);
    inputRef.current?.focus();
  }

  /** Web: Enter envia, Shift+Enter quebra a linha. */
  function handleKeyPress(e: { nativeEvent: { key: string; shiftKey?: boolean }; preventDefault?: () => void }) {
    if (!isWeb) return;
    if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      e.preventDefault?.();
      handleSend();
    }
  }

  const showSuggestions = !!suggestions?.length
    && !loading
    && messages.length < SUGGESTIONS_MAX_MESSAGES
    && !inputText.trim()
    && !isRecording && !uploadingAudio;

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isMe        = item.senderId === user?.uid;
    const isPlaying   = playingId === item.id;
    const myReaction  = item.reactions?.[user?.uid || ''];
    const hasReactions= item.reactions && Object.keys(item.reactions).length > 0;

    return (
      <View style={[styles.messageRow, isMe ? styles.rowMe : styles.rowOther]}>
        {!isMe && targetUserPhoto ? (
          <Image source={{ uri: targetUserPhoto }} style={styles.avatar} />
        ) : null}

        <View style={[styles.bubbleWrapper, isPane && styles.bubbleWrapperPane]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
            {isMe && (
              <TouchableOpacity
                onPress={() => setShowReactions(showReactions === item.id ? null : item.id)}
                style={styles.reactionTrigger}
              >
                <Text style={styles.reactionTriggerText}>{myReaction || '☺'}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onLongPress={() => setShowReactions(showReactions === item.id ? null : item.id)}
              activeOpacity={0.9}
              style={{ flexShrink: 1 }}
            >
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                {item.audioUrl ? (
                  <TouchableOpacity style={styles.audioPlayer} onPress={() => handlePlayAudio(item)}>
                    <Text style={[styles.audioPlayIcon, isMe ? styles.audioPlayIconMe : styles.audioPlayIconOther]}>
                      {isPlaying ? '⏸' : '▶'}
                    </Text>
                    <View style={styles.audioWave}>
                      {[...Array(12)].map((_, i) => (
                        <View key={i} style={[
                          styles.audioBar,
                          isMe ? styles.audioBarMe : styles.audioBarOther,
                          { height: Math.random() * 16 + 4 },
                          isPlaying && styles.audioBarPlaying,
                        ]} />
                      ))}
                    </View>
                    <Text style={[styles.audioDuration, isMe ? styles.textMe : styles.textOther]}>
                      {formatDuration(item.audioDuration || 0)}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.messageText, isMe ? styles.textMe : styles.textOther]}>
                    {item.text}
                  </Text>
                )}
                <Text style={[styles.messageTime, isMe ? styles.timeMe : styles.timeOther]}>
                  {formatTime(item.timestamp)}
                </Text>
              </View>
            </TouchableOpacity>

            {!isMe && (
              <TouchableOpacity
                onPress={() => setShowReactions(showReactions === item.id ? null : item.id)}
                style={styles.reactionTrigger}
              >
                <Text style={styles.reactionTriggerText}>{myReaction || '☺'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {showReactions === item.id && (
            <View style={[styles.reactionPicker, isMe ? styles.reactionPickerMe : styles.reactionPickerOther]}>
              {['❤️', '😍', '😂', '😮', '👏', '🔥'].map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => handleReaction(item, emoji)}
                  style={[styles.reactionOption, myReaction === emoji && styles.reactionOptionActive]}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {hasReactions && (
            <View style={[styles.reactionsRow, isMe ? styles.reactionsRowMe : styles.reactionsRowOther]}>
              {Object.values(item.reactions!).map((emoji, i) => (
                <View key={i} style={styles.reactionBadge}>
                  <Text style={styles.reactionBadgeText}>{emoji}</Text>
                </View>
              ))}
            </View>
          )}

          {isMe && (
            <View style={styles.statusRow}>
              {item.read ? (
                <Text style={styles.statusRead}>✦✦</Text>
              ) : item.delivered ? (
                <Text style={styles.statusDelivered}>✦✦</Text>
              ) : (
                <Text style={styles.statusSent}>✦</Text>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }

  if (blocked) {
    return (
      <View style={styles.container}>
        {!isPane && <Header title={targetUserName} showBack={true} showHome={true} />}
        <View style={styles.blockedContainer}>
          <Text style={styles.blockedIcon}>🚫</Text>
          <Text style={styles.blockedText}>Usuario bloqueado</Text>
          <TouchableOpacity style={styles.backButton} onPress={onBlocked}>
            <Text style={styles.backButtonText}>{isPane ? 'Fechar conversa' : 'Voltar'}</Text>
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
      {isPane ? (
        <View style={styles.paneHeader}>
          {targetUserPhoto ? (
            <Image source={{ uri: targetUserPhoto }} style={styles.paneAvatar} />
          ) : (
            <View style={[styles.paneAvatar, styles.paneAvatarEmpty]}>
              <Text style={styles.paneAvatarLetter}>{(targetUserName || '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.paneTitleBox}>
            <Text style={styles.paneTitle} numberOfLines={1}>{targetUserName}</Text>
            {subtitle ? <Text style={styles.paneSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          {onOpenProfile && (
            <TouchableOpacity
              style={styles.paneProfileBtn}
              onPress={onOpenProfile}
              accessibilityRole="button"
              accessibilityLabel={`Ver o perfil de ${targetUserName}`}
            >
              <Text style={styles.paneProfileText}>Ver perfil</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.paneBlockBtn}
            onPress={block}
            accessibilityRole="button"
            accessibilityLabel={`Bloquear ${targetUserName}`}
          >
            <Text style={styles.blockIcon}>🚫</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Header
          title={targetUserName}
          showBack={true}
          showHome={true}
          rightElement={
            <TouchableOpacity onPress={block} accessibilityRole="button" accessibilityLabel={`Bloquear ${targetUserName}`}>
              <Text style={styles.blockIcon}>🚫</Text>
            </TouchableOpacity>
          }
        />
      )}

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
          onScroll={e => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
            isNearBottomRef.current = distanceFromBottom < 100;
          }}
          scrollEventThrottle={100}
          onContentSizeChange={() => {
            if (isNearBottomRef.current) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          ListHeaderComponent={banner ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{banner}</Text>
            </View>
          ) : null}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>Inicio da conversa com {targetUserName}</Text>
              <Text style={styles.emptySubtitle}>Diga ola!</Text>
            </View>
          }
        />
      )}

      {otherIsTyping && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>{targetUserName} esta digitando</Text>
          <TypingDots />
        </View>
      )}

      {showSuggestions && (
        <View style={styles.suggestions} accessibilityLabel="Sugestões de mensagem">
          {suggestions!.map(text => (
            <TouchableOpacity
              key={text}
              style={styles.suggestion}
              onPress={() => applySuggestion(text)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Usar sugestão: ${text}`}
            >
              <Text style={styles.suggestionText} numberOfLines={2}>{text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        {isRecording ? (
          <View style={styles.recordingContainer}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Gravando... {formatDuration(recordingSeconds)}</Text>
            <Text style={styles.recordingMax}>max 30s</Text>
          </View>
        ) : uploadingAudio ? (
          <View style={styles.recordingContainer}>
            <ActivityIndicator color={colors.gold} size="small" />
            <Text style={styles.recordingText}>Enviando audio...</Text>
          </View>
        ) : (
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={`Mensagem para ${targetUserName}...`}
            placeholderTextColor={colors.gray}
            value={inputText}
            onChangeText={handleInputChange}
            onKeyPress={handleKeyPress as never}
            multiline
            maxLength={500}
            accessibilityLabel={`Mensagem para ${targetUserName}`}
            nativeID="chat-message-input"
          />
        )}

        {!inputText.trim() && !isWeb && (
          <TouchableOpacity
            style={[styles.audioButton, isRecording && styles.audioButtonRecording]}
            onPress={isRecording ? handleStopRecording : handleStartRecording}
            disabled={uploadingAudio}
          >
            <Text style={styles.audioButtonIcon}>{isRecording ? '⏹' : '🎤'}</Text>
          </TouchableOpacity>
        )}

        {/* v5.2 — usa handleSend para registrar missão */}
        {(!!inputText.trim() || isWeb) && (
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonOff]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensagem"
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: colors.background },
  blockIcon:         { fontSize: 20 },
  loadingContainer:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedContainer:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  blockedIcon:       { fontSize: 60 },
  blockedText:       { color: colors.gray, fontSize: fonts.sizes.lg },
  backButton:        { backgroundColor: colors.surface, borderRadius: borderRadius.sm, padding: spacing.md, paddingHorizontal: spacing.xl, borderWidth: 1, borderColor: colors.grayDark },
  backButtonText:    { color: colors.white, fontWeight: 'bold' },
  messagesList:      { padding: spacing.md, paddingBottom: spacing.xl, flexGrow: 1 },
  messageRow:        { flexDirection: 'row', marginBottom: spacing.sm, alignItems: 'flex-end', gap: spacing.xs, paddingHorizontal: spacing.sm },
  rowMe:             { justifyContent: 'flex-end', flexDirection: 'row' },
  rowOther:          { justifyContent: 'flex-start', flexDirection: 'row' },
  avatar:            { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.gold },
  bubbleWrapper:     { maxWidth: '75%', flexShrink: 1 },
  bubble:            { borderRadius: borderRadius.md, padding: spacing.md },
  bubbleMe:          { backgroundColor: colors.gold, borderBottomRightRadius: 4 },
  bubbleOther:       { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.grayDark },
  messageText:       { fontSize: fonts.sizes.md, lineHeight: 22 },
  textMe:            { color: colors.background, fontWeight: '500' },
  textOther:         { color: colors.white },
  messageTime:       { fontSize: fonts.sizes.xs, marginTop: 4 },
  timeMe:            { color: colors.background + 'AA', textAlign: 'right' },
  timeOther:         { color: colors.gray },
  statusRow:         { marginTop: 3, alignItems: 'flex-end' },
  statusSent:        { color: colors.gray, fontSize: 16, lineHeight: 18 },
  statusDelivered:   { color: colors.white, fontSize: 16, lineHeight: 18 },
  statusRead:        { color: colors.gold, fontSize: 16, lineHeight: 18 },
  typingContainer:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, gap: spacing.sm },
  typingText:        { color: colors.gray, fontSize: fonts.sizes.xs, fontStyle: 'italic' },
  reactionPicker:    { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.sm, gap: spacing.xs, borderWidth: 1, borderColor: colors.gold + '44', marginTop: spacing.xs },
  reactionPickerMe:  { alignSelf: 'flex-end' },
  reactionPickerOther: { alignSelf: 'flex-start' },
  reactionOption:    { padding: 4, borderRadius: 8 },
  reactionOptionActive: { backgroundColor: colors.gold + '33' },
  reactionEmoji:     { fontSize: 20 },
  reactionsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  reactionsRowMe:    { justifyContent: 'flex-end' },
  reactionsRowOther: { justifyContent: 'flex-start' },
  reactionBadge:     { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: colors.gold + '44' },
  reactionBadgeText: { fontSize: 14 },
  inputContainer:    { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.grayDark, gap: spacing.sm },
  input:             { flex: 1, backgroundColor: colors.background, color: colors.white, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fonts.sizes.md, borderWidth: 1, borderColor: colors.grayDark, maxHeight: 100 },
  sendButton:        { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  sendIcon:          { color: colors.background, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  audioButton:       { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.gold },
  audioButtonRecording: { backgroundColor: colors.error, borderColor: colors.error },
  audioButtonIcon:   { fontSize: 20 },
  recordingContainer:{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm },
  recordingDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
  recordingText:     { color: colors.white, fontSize: fonts.sizes.md, flex: 1 },
  recordingMax:      { color: colors.gray, fontSize: fonts.sizes.xs },
  audioPlayer:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 150 },
  audioPlayIcon:     { fontSize: 18 },
  audioPlayIconMe:   { color: colors.background },
  audioPlayIconOther:{ color: colors.gold },
  audioWave:         { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 24 },
  audioBar:          { width: 3, borderRadius: 2, opacity: 0.7 },
  audioBarMe:        { backgroundColor: colors.background },
  audioBarOther:     { backgroundColor: colors.gold },
  audioBarPlaying:   { opacity: 1 },
  audioDuration:     { fontSize: fonts.sizes.xs },
  emptyContainer:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.sm },
  emptyIcon:         { fontSize: 60 },
  emptyTitle:        { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', textAlign: 'center' },
  emptySubtitle:     { color: colors.gray, fontSize: fonts.sizes.md },
  reactionTrigger:   { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.grayDark, marginBottom: 4 },
  reactionTriggerText: { fontSize: 14 },

  // ── Web D6 ──
  bubbleWrapperPane: { maxWidth: '65%' },
  sendButtonOff:     { opacity: 0.4 },
  paneHeader:        { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#262626', backgroundColor: colors.surface },
  paneAvatar:        { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.gold },
  paneAvatarEmpty:   { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  paneAvatarLetter:  { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.lg },
  paneTitleBox:      { flex: 1, minWidth: 0, gap: 2 },
  paneTitle:         { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  paneSubtitle:      { color: colors.gold, fontSize: fonts.sizes.sm },
  paneProfileBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gold + '88' },
  paneProfileText:   { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  paneBlockBtn:      { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.grayDark },
  banner:            { alignSelf: 'center', maxWidth: '90%', marginBottom: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: borderRadius.full, backgroundColor: colors.gold + '18', borderWidth: 1, borderColor: colors.gold + '55' },
  bannerText:        { color: colors.gold, fontSize: fonts.sizes.sm, textAlign: 'center' },
  suggestions:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.grayDark },
  suggestion:        { maxWidth: '100%', paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gold + '66', backgroundColor: colors.gold + '11' },
  suggestionText:    { color: colors.gold, fontSize: fonts.sizes.sm },
});
