import React, { useEffect, useRef, useState } from 'react';
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
  Alert,
  Animated,
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
import { markAsRead, generateChatId } from '../services/messageService';
import { Audio } from 'expo-av';
import {
  setupAudio,
  startRecording,
  stopRecording,
  uploadAudio,
  playAudio,
  MAX_DURATION,
} from '../services/audioService';
import { setTyping, listenToTyping, addReaction } from '../services/typingService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

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
    sendAudioMessage,
  } = useUserChat(targetUserId);

  const { blocked, block } = useBlock(
    targetUserId,
    targetUserName,
    targetUserPhoto,
    () => navigation.goBack()
  );

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [showReactions, setShowReactions] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid || !targetUserId) return;
    const chatId = generateChatId(user.uid, targetUserId);
    const unsub = listenToTyping(chatId, targetUserId, setOtherIsTyping);
    return unsub;
  }, [targetUserId]);

  useEffect(() => {
    if (!user?.uid || !targetUserId) return;
    const chatId = generateChatId(user.uid, targetUserId);
    markAsRead(chatId, user.uid);
  }, [messages]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (soundRef.current) soundRef.current.unloadAsync();
      if (recordingRef.current) recordingRef.current.stopAndUnloadAsync();
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
      setRecordingSeconds(prev => {
        if (prev >= 30) { handleStopRecording(); return 30; }
        return prev + 1;
      });
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

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isMe = item.senderId === user?.uid;
    const isPlaying = playingId === item.id;
    const myReaction = item.reactions?.[user?.uid || ''];
    const hasReactions = item.reactions && Object.keys(item.reactions).length > 0;

    return (
      <View style={[styles.messageRow, isMe ? styles.rowMe : styles.rowOther]}>
        {!isMe && targetUserPhoto ? (
          <Image source={{ uri: targetUserPhoto }} style={styles.avatar} />
        ) : null}

        <View style={styles.bubbleWrapper}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>

            {isMe && (
              <TouchableOpacity
                onPress={() => setShowReactions(showReactions === item.id ? null : item.id)}
                style={styles.reactionTrigger}
              >
                <Text style={styles.reactionTriggerText}>
                  {myReaction || '☺'}
                </Text>
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
                <Text style={styles.reactionTriggerText}>
                  {myReaction || '☺'}
                </Text>
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
        <Header title={targetUserName} showBack={true} showHome={true} />
        <View style={styles.blockedContainer}>
          <Text style={styles.blockedIcon}>🚫</Text>
          <Text style={styles.blockedText}>Usuario bloqueado</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
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
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
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

      <View style={styles.inputContainer}>
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
            style={styles.input}
            placeholder={`Mensagem para ${targetUserName}...`}
            placeholderTextColor={colors.gray}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            maxLength={500}
          />
        )}

        {!inputText.trim() && (
          <TouchableOpacity
            style={[styles.audioButton, isRecording && styles.audioButtonRecording]}
            onPress={isRecording ? handleStopRecording : handleStartRecording}
            disabled={uploadingAudio}
          >
            <Text style={styles.audioButtonIcon}>{isRecording ? '⏹' : '🎤'}</Text>
          </TouchableOpacity>
        )}

        {!!inputText.trim() && (
          <TouchableOpacity style={styles.sendButton} onPress={sendUserMessage}>
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  blockIcon: { fontSize: 20 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  blockedIcon: { fontSize: 60 },
  blockedText: { color: colors.gray, fontSize: fonts.sizes.lg },
  backButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  backButtonText: { color: colors.white, fontWeight: 'bold' },
  messagesList: { padding: spacing.md, paddingBottom: spacing.xl, flexGrow: 1 },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  rowMe: { justifyContent: 'flex-end', flexDirection: 'row' },
  rowOther: { justifyContent: 'flex-start', flexDirection: 'row' },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.gold },
  bubbleWrapper: {
    maxWidth: '75%',
    flexShrink: 1,
  },
  bubble: { borderRadius: borderRadius.md, padding: spacing.md },
  bubbleMe: { backgroundColor: colors.gold, borderBottomRightRadius: 4 },
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
  statusRow: { marginTop: 3, alignItems: 'flex-end' },
  statusSent: { color: colors.gray, fontSize: 16, lineHeight: 18 },
  statusDelivered: { color: colors.white, fontSize: 16, lineHeight: 18 },
  statusRead: { color: colors.gold, fontSize: 16, lineHeight: 18 },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  typingText: { color: colors.gray, fontSize: fonts.sizes.xs, fontStyle: 'italic' },
  reactionPicker: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.gold + '44',
    marginTop: spacing.xs,
  },
  reactionPickerMe: { alignSelf: 'flex-end' },
  reactionPickerOther: { alignSelf: 'flex-start' },
  reactionOption: { padding: 4, borderRadius: 8 },
  reactionOptionActive: { backgroundColor: colors.gold + '33' },
  reactionEmoji: { fontSize: 20 },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  reactionsRowMe: { justifyContent: 'flex-end' },
  reactionsRowOther: { justifyContent: 'flex-start' },
  reactionBadge: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.gold + '44',
  },
  reactionBadgeText: { fontSize: 14 },
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
  sendIcon: { color: colors.background, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  audioButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  audioButtonRecording: { backgroundColor: colors.error, borderColor: colors.error },
  audioButtonIcon: { fontSize: 20 },
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
  recordingText: { color: colors.white, fontSize: fonts.sizes.md, flex: 1 },
  recordingMax: { color: colors.gray, fontSize: fonts.sizes.xs },
  audioPlayer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 150 },
  audioPlayIcon: { fontSize: 18 },
  audioPlayIconMe: { color: colors.background },
  audioPlayIconOther: { color: colors.gold },
  audioWave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 24 },
  audioBar: { width: 3, borderRadius: 2, opacity: 0.7 },
  audioBarMe: { backgroundColor: colors.background },
  audioBarOther: { backgroundColor: colors.gold },
  audioBarPlaying: { opacity: 1 },
  audioDuration: { fontSize: fonts.sizes.xs },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.sm },
  emptyIcon: { fontSize: 60 },
  emptyTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', textAlign: 'center' },
  emptySubtitle: { color: colors.gray, fontSize: fonts.sizes.md },
  reactionTrigger: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.grayDark,
    marginBottom: 4,
  },
  reactionTriggerText: { fontSize: 14 },
});