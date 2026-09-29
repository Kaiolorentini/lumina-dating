// ============================================
// LUMINA — LOGIN
// src/modules/auth/screens/LoginScreen.tsx
//
// - Senha com "mostrar senha" (PasswordInput).
// - "Esqueci minha senha": link de redefinição pelo Firebase
//   (ForgotPasswordModal), sem revelar se o e-mail tem conta.
// - Campos identificados para o preenchimento automático do sistema.
// - Teclado: "Próximo" leva à senha; "Entrar" envia.
// - Só o e-mail é lembrado no aparelho — nunca a senha.
// ============================================

import React, { useEffect, useRef, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { RootStackParamList } from '../../../navigation/types';
import { useLoginForm } from '../hooks/useAuthForm';
import ScreenContainer from '../../../components/ScreenContainer';
import PasswordInput from '../../../components/PasswordInput';
import ForgotPasswordModal from '../components/ForgotPasswordModal';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

const LAST_EMAIL_KEY = '@lumina:lastEmail';

const PHRASE = 'Existem perfis com alta Sintonia esperando por você';

export default function LoginScreen({ navigation }: Props) {
  const {
    email, setEmail,
    password, setPassword,
    loading, error,
    submit,
  } = useLoginForm();

  const passwordRef = useRef<TextInput>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  // Preenche o último e-mail usado. Falha no armazenamento local não
  // pode derrubar a tela — o campo só fica vazio.
  useEffect(() => {
    AsyncStorage.getItem(LAST_EMAIL_KEY)
      .then(saved => { if (saved) setEmail(saved); })
      .catch(() => {});
  }, []);

  function handleSubmit() {
    if (loading) return;
    const trimmed = email.trim();
    if (trimmed) AsyncStorage.setItem(LAST_EMAIL_KEY, trimmed).catch(() => {});
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
            <Text style={styles.subtitle}>a sua nova conexão favorita</Text>
          </View>

          <View style={styles.phraseContainer}>
            <Text style={styles.phrase}>"{PHRASE}"</Text>
          </View>

          <View style={styles.form}>
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
              placeholder="Sua senha"
              value={password}
              onChangeText={setPassword}
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />

            <TouchableOpacity
              style={styles.forgotButton}
              onPress={() => setForgotOpen(true)}
              accessibilityRole="button"
            >
              <Text style={styles.forgotText}>Esqueci minha senha</Text>
            </TouchableOpacity>

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
                <Text style={styles.buttonText}>Entrar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('Register')}
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>
                Não tem conta?{' '}
                <Text style={styles.linkTextBold}>Criar conta</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ForgotPasswordModal
        visible={forgotOpen}
        initialEmail={email}
        onClose={() => setForgotOpen(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  logo: { fontSize: 48, color: colors.gold },
  title: {
    fontSize: fonts.sizes.xxxl,
    color: colors.white,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: fonts.sizes.sm,
    color: colors.gray,
    letterSpacing: 4,
    marginTop: spacing.xs,
  },
  phraseContainer: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  phrase: {
    color: colors.gold,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  form: { width: '100%' },
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
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  forgotText: {
    color: colors.gold,
    fontSize: fonts.sizes.sm,
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