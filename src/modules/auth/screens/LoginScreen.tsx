import React, { useState, useEffect } from 'react';
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

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

const LAST_EMAIL_KEY = '@lumina:lastEmail';
const LAST_PASSWORD_KEY = '@lumina:lastPassword';

const PHRASES = [
  'Existem perfis com alta Sintonia esperando por voce',
  'Descubra conexoes unicas',
  'Seu proximo grande encontro comeca aqui',
];

export default function LoginScreen({ navigation }: Props) {
  const {
    email, setEmail,
    password, setPassword,
    loading, error,
    submit,
  } = useLoginForm();

  // Carrega ultimo email e senha ao abrir
  useEffect(() => {
    async function loadSaved() {
      const savedEmail = await AsyncStorage.getItem(LAST_EMAIL_KEY);
      const savedPassword = await AsyncStorage.getItem(LAST_PASSWORD_KEY);
      if (savedEmail) setEmail(savedEmail);
      if (savedPassword) setPassword(savedPassword);
    }
    loadSaved();
  }, []);

  async function handleSubmit() {
    if (email) await AsyncStorage.setItem(LAST_EMAIL_KEY, email);
    if (password) await AsyncStorage.setItem(LAST_PASSWORD_KEY, password);
    submit();
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>✦</Text>
          <Text style={styles.title}>Lumina</Text>
          <Text style={styles.subtitle}>AI Dating</Text>
        </View>

        <View style={styles.phraseContainer}>
          <Text style={styles.phrase}>"{PHRASES[0]}"</Text>
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
          />

          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Sua senha"
            placeholderTextColor={colors.gray}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.button}
            onPress={handleSubmit}
            disabled={loading}
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
          >
            <Text style={styles.linkText}>
              Nao tem conta?{' '}
              <Text style={styles.linkTextBold}>Criar conta</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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