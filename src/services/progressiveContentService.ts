import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ============================================
// SISTEMA DE CONTEÚDO PROGRESSIVO
//
// Cada galeria tem 3 níveis:
// Nível 1 → sempre liberado
// Nível 2 → exige Sintonia mínima de 65%
// Nível 3 → exige desbloqueio (moedas)
//
// Controle no Firestore:
// unlockedContent/
//   {userId}_{profileId}/
//     level2: true
//     level3: true
//     timestamp: ...
// ============================================

export const CONTENT_LEVELS = {
  LEVEL_1: {
    level: 1,
    label: 'Básico',
    minSintonia: 0,
    requiresUnlock: false,
    icon: '🔓',
    description: 'Conteúdo gratuito',
  },
  LEVEL_2: {
    level: 2,
    label: 'Especial',
    minSintonia: 65,
    requiresUnlock: false,
    icon: '⚡',
    description: 'Requer 65% de Sintonia',
  },
  LEVEL_3: {
    level: 3,
    label: 'Exclusivo',
    minSintonia: 80,
    requiresUnlock: true,
    coinsCost: 100,
    icon: '👑',
    description: 'Conteúdo exclusivo premium',
  },
};

export interface ContentAccess {
  level1: boolean;
  level2: boolean;
  level3: boolean;
}

// Busca quais níveis o usuário desbloqueou
export async function getContentAccess(
  userId: string,
  profileId: string,
  currentSintonia: number
): Promise<ContentAccess> {
  const docId = `${userId}_${profileId}`;
  const ref = doc(db, 'unlockedContent', docId);
  const snap = await getDoc(ref);

  const level2BySintonia = currentSintonia >= CONTENT_LEVELS.LEVEL_2.minSintonia;
  const level3BySintonia = currentSintonia >= CONTENT_LEVELS.LEVEL_3.minSintonia;

  if (snap.exists()) {
    return {
      level1: true,
      level2: level2BySintonia || snap.data().level2 === true,
      level3: level3BySintonia && snap.data().level3 === true,
    };
  }

  return {
    level1: true,
    level2: level2BySintonia,
    level3: false,
  };
}

// Desbloqueia nível 3 (após pagamento com moedas)
export async function unlockLevel3(
  userId: string,
  profileId: string
): Promise<void> {
  const docId = `${userId}_${profileId}`;
  const ref = doc(db, 'unlockedContent', docId);
  await setDoc(ref, {
    level3: true,
    unlockedAt: serverTimestamp(),
  }, { merge: true });
}

// Verifica se pode acessar um nível específico
export function canAccessLevel(
  level: number,
  access: ContentAccess
): boolean {
  if (level === 1) return access.level1;
  if (level === 2) return access.level2;
  if (level === 3) return access.level3;
  return false;
}

// Mensagem de bloqueio por nível
export function getLockMessage(
  level: number,
  currentSintonia: number
): string {
  if (level === 2) {
    const needed = CONTENT_LEVELS.LEVEL_2.minSintonia - currentSintonia;
    if (needed > 0) {
      return `Aumente sua Sintonia em ${needed.toFixed(0)}% para desbloquear`;
    }
  }
  if (level === 3) {
    return 'Conteúdo exclusivo disponível — desbloqueie agora!';
  }
  return 'Conteúdo bloqueado';
}