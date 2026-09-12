// ============================================
// useProfileSetup — HOOK
// src/modules/profile/hooks/useProfileSetup.ts
// ============================================

import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { saveProfile, getProfile } from '../services/profileService';
import { uploadProfilePhoto } from '../services/photoService';
import { Gender, Preference } from '../../../shared/types';
import { isRegiaoIdValida } from '../../../services/ibgeService';

interface UseProfileSetupProps {
  editMode?: boolean;
}

interface UseProfileSetupReturn {
  name: string;
  setName: (v: string) => void;
  age: string;
  setAge: (v: string) => void;
  city: string;
  state: string;
  regiaoId: string;
  estadoId: number | null;
  /** Seleciona estado. Limpa a cidade — municípios mudam com a UF. */
  selectEstado: (sigla: string, id: number) => void;
  /** Seleciona município. regiaoId é o código IBGE. */
  selectMunicipio: (nome: string, id: number) => void;
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

  const [name,        setName]        = useState('');
  const [age,         setAge]         = useState('');
  const [city,        setCity]        = useState('');
  const [state,       setState]       = useState('');
  const [regiaoId,    setRegiaoId]    = useState('');
  const [estadoId,    setEstadoId]    = useState<number | null>(null);
  const [bio,         setBio]         = useState('');
  const [gender,      setGender]      = useState<Gender | null>(null);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [photoURI,    setPhotoURI]    = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [isEditing,   setIsEditing]   = useState(false);

  useEffect(() => {
    async function loadExisting() {
      if (!user) return;
      const existing = await getProfile(user.uid);
      if (existing && existing.name) {
        setIsEditing(true);
        if (editMode) {
          setName(existing.name || '');
          setAge(existing.age ? String(existing.age) : '');
          setCity(existing.city || '');
          setState(existing.state || '');
          setRegiaoId(existing.regiaoId || '');
          setEstadoId(existing.estadoId ?? null);
          setBio(existing.bio || '');
          setGender(existing.gender || null);
          setPreferences(existing.preferences || []);
          if (existing.photoURL) setPhotoURI(existing.photoURL);
        }
      }
    }
    loadExisting();
  }, [user]);
// Trocar de estado invalida a cidade: manter "Palotina" com UF
  // "SP" gravaria um regiaoId incoerente e o Destaque Regional
  // entregaria na região errada.
  function selectEstado(sigla: string, id: number) {
    setState(sigla);
    setEstadoId(id);
    setCity('');
    setRegiaoId('');
  }

  function selectMunicipio(nome: string, id: number) {
    setCity(nome);
    setRegiaoId(String(id));
  }
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
    if (!regiaoId || !estadoId) {
      return 'Selecione seu estado e cidade nas listas';
    }
    if (!isRegiaoIdValida(regiaoId, estadoId)) {
      return 'Cidade e estado não combinam. Selecione novamente.';
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

      await saveProfile(user.uid, {
        uid:       user.uid,
        email:     user.email || '',
        name,
        age:       Number(age),
        city,
        state,
        regiaoId,
        estadoId: estadoId!,
        gender:    gender!,
        preferences,
        bio,
        createdAt: new Date(),
      });

      if (photoURI && !photoURI.startsWith('https://')) {
        uploadProfilePhoto(user.uid, photoURI)
          .then(() => console.log('✅ Foto enviada'))
          .catch(err => console.warn('⚠️ Foto falhou:', err));
      }

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar perfil. Tente novamente.';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }

  return {
    name, setName,
    age, setAge,
    city, state, regiaoId, estadoId,
    selectEstado, selectMunicipio,
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