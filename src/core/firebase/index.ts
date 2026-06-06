import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyD7khZ_Y3WlE2OkTeaICVPHhP0f6wAggZ8",
  authDomain: "lumina-ff667.firebaseapp.com",
  projectId: "lumina-ff667",
  storageBucket: "lumina-ff667.firebasestorage.app",
  messagingSenderId: "469492960060",
  appId: "1:469492960060:web:fd9aca942988641afaac39",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;