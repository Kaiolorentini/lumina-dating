import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing } from '../theme';
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
  const navigation = useNavigation<NavProp>();

  const canGoBack = navigation.canGoBack();

  return (
    <View style={styles.container}>
      {/* Lado esquerdo — Voltar */}
      <View style={styles.left}>
        {showBack && canGoBack && (
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>‹</Text>
            <Text style={styles.backText}>Voltar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Centro — Título */}
      <View style={styles.center}>
        {title ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          <Text style={styles.logo}>✦ Lumina</Text>
        )}
      </View>

      {/* Lado direito — Home ou elemento customizado */}
      <View style={styles.right}>
        {rightElement ? rightElement : showHome && canGoBack && (
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
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 50 : spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayDark,
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
    padding: spacing.xs,
  },
  backIcon: {
    color: colors.gold,
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 30,
  },
  backText: {
    color: colors.gold,
    fontSize: fonts.sizes.sm,
    fontWeight: 'bold',
  },
  homeIcon: {
    color: colors.gold,
    fontSize: 22,
  },
  logo: {
    color: colors.gold,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  title: {
    color: colors.white,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});