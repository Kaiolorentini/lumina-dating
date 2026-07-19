import React, { useState } from 'react';
import {
  Image, ImageProps, StyleSheet, View, ActivityIndicator, Text,
} from 'react-native';
import { COLORS } from '../../theme/tokens';

interface ImageWithFallbackProps extends Omit<ImageProps, 'source'> {
  source: { uri?: string } | number | null | undefined;
  fallbackIcon?: string;
  placeholderColor?: string;
}

/**
 * Imagem com carregamento lazy (fadeIn), placeholder de loading
 * e fallback elegante quando a URL falha ou é inválida.
 */
export function ImageWithFallback({
  source,
  fallbackIcon = '🌙',
  placeholderColor,
  style,
  ...rest
}: ImageWithFallbackProps) {
  const uri = typeof source === 'object' && source !== null ? (source as any).uri : undefined;
  const isValid = typeof source === 'number' || (typeof uri === 'string' && uri.trim().length > 0);

  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(isValid ? 'loading' : 'error');
  const [opacity, setOpacity] = useState(0);

  if (!isValid) {
    return (
      <View style={[styles.placeholder, { backgroundColor: placeholderColor ?? 'rgba(255,255,255,0.06)' }, style]}>
        <View style={styles.fallbackIconBox}>
          <ActivityIndicator color={COLORS.textMuted} size="small" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, style]}>
      {status !== 'loaded' && (
        <View style={[StyleSheet.absoluteFill, styles.placeholder, { backgroundColor: placeholderColor ?? 'rgba(255,255,255,0.06)' }]}>
          {status === 'error' ? (
            <Text style={styles.fallbackIcon}>{fallbackIcon}</Text>
          ) : (
            <ActivityIndicator color={COLORS.textMuted} size="small" />
          )}
        </View>
      )}
      <Image
        source={source as any}
        style={[StyleSheet.absoluteFill, { opacity }]}
        onLoad={() => {
          setStatus('loaded');
          setOpacity(1);
        }}
        onError={() => setStatus('error')}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackIconBox: {
    opacity: 0.6,
  },
  fallbackIcon: {
    fontSize: 28,
    opacity: 0.5,
  },
});
