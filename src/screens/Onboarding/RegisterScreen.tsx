import React, { useState } from 'react';
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
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../theme/tokens';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function RegisterScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    if (!email || !password || !confirmPassword) {
      setError('Preencha todos os campos');
      return;
    }
    if (!email.includes('@')) {
      setError('Digite um e-mail válido');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await signUp(email, password);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido');
      } else if (err.code === 'auth/weak-password') {
        setError('Senha muito fraca. Use pelo menos 6 caracteres');
      } else {
        setError('Erro ao criar conta. Tente novamente');
      }
    } finally {
      setLoading(false);
    }
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
          <Text style={styles.phrase}>"Descubra conexões únicas"</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Criar conta</Text>

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            placeholderTextColor={COLORS.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={COLORS.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text style={styles.label}>Confirmar senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Repita sua senha"
            placeholderTextColor={COLORS.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.button}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={styles.buttonText}>Criar conta</Text>
            )}
          </TouchableOpacity>

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
    fontSize: FONT_SIZE.display,
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
  },
  formTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
    marginBottom: SPACING.lg,
    letterSpacing: 1,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.caption,
    marginBottom: SPACING.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: COLORS.card,
    color: COLORS.textPrimary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    fontSize: FONT_SIZE.body,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  error: {
    color: COLORS.error,
    fontSize: FONT_SIZE.caption,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  buttonText: {
    color: COLORS.background,
    fontSize: FONT_SIZE.subtitle,
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
