import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../theme/tokens';
import { RootStackParamList } from '../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  title?: string;
  showBack?: boolean;
  showHome?: boolean;
  rightElement?: React.ReactNode;
}

export default function Header({
  title,
  showBack = true,
  showHome = true,
  rightElement,
}: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const canGoBack = navigation.canGoBack();

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
      <View style={styles.left}>
        {showBack && (
          <TouchableOpacity
            style={styles.button}
            onPress={() => { if (canGoBack) navigation.goBack(); }}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>‹</Text>
            <Text style={styles.backText}>Voltar</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.center}>
        {title ? (
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        ) : (
          <Text style={styles.logo}>✦ Lumina</Text>
        )}
      </View>

      <View style={styles.right}>
        {rightElement ? rightElement : showHome && !canGoBack && (
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('MainTabs')}
            activeOpacity={0.7}
          >
            <Text style={styles.homeIcon}>⌂</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  left: {
    width: 80,
    alignItems: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  right: {
    width: 80,
    alignItems: 'flex-end',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: SPACING.xs,
  },
  backIcon: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.hero,
    fontWeight: 'bold',
    lineHeight: 30,
  },
  backText: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
  homeIcon: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.xxl,
  },
  logo: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 2,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 1,
  },
});
