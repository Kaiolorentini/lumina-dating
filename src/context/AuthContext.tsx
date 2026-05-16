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
import { auth } from '../services/firebase';
import { getProfile } from '../services/profileService';

interface AuthContextData {
  user: User | null;
  loading: boolean;
  hasProfile: boolean;
  profileKey: number;
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
  const [profileKey, setProfileKey] = useState(0);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      console.log('🔥 Firebase user:', firebaseUser ? 'Logado' : 'Não logado');
      setUser(firebaseUser);
      userRef.current = firebaseUser;

      if (firebaseUser) {
        try {
          let profile = null;
          let attempts = 0;

          while (!profile && attempts < 5) {
            attempts++;
            console.log(`🔍 Tentativa ${attempts}...`);
            try {
              profile = await getProfile(firebaseUser.uid);
            } catch (e) {
              console.warn(`⚠️ Erro tentativa ${attempts}:`, e);
            }
            if (!profile && attempts < 5) {
              await new Promise(r => setTimeout(r, 800 * attempts));
            }
          }

          const found = !!(profile && profile.name);
          console.log('👤 hasProfile:', found, profile?.name);
          setHasProfileState(found);
          setProfileKey(prev => prev + 1);
        } catch (error) {
          console.error('❌ Erro auth:', error);
          setHasProfileState(false);
        }
      } else {
        setHasProfileState(false);
      }

      setLoading(false);
    });
    return unsubscribe;
  }, []);
  const setHasProfile = useCallback((value: boolean) => {
    console.log('🔄 setHasProfile:', value);
    setHasProfileState(value);
    // Incrementa key para forçar re-render do navigator
    setProfileKey(prev => prev + 1);
  }, []);

  async function refreshProfile() {
    const currentUser = userRef.current;
    if (!currentUser) return;
    try {
      const profile = await getProfile(currentUser.uid);
      console.log('✅ refreshProfile:', !!profile);
      setHasProfileState(!!profile);
      setProfileKey(prev => prev + 1);
    } catch (error) {
      console.error('❌ refreshProfile error:', error);
    }
  }

  async function signUp(email: string, password: string) {
    await createUserWithEmailAndPassword(auth, email, password);
  }

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      hasProfile,
      profileKey,
      setHasProfile,
      refreshProfile,
      signUp,
      signIn,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}