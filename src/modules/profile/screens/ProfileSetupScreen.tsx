import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Updates from 'expo-updates';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import { RootStackParamList } from '../../../navigation/types';
import { Gender, Preference } from '../../../shared/types';
import { useProfileSetup } from '../hooks/useProfileSetup';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const GENDER_OPTIONS: { label: string; value: Gender }[] = [
  { label: 'Masculino', value: 'masculino' },
  { label: 'Feminino', value: 'feminino' },
  { label: 'Trans', value: 'trans' },
  { label: 'Não-binário', value: 'nao-binario' },
];

const PREFERENCE_OPTIONS: { label: string; value: Preference }[] = [
  { label: 'Homens', value: 'homens' },
  { label: 'Mulheres', value: 'mulheres' },
  { label: 'Trans', value: 'trans' },
  { label: 'Todos', value: 'todos' },
];

export default function ProfileSetupScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<any>();
  const { setHasProfile } = useAuth();
  const [saved, setSaved] = useState(false);
  const editMode = route.params?.editMode === true;

  const {
    name, setName,
    age, setAge,
    city, setCity,
    state, setState,
    bio, setBio,
    gender, setGender,
    preferences, togglePreference,
    photoURI, pickPhoto,
    loading, error, isEditing,
    save,
  } = useProfileSetup({ editMode });

  async function handleSave() {
    const success = await save();
    if (success) {
      if (editMode) {
        if (navigation.canGoBack()) navigation.goBack();
      } else {
        setSaved(true);
      }
    }
  }

  async function handleContinue() {
    setHasProfile(true);
    if (Platform.OS !== 'web' && !__DEV__) {
      try {
        await Updates.reloadAsync();
      } catch (e) {
        console.log('⚠️ reload falhou:', e);
      }
    }
  }

  if (saved) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successStar}>✦</Text>
        <Text style={styles.successTitle}>Perfil criado!</Text>
        <Text style={styles.successSubtitle}>
          Sua jornada começa agora. Descubra conexões únicas e encontre sua Sintonia perfeita.
        </Text>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>
            Descobrir conexões ✦
          </Text>
        </TouchableOpacity>
        <View style={styles.successFeatures}>
          <Text style={styles.successFeature}>🤖 10 Modelos IA esperando por você</Text>
          <Text style={styles.successFeature}>✦ Sistema de Sintonia exclusivo</Text>
          <Text style={styles.successFeature}>💬 Chat em tempo real</Text>
          <Text style={styles.successFeature}>🔥 Perfis compatíveis com você</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.logo}>✦</Text>
        <Text style={styles.title}>
          {isEditing ? 'Editar Perfil' : 'Seu Perfil'}
        </Text>
        <Text style={styles.subtitle}>
          Essas informações geram sua Sintonia
        </Text>
      </View>

      <TouchableOpacity style={styles.photoContainer} onPress={pickPhoto}>
        {photoURI ? (
          <Image source={{ uri: photoURI }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoIcon}>📷</Text>
            <Text style={styles.photoText}>Adicionar foto</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Nome *</Text>
      <TextInput
        style={styles.input}
        placeholder="Seu nome"
        placeholderTextColor={colors.gray}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Idade *</Text>
      <TextInput
        style={styles.input}
        placeholder="Sua idade"
        placeholderTextColor={colors.gray}
        value={age}
        onChangeText={setAge}
        keyboardType="numeric"
        maxLength={3}
      />

      <Text style={styles.label}>Cidade *</Text>
      <TextInput
        style={styles.input}
        placeholder="Sua cidade"
        placeholderTextColor={colors.gray}
        value={city}
        onChangeText={setCity}
      />

      <Text style={styles.label}>Estado *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: SP, RJ, MG"
        placeholderTextColor={colors.gray}
        value={state}
        onChangeText={setState}
        maxLength={2}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.bioInput]}
        placeholder="Fale um pouco sobre você..."
        placeholderTextColor={colors.gray}
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={300}
      />

      <Text style={styles.label}>Gênero *</Text>
      <View style={styles.optionsRow}>
        {GENDER_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              gender === option.value && styles.optionButtonActive,
            ]}
            onPress={() => setGender(option.value)}
          >
            <Text style={[
              styles.optionText,
              gender === option.value && styles.optionTextActive,
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Tenho interesse em *</Text>
      <View style={styles.optionsRow}>
        {PREFERENCE_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              preferences.includes(option.value) && styles.optionButtonActive,
            ]}
            onPress={() => togglePreference(option.value)}
          >
            <Text style={[
              styles.optionText,
              preferences.includes(option.value) && styles.optionTextActive,
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={styles.button}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>
            {isEditing ? 'Salvar alterações ✦' : 'Salvar e continuar ✦'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg },
  successContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  successStar: { fontSize: 72, color: colors.gold },
  successTitle: {
    fontSize: fonts.sizes.xxxl,
    color: colors.white,
    fontWeight: 'bold',
    letterSpacing: 2,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: fonts.sizes.md,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  continueButton: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl * 2,
    alignItems: 'center',
    width: '100%',
    elevation: 8,
  },
  continueButtonText: {
    color: colors.background,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  successFeatures: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gold + '44',
    gap: spacing.md,
  },
  successFeature: {
    color: colors.grayLight,
    fontSize: fonts.sizes.md,
    lineHeight: 22,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  logo: { fontSize: 36, color: colors.gold },
  title: {
    fontSize: fonts.sizes.xxl,
    color: colors.white,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginTop: spacing.sm,
  },
  subtitle: {
    fontSize: fonts.sizes.md,
    color: colors.gray,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  photoContainer: { alignSelf: 'center', marginBottom: spacing.xl },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoIcon: { fontSize: 32 },
  photoText: {
    color: colors.gold,
    fontSize: fonts.sizes.xs,
    marginTop: spacing.xs,
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
  bioInput: { height: 100, textAlignVertical: 'top' },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  optionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.grayDark,
    backgroundColor: colors.surface,
  },
  optionButtonActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold + '22',
  },
  optionText: { color: colors.gray, fontSize: fonts.sizes.sm },
  optionTextActive: { color: colors.gold, fontWeight: 'bold' },
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
});