// ============================================
// LUMINA — CONFIGURAÇÃO DO FIREBASE
// src/core/firebase/config.ts
//
// Fonte única da configuração, usada pelo app (index.ts) e pela
// web (index.web.ts). Estes valores identificam o projeto e não são
// segredo: a proteção dos dados está nas regras e nas Functions.
// ============================================

import type { FirebaseOptions } from 'firebase/app';

export const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyD7khZ_Y3WlE2OkTeaICVPHhP0f6wAggZ8',
  authDomain: 'lumina-ff667.firebaseapp.com',
  projectId: 'lumina-ff667',
  storageBucket: 'lumina-ff667.firebasestorage.app',
  messagingSenderId: '469492960060',
  appId: '1:469492960060:web:fd9aca942988641afaac39',
};