// ============================================
// LUMINA — AUTENTICAÇÃO
// src/context/AuthContext.tsx
//
// hasProfile vs profileError: "o perfil não existe" e "não consegui
// ler o perfil" são coisas diferentes. Antes, tempo esgotado ou erro
// na leitura viravam hasProfile=false e a pessoa caía no formulário
// de cadastro — podendo gravar por cima do perfil verdadeiro. Agora
// a falha de leitura vira profileError, e o AppNavigator mostra a
// tela de erro com "Tentar novamente".
// ============================================

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../services/firebase';
import { getProfile } from '../services/profileService';

const HAS_PROFILE_KEY = '@lumina:hasProfile';
const USER_UID_KEY    = '@lumina:userUid';

/** Primeira leitura com o app frio pode passar de 4 s. */
const PROFILE_TIMEOUT_MS = 8000;
const PROFILE_ATTEMPTS   = 2;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ]);
}

type ProfileRead =
  | { ok: true;  found: boolean }
  | { ok: false };

/**
 * Lê o perfil com novas tentativas. ok:false = não foi possível LER
 * (erro ou tempo esgotado) — diferente de ler e não encontrar.
 */
async function readProfile(uid: string): Promise<ProfileRead> {
  for (let attempt = 1; attempt <= PROFILE_ATTEMPTS; attempt++) {
    try {
      const profile = await withTimeout(getProfile(uid), PROFILE_TIMEOUT_MS);
      return { ok: true, found: !!profile?.name };
    } catch (error) {
      console.warn(`[AuthContext] Leitura do perfil falhou (tentativa ${attempt}):`, error);
    }
    if (attempt < PROFILE_ATTEMPTS) await new Promise(r => setTimeout(r, 1000));
  }
  return { ok: false };
}

export function translateAuthError(code: string): string {
  const errors: Record<string, string> = {
    'auth/user-not-found':            'E-mail ou senha incorretos',
    'auth/wrong-password':            'E-mail ou senha incorretos',
    'auth/invalid-credential':        'E-mail ou senha incorretos',
    'auth/invalid-login-credentials': 'E-mail ou senha incorretos',
    'auth/invalid-email':             'E-mail inválido',
    'auth/email-already-in-use':      'Este e-mail já está em uso. Faça login.',
    'auth/weak-password':             'Senha fraca. Use pelo menos 6 caracteres',
    'auth/too-many-requests':         'Muitas tentativas. Tente mais tarde',
    'auth/network-request-failed':    'Sem conexão. Verifique sua internet',
    'auth/operation-not-allowed':     'Operação não permitida',
  };
  return errors[code] || `Erro: ${code}`;
}

interface AuthContextData {
  user:           User | null;
  loading:        boolean;
  hasProfile:     boolean;
  /** Não foi possível LER o perfil (erro ou tempo esgotado). */
  profileError:   boolean;
  setHasProfile:  (value: boolean) => void;
  refreshProfile: () => Promise<void>;
  signUp:         (email: string, password: string) => Promise<void>;
  signIn:         (email: string, password: string) => Promise<void>;
  logout:         () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,           setUser]            = useState<User | null>(null);
  const [loading,        setLoading]         = useState(true);
  const [hasProfile,     setHasProfileState] = useState(false);
  const [profileError,   setProfileError]    = useState(false);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    const globalTimeout = setTimeout(() => {
      console.warn('[AuthContext] Timeout global — liberando loading');
      setLoading(false);
    }, 20000);

    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      clearTimeout(globalTimeout);

      setUser(firebaseUser);
      userRef.current = firebaseUser;

      if (!firebaseUser) {
        setHasProfileState(false);
        setProfileError(false);
        setLoading(false);
        return;
      }

      await AsyncStorage.setItem(USER_UID_KEY, firebaseUser.uid).catch(() => {});

      // Cache primeiro — caminho rápido. A confirmação roda em
      // segundo plano e só reforça o cache.
      const cached = await AsyncStorage.getItem(
        `${HAS_PROFILE_KEY}:${firebaseUser.uid}`
      ).catch(() => null);

      if (cached === 'true') {
        setHasProfileState(true);
        setProfileError(false);
        setLoading(false);

        readProfile(firebaseUser.uid).then(result => {
          if (result.ok && result.found) {
            AsyncStorage.setItem(
              `${HAS_PROFILE_KEY}:${firebaseUser.uid}`, 'true'
            ).catch(() => {});
          }
        });
        return;
      }

      const result = await readProfile(firebaseUser.uid);

      if (result.ok) {
        if (result.found) {
          await AsyncStorage.setItem(
            `${HAS_PROFILE_KEY}:${firebaseUser.uid}`, 'true'
          ).catch(() => {});
        }
        setHasProfileState(result.found);
        setProfileError(false);
      } else {
        // Não conseguiu ler: NÃO afirma que o perfil não existe.
        setHasProfileState(false);
        setProfileError(true);
      }

      setLoading(false);
    });

    return () => {
      clearTimeout(globalTimeout);
      unsubscribe();
    };
  }, []);

  const setHasProfile = useCallback((value: boolean) => {
    setHasProfileState(value);
    if (value) setProfileError(false);
    if (userRef.current) {
      AsyncStorage.setItem(
        `${HAS_PROFILE_KEY}:${userRef.current.uid}`,
        value ? 'true' : 'false'
      ).catch(console.error);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const u = userRef.current;
    if (!u) return;

    const result = await readProfile(u.uid);
    if (!result.ok) {
      setProfileError(true);
      return;
    }

    setHasProfileState(result.found);
    setProfileError(false);
    if (result.found) {
      await AsyncStorage.setItem(`${HAS_PROFILE_KEY}:${u.uid}`, 'true').catch(() => {});
    }
  }, []);

  async function signUp(email: string, password: string) {
    await createUserWithEmailAndPassword(auth, email, password);
  }

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    if (userRef.current) {
      await AsyncStorage.removeItem(`${HAS_PROFILE_KEY}:${userRef.current.uid}`);
      await AsyncStorage.removeItem(USER_UID_KEY);
    }
    await signOut(auth);
  }

  return (
    <AuthContext.Provider value={{
      user, loading, hasProfile, profileError,
      setHasProfile, refreshProfile,
      signUp, signIn, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}