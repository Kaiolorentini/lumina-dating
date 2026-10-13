// ============================================
// LUMINA — FIREBASE (APP ANDROID/iOS)
// src/core/firebase/index.ts
//
// Na web o Metro usa index.web.ts no lugar deste arquivo:
// getReactNativePersistence não existe no pacote web do Firebase.
// ============================================

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// @ts-ignore — getReactNativePersistence só existe na tipagem React Native do Firebase
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';

import { firebaseConfig } from './config';

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