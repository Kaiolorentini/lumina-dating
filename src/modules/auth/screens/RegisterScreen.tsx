// ============================================
// LUMINA — CRIAR CONTA
// src/modules/auth/screens/RegisterScreen.tsx
//
// - Senha e confirmação com "mostrar senha", cada uma independente.
// - "new-password": o sistema pode sugerir e salvar uma senha forte.
// - Teclado: e-mail → senha → confirmação → criar conta.
// ============================================

import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { RootStackParamList } from '../../../navigation/types';
import { useRegisterForm } from '../hooks/useAuthForm';
import ScreenContainer from '../../../components/ScreenContainer';
import PasswordInput from '../../../components/PasswordInput';

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

  const passwordRef = useRef<TextInput>(null);
  const confirmRef  = useRef<TextInput>(null);

  function handleSubmit() {
    if (loading) return;
    submit();
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>✦</Text>
            <Text style={styles.title}>Lumina</Text>
            <Text style={styles.phrase}>"Descubra conexões únicas"</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.formTitle}>Criar conta</Text>

            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor={colors.gray}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />

            <Text style={styles.label}>Senha</Text>
            <PasswordInput
              ref={passwordRef}
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChangeText={setPassword}
              autoComplete="new-password"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              blurOnSubmit={false}
            />

            <Text style={styles.label}>Confirmar senha</Text>
            <PasswordInput
              ref={confirmRef}
              placeholder="Repita sua senha"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoComplete="new-password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.buttonText}>Criar conta</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('Login')}
              accessibilityRole="button"
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
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 48,
    color: colors.gold,
  },
  title: {
    fontSize: fonts.sizes.xxxl,
    color: colors.white,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  phrase: {
    color: colors.gold,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  form: {
    width: '100%',
  },
  formTitle: {
    color: colors.white,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
    marginBottom: spacing.lg,
    letterSpacing: 1,
  },
  label: {
    color: colors.grayLight,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.xs,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.white,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontSize: fonts.sizes.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  error: {
    color: colors.error,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: colors.background,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  linkButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  linkText: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
  },
  linkTextBold: {
    color: colors.gold,
    fontWeight: 'bold',
  },
});