import React from 'react';
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
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={colors.gray}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Text style={styles.label}>Confirmar senha</Text>
            <TextInput
              style={styles.input}
              placeholder="Repita sua senha"
              placeholderTextColor={colors.gray}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={styles.button}
              onPress={submit}
              disabled={loading}
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