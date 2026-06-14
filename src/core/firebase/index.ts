import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// @ts-ignore
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyD7khZ_Y3WlE2OkTeaICVPHhP0f6wAggZ8",
  authDomain: "lumina-ff667.firebaseapp.com",
  projectId: "lumina-ff667",
  storageBucket: "lumina-ff667.firebasestorage.app",
  messagingSenderId: "469492960060",
  appId: "1:469492960060:web:fd9aca942988641afaac39",
};

// ✅ Checar ANTES de initializeApp — evita double init
const alreadyInitialized = getApps().length > 0;
const app = alreadyInitialized ? getApp() : initializeApp(firebaseConfig);

// ✅ initializeAuth com persistência apenas na primeira vez
// getAuth nas demais — evita erro "auth/already-initialized"
export const auth = alreadyInitialized
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });

export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;