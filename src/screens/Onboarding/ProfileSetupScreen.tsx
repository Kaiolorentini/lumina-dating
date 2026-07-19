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
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../theme/tokens';
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
      base64: true,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      if (asset.base64) {
        setPhotoURI(`data:image/jpeg;base64,${asset.base64}`);
      } else {
        setPhotoURI(asset.uri);
      }
    }
  }

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
      if (user) {
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

        if (photoURI) {
          try {
            const photoURL = await uploadProfilePhoto(user.uid, photoURI);
            await saveProfile(user.uid, { photoURL });
          } catch (uploadError) {
            console.warn('⚠️ Foto não enviada, continuando sem ela:', uploadError);
          }
        }

        setHasProfile(true);

        if (isEditing) {
          navigation.goBack();
        }
      }
    } catch (err: any) {
      setError(`Erro: ${err?.message || 'Tente novamente'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.logo}>✦</Text>
          <Text style={styles.title}>Seu Perfil</Text>
          <Text style={styles.subtitle}>
            Essas informações geram sua Sintonia
          </Text>
        </View>

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

        <Text style={styles.label}>Nome *</Text>
        <TextInput
          style={styles.input}
          placeholder="Seu nome"
          placeholderTextColor={COLORS.textSecondary}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Idade *</Text>
        <TextInput
          style={styles.input}
          placeholder="Sua idade"
          placeholderTextColor={COLORS.textSecondary}
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
          maxLength={3}
        />

        <Text style={styles.label}>Cidade *</Text>
        <TextInput
          style={styles.input}
          placeholder="Sua cidade"
          placeholderTextColor={COLORS.textSecondary}
          value={city}
          onChangeText={setCity}
        />

        <Text style={styles.label}>Estado *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: SP, RJ, MG"
          placeholderTextColor={COLORS.textSecondary}
          value={state}
          onChangeText={setState}
          maxLength={2}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          placeholder="Fale um pouco sobre você..."
          placeholderTextColor={COLORS.textSecondary}
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={300}
        />

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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={styles.button}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.background} />
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
  scroll: {
    padding: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    marginTop: SPACING.lg,
  },
  logo: {
    fontSize: FONT_SIZE.display,
    color: COLORS.gold,
  },
  title: {
    fontSize: FONT_SIZE.title,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 2,
    marginTop: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZE.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  photoContainer: {
    alignSelf: 'center',
    marginBottom: SPACING.xl,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoIcon: {
    fontSize: 32,
  },
  photoText: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.overline,
    marginTop: SPACING.xs,
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
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  optionButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  optionButtonActive: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.gold + '22',
  },
  optionText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.caption,
  },
  optionTextActive: {
    color: COLORS.gold,
    fontWeight: FONT_WEIGHT.bold,
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
});
