// ============================================
// LUMINA — FIREBASE (WEB)
// src/core/firebase/index.web.ts
//
// Versão do navegador. O Metro escolhe este arquivo só na web;
// o app continua com index.ts (persistência do React Native).
//
// Sessão: IndexedDB, com localStorage de reserva quando o navegador
// bloqueia IndexedDB (ex.: algumas janelas anônimas). Mesmo
// comportamento padrão do Firebase web, declarado de forma explícita.
// A opção "computador compartilhado" (sessão só enquanto a aba estiver
// aberta) entra na Fase 1, na tela de login.
//
// Mesmos exports do index.ts: auth, db, storage e app (default).
// ============================================

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
} from 'firebase/auth';

import { firebaseConfig } from './config';

// Checar ANTES de initializeApp — evita double init (recarga a quente)
const alreadyInitialized = getApps().length > 0;
const app = alreadyInitialized ? getApp() : initializeApp(firebaseConfig);

// initializeAuth só na primeira vez; getAuth nas demais
// (evita "auth/already-initialized")
export const auth = alreadyInitialized
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });

export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;