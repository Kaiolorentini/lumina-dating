

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { saveProfile, uploadProfilePhoto, getProfile } from '../../services/profileService';
import { RootStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { Gender, Preference } from '../../types';
import ScreenContainer from '../../components/ScreenContainer';

export default function ProfileSetupScreen() {
  const { user, setHasProfile } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [photoURI, setPhotoURI] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Carrega dados existentes se estiver editando
  useEffect(() => {
    async function loadExistingProfile() {
      if (!user) return;
      const existing = await getProfile(user.uid);
      if (existing) {
        setIsEditing(true);
        setName(existing.name || '');
        setAge(existing.age ? String(existing.age) : '');
        setCity(existing.city || '');
        setState(existing.state || '');
        setBio(existing.bio || '');
        setGender(existing.gender || null);
        setPreferences(existing.preferences || []);
      }
    }
    loadExistingProfile();
  }, []);

  const genderOptions: { label: string; value: Gender }[] = [
    { label: 'Masculino', value: 'masculino' },
    { label: 'Feminino', value: 'feminino' },
    { label: 'Trans', value: 'trans' },
    { label: 'Não-binário', value: 'nao-binario' },
  ];

  const preferenceOptions: { label: string; value: Preference }[] = [
    { label: 'Homens', value: 'homens' },
    { label: 'Mulheres', value: 'mulheres' },
    { label: 'Trans', value: 'trans' },
    { label: 'Todos', value: 'todos' },
  ];

  // Abre a galeria do dispositivo para escolher foto
  async function handlePickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos acessar sua galeria.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true, // ← retorna base64 para exibir no web
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      // Usa base64 para exibir a imagem no web
      if (asset.base64) {
        setPhotoURI(`data:image/jpeg;base64,${asset.base64}`);
      } else {
        setPhotoURI(asset.uri);
      }
    }
  }

  // Alterna preferência selecionada
  function togglePreference(pref: Preference) {
    if (preferences.includes(pref)) {
      setPreferences(preferences.filter(p => p !== pref));
    } else {
      setPreferences([...preferences, pref]);
    }
  }

async function handleSave() {
    if (!name || !age || !city || !state || !gender || preferences.length === 0) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }
    if (isNaN(Number(age)) || Number(age) < 18 || Number(age) > 100) {
      setError('Digite uma idade válida (mínimo 18 anos)');
      return;
    }

    try {
      setLoading(true);
      setError('');
      console.log('💾 Salvando perfil...');

      if (user) {
        // PASSO 1 — Salva perfil primeiro
        await saveProfile(user.uid, {
          uid: user.uid,
          email: user.email || '',
          name,
          age: Number(age),
          city,
          state,
          gender,
          preferences,
          bio,
          createdAt: new Date(),
        });
        console.log('✅ Perfil salvo no Firestore!');

        // PASSO 2 — Upload da foto (opcional)
        if (photoURI) {
          try {
            console.log('📤 Iniciando upload da foto...');
            const photoURL = await uploadProfilePhoto(user.uid, photoURI);
            await saveProfile(user.uid, { photoURL });
            console.log('✅ Foto salva:', photoURL);
          } catch (uploadError) {
            console.warn('⚠️ Foto não enviada, continuando sem ela:', uploadError);
          }
        }

        console.log('✅ Tudo salvo! Redirecionando...');
        setHasProfile(true);

        if (isEditing) {
          navigation.goBack();
        }
      }
    } catch (err: any) {
      console.error('❌ Erro ao salvar:', err?.message || err);
      setError(`Erro: ${err?.message || 'Tente novamente'}`);
    } finally {
      setLoading(false);
    }
  }
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>✦</Text>
          <Text style={styles.title}>Seu Perfil</Text>
          <Text style={styles.subtitle}>
            Essas informações geram sua Sintonia
          </Text>
        </View>

        {/* Foto */}
        <TouchableOpacity style={styles.photoContainer} onPress={handlePickPhoto}>
          {photoURI ? (
            <Image source={{ uri: photoURI }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoIcon}>📷</Text>
              <Text style={styles.photoText}>Adicionar foto</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Nome */}
        <Text style={styles.label}>Nome *</Text>
        <TextInput
          style={styles.input}
          placeholder="Seu nome"
          placeholderTextColor={colors.gray}
          value={name}
          onChangeText={setName}
        />

        {/* Idade */}
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

        {/* Cidade */}
        <Text style={styles.label}>Cidade *</Text>
        <TextInput
          style={styles.input}
          placeholder="Sua cidade"
          placeholderTextColor={colors.gray}
          value={city}
          onChangeText={setCity}
        />

        {/* Estado */}
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

        {/* Bio */}
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

        {/* Gênero */}
        <Text style={styles.label}>Gênero *</Text>
        <View style={styles.optionsRow}>
          {genderOptions.map(option => (
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

        {/* Preferências */}
        <Text style={styles.label}>Tenho interesse em *</Text>
        <View style={styles.optionsRow}>
          {preferenceOptions.map(option => (
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

        {/* Erro */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Botão salvar */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.buttonText}>Salvar e continuar ✦</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  logo: {
    fontSize: 36,
    color: colors.gold,
  },
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
  photoContainer: {
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
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
  photoIcon: {
    fontSize: 32,
  },
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
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
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
  optionText: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
  },
  optionTextActive: {
    color: colors.gold,
    fontWeight: 'bold',
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
});