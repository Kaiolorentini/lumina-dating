import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '../types';
import { calcularSintonia } from '../utils/sintoniaEngine';

// ============================================
// SERVIÇO DE USUÁRIOS REAIS
//
// Busca perfis reais do Firestore e calcula
// Sintonia entre usuários baseada em:
// - Localização
// - Preferências
// - Perfil completo
// ============================================

export interface RealProfile extends UserProfile {
  sintonia: number;
  sintoniaLabel: string;
}

// Busca perfis reais compatíveis com o usuário atual
export async function getCompatibleProfiles(
  currentUser: UserProfile,
  limitCount: number = 20
): Promise<RealProfile[]> {
  try {
    const q = query(
      collection(db, 'users'),
      limit(50)
    );

    const snapshot = await getDocs(q);
    const profiles: RealProfile[] = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data() as UserProfile;

      // Ignora o próprio usuário
      if (data.uid === currentUser.uid) return;

      // Ignora perfis incompletos
      if (!data.name || !data.age || !data.gender) return;

      // Calcula Sintonia
      const sintoniaResult = calcularSintonia(currentUser, data);

      profiles.push({
        ...data,
        sintonia: sintoniaResult.score,
        sintoniaLabel: sintoniaResult.label,
      });
    });

    // Ordena por maior Sintonia
    profiles.sort((a, b) => b.sintonia - a.sintonia);

    return profiles.slice(0, limitCount);
  } catch (error) {
    console.error('Erro ao buscar perfis:', error);
    return [];
  }
}

// Busca perfil de um usuário específico
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const ref = doc(db, 'users', userId);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data() as UserProfile;
    return null;
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    return null;
  }
}