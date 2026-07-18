// ============================================
// useProfileSetup — HOOK
// src/modules/profile/hooks/useProfileSetup.ts
//
// + Campo CPF (opcional) para pagamentos Asaas.
//   Guardado só com dígitos. Validado (dígitos verificadores)
//   apenas se preenchido — vazio é permitido.
// ============================================

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
  cpf: string;
  setCpf: (v: string) => void;
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

// Mantém só dígitos
function onlyDigits(v: string): string {
  return v.replace(/\D/g, '');
}

// Aplica máscara 000.000.000-00 conforme digita
export function maskCpf(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// Valida dígitos verificadores do CPF
export function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos iguais

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== parseInt(cpf[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== parseInt(cpf[10], 10)) return false;

  return true;
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
  const [bio,         setBio]         = useState('');
  const [cpf,         setCpfRaw]      = useState('');
  const [gender,      setGender]      = useState<Gender | null>(null);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [photoURI,    setPhotoURI]    = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [isEditing,   setIsEditing]   = useState(false);

  // setCpf aplica a máscara automaticamente
  function setCpf(v: string) {
    setCpfRaw(maskCpf(v));
  }

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
          setBio(existing.bio || '');
          setGender(existing.gender || null);
          setPreferences(existing.preferences || []);
          if (existing.cpf) setCpfRaw(maskCpf(existing.cpf));
          if (existing.photoURL) setPhotoURI(existing.photoURL);
        }
      }
    }
    loadExisting();
  }, [user]);

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
    // CPF é opcional — mas se preenchido, precisa ser válido
    if (cpf.trim() && !isValidCpf(cpf)) {
      return 'CPF inválido. Verifique os números ou deixe em branco.';
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

      const cpfDigits = onlyDigits(cpf);

      await saveProfile(user.uid, {
        uid:       user.uid,
        email:     user.email || '',
        name,
        age:       Number(age),
        city,
        state,
        gender:    gender!,
        preferences,
        bio,
        // Só grava cpf se preenchido e válido (guarda apenas dígitos)
        ...(cpfDigits.length === 11 && { cpf: cpfDigits }),
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
    city, setCity,
    state, setState,
    bio, setBio,
    cpf, setCpf,
    gender, setGender,
    preferences,
    photoURI,
    loading, error, isEditing,
    togglePreference,
    pickPhoto,
    save,
  };
}