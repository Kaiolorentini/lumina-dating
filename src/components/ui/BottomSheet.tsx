import React, { useRef, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet,
  Animated, Dimensions, PanResponder,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS, colors, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, GLASS, SHADOWS, alpha } from '../../theme/tokens';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.85;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    } else {
      translateY.setValue(SCREEN_HEIGHT);
    }
  }, [visible, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 10,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          translateY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100 || gs.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true,
          }).start(() => onClose());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 20,
            stiffness: 200,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <BlurView intensity={GLASS.blur.medium} tint="dark" style={styles.backdrop}>
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY }] },
          ]}
        >
          <View {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>
          {title && <Text style={styles.title}>{title}</Text>}
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </BlurView>
    </Modal>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    paddingTop: S.md,
    paddingHorizontal: S.lg,
    paddingBottom: S.xl + 16,
    maxHeight: SHEET_MAX_HEIGHT,
    borderWidth: 1,
    borderColor: alpha(COLORS.border, 0.5),
    borderBottomWidth: 0,
    ...SHADOWS.level5,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: alpha(COLORS.textMuted, 0.3),
    alignSelf: 'center',
    marginBottom: S.md,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center',
    marginBottom: S.md,
  },
  content: {
    gap: S.md,
  },
});
