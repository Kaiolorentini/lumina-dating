import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  Image,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, alpha } from '../../theme/tokens';
import { useTextPress } from '../../hooks';

const { width } = Dimensions.get('window');

interface ChatMessage {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: Date;
  read?: boolean;
}

interface MessageBubbleProps {
  message: ChatMessage;
  onSwipeDelete?: (id: string) => void;
}

function MessageBubble({ message, onSwipeDelete }: MessageBubbleProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [showDelete, setShowDelete] = useState(false);

  const handleSwipe = (toValue: number) => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.5,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const resetPosition = () => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 100,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePanResponderGrant = () => {
    setShowDelete(true);
  };

  const handlePanResponderRelease = (vx: number) => {
    setShowDelete(false);
    if (vx > 100) {
      handleSwipe(width * 0.8);
      setTimeout(() => onSwipeDelete?.(message.id), 300);
    } else {
      resetPosition();
    }
  };

  return (
    <Animated.View
      style={[styles.messageBubble, { transform: [{ translateX }], opacity }]}
    >
      {showDelete && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onSwipeDelete?.(message.id)}
        >
          <Text style={styles.deleteIcon}>🗑</Text>
        </TouchableOpacity>
      )}
      <View
        style={[
          styles.bubble,
          message.sender === 'me' ? styles.meBubble : styles.themBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            message.sender === 'me' ? styles.meText : styles.themText,
          ]}
        >
          {message.text}
        </Text>
      </View>
      {message.sender === 'me' && (
        <View style={styles.readStatus}>
          {message.read ? (
            <Text style={styles.readIcon}>✓✓</Text>
          ) : (
            <Text style={styles.readIcon}>✓</Text>
          )}
        </View>
      )}
      <View style={styles.typingIndicator}>
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dot2]} />
        <View style={[styles.dot, styles.dot3]} />
      </View>
    </Animated.View>
  );
}

export function AnimatedChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: 'Olá! Como você está?',
      sender: 'them',
      timestamp: new Date(Date.now() - 60000),
      read: true,
    },
    {
      id: '2',
      text: 'Estou bem, e você?',
      sender: 'me',
      timestamp: new Date(),
      read: false,
    },
  ]);

  const addMessage = (text: string, sender: 'me' | 'them') => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      sender,
      timestamp: new Date(),
      read: sender === 'me',
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSwipeDelete = (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  return (
    <View style={styles.container}>
      <View style={styles.chatContainer}>
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              onSwipeDelete={handleSwipeDelete}
            />
          )}
          contentContainerStyle={styles.messagesList}
        />
      </View>

      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.sendButton}
          onPress={() => addMessage('Nova mensagem', 'me')}
        >
          <Text style={styles.sendText}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  chatContainer: {
    flex: 1,
    padding: SPACING.md,
  },
  messagesList: {
    gap: SPACING.sm,
  },
  messageBubble: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
    marginBottom: SPACING.sm,
  },
  bubble: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    maxWidth: width * 0.7,
  },
  meBubble: {
    backgroundColor: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  themBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: SPACING.sm,
  },
  messageText: {
    fontSize: FONT_SIZE.body,
  },
  meText: {
    color: COLORS.surface,
  },
  themText: {
    color: COLORS.textPrimary,
  },
  deleteButton: {
    backgroundColor: COLORS.error,
    padding: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.xs,
  },
  deleteIcon: {
    color: COLORS.surface,
    fontSize: FONT_SIZE.sm,
  },
  readStatus: {
    marginLeft: SPACING.xs,
    marginBottom: 2,
  },
  readIcon: {
    color: COLORS.secondary,
    fontSize: FONT_SIZE.caption,
  },
  typingIndicator: {
    flexDirection: 'row',
    marginTop: SPACING.xs,
    opacity: 0.7,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textSecondary,
    marginHorizontal: 2,
  },
  dot2: {
    height: 6,
  },
  dot3: {
    width: 6,
    height: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    color: COLORS.surface,
    fontWeight: FONT_WEIGHT.bold,
  },
});