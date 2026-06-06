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
const USER_UID_KEY = '@lumina:userUid';

export function translateAuthError(code: string): string {
  const errors: Record<string, string> = {
    'auth/user-not-found': 'E-mail ou senha incorretos',
    'auth/wrong-password': 'E-mail ou senha incorretos',
    'auth/invalid-credential': 'E-mail ou senha incorretos',
    'auth/invalid-login-credentials': 'E-mail ou senha incorretos',
    'auth/invalid-email': 'E-mail invalido',
    'auth/email-already-in-use': 'Este e-mail ja esta em uso. Faca login.',
    'auth/weak-password': 'Senha fraca. Use pelo menos 6 caracteres',
    'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde',
    'auth/network-request-failed': 'Sem conexao. Verifique sua internet',
    'auth/operation-not-allowed': 'Operacao nao permitida',
  };
  return errors[code] || `Erro: ${code}`;
}

interface AuthContextData {
  user: User | null;
  loading: boolean;
  hasProfile: boolean;
  setHasProfile: (value: boolean) => void;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfileState] = useState(false);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      console.log('Firebase:', firebaseUser ? 'Logado' : 'Nao logado');
      setUser(firebaseUser);
      userRef.current = firebaseUser;

      if (firebaseUser) {
        await AsyncStorage.setItem(USER_UID_KEY, firebaseUser.uid);

        // Verifica cache primeiro
        const cached = await AsyncStorage.getItem(
          `${HAS_PROFILE_KEY}:${firebaseUser.uid}`
        );

        if (cached === 'true') {
          console.log('Perfil no cache!');
          setHasProfileState(true);
          setLoading(false);

          // Verifica Firestore em background SEM remover cache se falhar
          getProfile(firebaseUser.uid).then(profile => {
            if (profile?.name) {
              // Perfil confirmado — garante cache atualizado
              AsyncStorage.setItem(
                `${HAS_PROFILE_KEY}:${firebaseUser.uid}`,
                'true'
              ).catch(console.error);
            }
            // Se não encontrar, NÃO remove o cache — pode ser erro de rede
          }).catch(() => {
            // Erro de rede — mantém cache, não redireciona
            console.log('Erro ao verificar perfil em background — mantendo cache');
          });
          return;
        }

        // Cache não existe — busca no Firestore com retry
        let profile = null;
        for (let i = 1; i <= 3; i++) {
          console.log(`Buscando perfil tentativa ${i}...`);
          try {
            profile = await getProfile(firebaseUser.uid);
            if (profile?.name) break;
          } catch (e) {
            console.warn(`Erro tentativa ${i}:`, e);
          }
          if (i < 3) await new Promise(r => setTimeout(r, 1000));
        }

        const found = !!(profile?.name);
        console.log('hasProfile:', found);

        if (found) {
          await AsyncStorage.setItem(
            `${HAS_PROFILE_KEY}:${firebaseUser.uid}`,
            'true'
          );
        }

        setHasProfileState(found);
      } else {
        setHasProfileState(false);
      }

      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const setHasProfile = useCallback((value: boolean) => {
    console.log('setHasProfile:', value);
    setHasProfileState(value);
    if (userRef.current) {
      AsyncStorage.setItem(
        `${HAS_PROFILE_KEY}:${userRef.current.uid}`,
        value ? 'true' : 'false'
      ).catch(console.error);
    }
  }, []);

  async function refreshProfile() {
    const u = userRef.current;
    if (!u) return;
    const profile = await getProfile(u.uid);
    const found = !!(profile?.name);
    setHasProfileState(found);
    if (found) {
      await AsyncStorage.setItem(
        `${HAS_PROFILE_KEY}:${u.uid}`,
        'true'
      );
    }
  }

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
      user, loading, hasProfile,
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