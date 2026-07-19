import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Input } from '../../../components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';
import { RootStackParamList } from '../../../navigation/types';
import { useRegisterForm } from '../hooks/useAuthForm';
import ScreenContainer from '../../../components/ScreenContainer';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

export default function RegisterScreen({ navigation }: Props) {
  const {
    email, setEmail,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    loading, error,
    submit,
  } = useRegisterForm();

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>✦</Text>
            <Text style={styles.title}>Lumina</Text>
            <Text style={styles.phrase}>"Descubra conexões únicas"</Text>
          </View>

          {/* Formulário */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>Criar conta</Text>

            <Input
              label="E-mail"
              placeholder="seu@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={error}
            />

            <Input
              label="Senha"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Input
              label="Confirmar senha"
              placeholder="Repita sua senha"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            <Button
              label="Criar conta"
              onPress={submit}
              loading={loading}
              disabled={loading}
              variant="primary"
              fullWidth
            />

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.linkText}>
                Já tem conta?{' '}
                <Text style={styles.linkTextBold}>Entrar</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logo: {
    fontSize: 48,
    color: COLORS.gold,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 4,
  },
  phrase: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.body,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: SPACING.sm,
  },
  form: {
    width: '100%',
    gap: SPACING.md,
  },
  formTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 1,
  },
  linkButton: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  linkText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.body,
  },
  linkTextBold: {
    color: COLORS.gold,
    fontWeight: FONT_WEIGHT.bold,
  },
});