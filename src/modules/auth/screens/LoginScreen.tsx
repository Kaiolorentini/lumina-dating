import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Input } from '../../../components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';
import { RootStackParamList } from '../../../navigation/types';
import { useLoginForm } from '../hooks/useAuthForm';
import ScreenContainer from '../../../components/ScreenContainer';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

const LAST_EMAIL_KEY = '@lumina:lastEmail';

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
      if (savedEmail) setEmail(savedEmail);
    }
    loadSaved();
  }, []);

  async function handleSubmit() {
    if (email) await AsyncStorage.setItem(LAST_EMAIL_KEY, email);
    
    submit();
  }

  return (
    <ScreenContainer>
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
              placeholder="Sua senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Button
              label="Entrar"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              variant="primary"
              fullWidth
            />

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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
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
  logo: { fontSize: 48, color: COLORS.gold },
  title: {
    fontSize: FONT_SIZE.xxl,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: FONT_SIZE.caption,
    color: COLORS.textSecondary,
    letterSpacing: 4,
    marginTop: SPACING.xs,
  },
  phraseContainer: {
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  phrase: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.body,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  form: { width: '100%', gap: SPACING.md },
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