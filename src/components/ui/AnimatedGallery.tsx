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
  PanResponder,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, alpha } from '../../theme/tokens';

const { width } = Dimensions.get('window');

interface GalleryImage {
  id: string;
  uri: string;
  caption?: string;
}

interface GalleryProps {
  images: GalleryImage[];
}

function GalleryImageItem({ image, index }: { image: GalleryImage; index: number }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const currentTranslateX = useRef(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
    },
    onPanResponderGrant: () => {
      translateX.setOffset(currentTranslateX.current);
    },
    onPanResponderMove: (_, gestureState) => {
      const next = isZoomed ? gestureState.dx / 3 : gestureState.dx;
      currentTranslateX.current = next;
      translateX.setValue(next);
      scale.setValue(isZoomed ? 1.2 - Math.abs(gestureState.dx) / 600 : 1);
      opacity.setValue(isZoomed ? 1 - Math.abs(gestureState.dx) / 300 : 1);
    },
    onPanResponderRelease: (_, gestureState) => {
      translateX.flattenOffset();
      currentTranslateX.current = 0;
      if (Math.abs(gestureState.dx) > width * 0.3) {
        Animated.timing(translateX, {
          toValue: gestureState.dx > 0 ? width : -width,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          translateX.setValue(gestureState.dx > 0 ? width : -width);
        });
      } else {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 15,
          stiffness: 100,
        }).start();
      }
    },
  });

  return (
    <Animated.View
      style={[styles.imageContainer, { transform: [{ translateX }, { scale }], opacity }]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        onPress={() => setIsZoomed(!isZoomed)}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: image.uri }}
          style={styles.image}
          resizeMode={isZoomed ? 'contain' : 'cover'}
        />
      </TouchableOpacity>
      {image.caption && (
        <BlurView
          style={styles.captionContainer}
          intensity={80}
          tint="dark"
        >
          <Text style={styles.caption}>{image.caption}</Text>
        </BlurView>
      )}
      <TouchableOpacity
        style={styles.zoomButton}
        onPress={() => setIsZoomed(!isZoomed)}
      >
        <Text style={styles.zoomIcon}>{isZoomed ? '⤫' : '⤢'}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function AnimatedGallery({ images }: GalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <GalleryImageItem image={item} index={index} />
        )}
      />

      <View style={styles.pagination}>
        {images.map((_, index) => (
          <View
            key={index}
            style={[styles.paginationDot, index === currentIndex && styles.activeDot]}
          />
        ))}
      </View>

      <TouchableOpacity
        style={styles.navButton}
        onPress={() => {
          if (currentIndex < images.length - 1) {
            setCurrentIndex(currentIndex + 1);
          }
        }}
      >
        <Text style={styles.navIcon}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navButton, styles.navButtonRight]}
        onPress={() => {
          if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
          }
        }}
      >
        <Text style={styles.navIcon}>‹</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  imageContainer: {
    width,
    height: width * 0.75,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: BORDER_RADIUS.md,
  },
  captionContainer: {
    position: 'absolute',
    bottom: 60,
    left: SPACING.md,
    right: SPACING.md,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  caption: {
    color: COLORS.surface,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
  },
  zoomButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    backgroundColor: alpha(COLORS.surface, 0.2),
    padding: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  zoomIcon: {
    color: COLORS.surface,
    fontSize: FONT_SIZE.sm,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: alpha(COLORS.surface, 0.3),
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: COLORS.primary,
    width: 20,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    left: SPACING.md,
    backgroundColor: alpha(COLORS.surface, 0.1),
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    transform: [{ translateY: -15 }],
  },
  navButtonRight: {
    left: 'auto',
    right: SPACING.md,
  },
  navIcon: {
    color: COLORS.surface,
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
  },
});