import { auth, db } from './firebase';

export function testFirebaseConnection() {
  try {
    console.log('✅ Firebase Auth:', auth ? 'Conectado' : 'Erro');
    console.log('✅ Firebase Firestore:', db ? 'Conectado' : 'Erro');
  } catch (error) {
    console.error('❌ Erro no Firebase:', error);
  }
}