import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { saveProfile, getProfile } from '../services/profileService';
import { uploadProfilePhoto } from '../services/photoService';
import { Gender, Preference } from '../../../shared/types';

interface UseProfileSetupProps {
  editMode?: boolean;
}

interface UseProfileSetupReturn {
  name: string;
  setName: (v: string) => void;
  age: string;
  setAge: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  state: string;
  setState: (v: string) => void;
  bio: string;
  setBio: (v: string) => void;
  gender: Gender | null;
  setGender: (v: Gender) => void;
  preferences: Preference[];
  photoURI: string | null;
  loading: boolean;
  error: string;
  isEditing: boolean;
  togglePreference: (pref: Preference) => void;
  pickPhoto: () => Promise<void>;
  save: () => Promise<boolean>;
}

export function useProfileSetup(
  props?: UseProfileSetupProps
): UseProfileSetupReturn {
  const { user } = useAuth();
  const editMode = props?.editMode === true;

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

  // Só carrega dados se editMode=true
  useEffect(() => {
    async function loadExisting() {
      if (!user || !editMode) return;
      const existing = await getProfile(user.uid);
      if (existing && existing.name) {
        setIsEditing(true);
        setName(existing.name || '');
        setAge(existing.age ? String(existing.age) : '');
        setCity(existing.city || '');
        setState(existing.state || '');
        setBio(existing.bio || '');
        setGender(existing.gender || null);
        setPreferences(existing.preferences || []);
        if (existing.photoURL) {
          setPhotoURI(existing.photoURL);
        }
      }
    }
    loadExisting();
  }, [user, editMode]);

  function togglePreference(pref: Preference) {
    setPreferences(prev =>
      prev.includes(pref)
        ? prev.filter(p => p !== pref)
        : [...prev, pref]
    );
  }

  async function pickPhoto() {
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

  function validate(): string | null {
    if (!name || !age || !city || !state || !gender || preferences.length === 0) {
      return 'Preencha todos os campos obrigatórios';
    }
    if (isNaN(Number(age)) || Number(age) < 18 || Number(age) > 100) {
      return 'Digite uma idade válida (mínimo 18 anos)';
    }
    return null;
  }

  async function save(): Promise<boolean> {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return false;
    }

    try {
      setLoading(true);
      setError('');

      if (!user) return false;

      console.log('💾 Salvando perfil para:', user.uid);

      await saveProfile(user.uid, {
        uid: user.uid,
        email: user.email || '',
        name,
        age: Number(age),
        city,
        state,
        gender: gender!,
        preferences,
        bio,
        createdAt: new Date(),
      });

      console.log('✅ Perfil salvo no Firestore!');

      if (photoURI && !photoURI.startsWith('https://')) {
        uploadProfilePhoto(user.uid, photoURI)
          .then(() => console.log('✅ Foto enviada'))
          .catch(err => console.warn('⚠️ Foto falhou:', err));
      }

      return true;
    } catch (err: any) {
      console.error('❌ Erro ao salvar:', err?.message || err);
      setError(err?.message || 'Erro ao salvar perfil. Tente novamente.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  return {
    name, setName,
    age, setAge,
    city, setCity,
    state, setState,
    bio, setBio,
    gender, setGender,
    preferences,
    photoURI,
    loading, error, isEditing,
    togglePreference,
    pickPhoto,
    save,
  };
}