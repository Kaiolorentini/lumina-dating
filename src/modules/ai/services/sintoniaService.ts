import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { COLLECTIONS, SINTONIA } from '../../../core/constants';
import {
  getSintoniaMilestone,
  getSintoniaIncreaseMessage,
} from '../../../shared/utils/sintonia';

// ============================================
// SINTONIA SERVICE — MÓDULO AI
//
// Responsabilidade única:
// Persistência da Sintonia dinâmica no Firestore.
// Sem cálculo aqui — isso é sintoniaCalculator.
// ============================================

export interface Connection {
  sintonia: number;
  messages: number;
  visits: number;
  timeSpent: number;
  lastInteraction: Date | null;
  milestone: string;
}

export interface SintoniaUpdateResult {
  sintonia: number;
  message: string;
}

// Busca ou cria conexão
export async function getConnection(
  userId: string,
  profileId: string
): Promise<Connection> {
  const ref = doc(
    db,
    COLLECTIONS.USERS,
    userId,
    COLLECTIONS.CONNECTIONS,
    profileId
  );
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return {
      sintonia: snap.data().sintonia || SINTONIA.BASE_SCORE,
      messages: snap.data().messages || 0,
      visits: snap.data().visits || 0,
      timeSpent: snap.data().timeSpent || 0,
      lastInteraction: snap.data().lastInteraction?.toDate() || null,
      milestone: snap.data().milestone || getSintoniaMilestone(SINTONIA.BASE_SCORE),
    };
  }

  const newConn: Connection = {
    sintonia: SINTONIA.BASE_SCORE,
    messages: 0,
    visits: 0,
    timeSpent: 0,
    lastInteraction: null,
    milestone: getSintoniaMilestone(SINTONIA.BASE_SCORE),
  };

  await setDoc(ref, {
    ...newConn,
    lastInteraction: serverTimestamp(),
  });

  return newConn;
}

// Calcula novo score sem diminuir drasticamente
function calculateNewScore(
  current: number,
  messages: number,
  visits: number,
  timeSpent: number
): number {
  let score = current;

  const messageBonuses = [1, 5, 10, 20, 50, 100];
  for (const threshold of messageBonuses) {
    if (messages >= threshold) {
      score = Math.max(score, current + threshold / 10);
    }
  }

  if (visits >= 3) score += 1;
  if (visits >= 10) score += 2;
  if (visits >= 25) score += 3;

  const timeBonus = Math.floor(timeSpent / 30) * 0.5;
  score += timeBonus;

  score = Math.min(score, current + SINTONIA.MAX_INCREASE);
  score = Math.min(score, SINTONIA.MAX_SCORE);

  return Math.round(score * 10) / 10;
}

// Registra visita e atualiza Sintonia
export async function registerVisit(
  userId: string,
  profileId: string
): Promise<SintoniaUpdateResult> {
  const ref = doc(
    db,
    COLLECTIONS.USERS,
    userId,
    COLLECTIONS.CONNECTIONS,
    profileId
  );
  const conn = await getConnection(userId, profileId);
  const newVisits = conn.visits + 1;
  const newScore = calculateNewScore(
    conn.sintonia,
    conn.messages,
    newVisits,
    conn.timeSpent
  );

  const milestone = getSintoniaMilestone(newScore);
  const message = getSintoniaIncreaseMessage(conn.sintonia, newScore);

  await updateDoc(ref, {
    visits: increment(1),
    sintonia: newScore,
    milestone,
    lastInteraction: serverTimestamp(),
  });

  return { sintonia: newScore, message };
}

// Registra mensagem e atualiza Sintonia
export async function registerMessage(
  userId: string,
  profileId: string
): Promise<SintoniaUpdateResult> {
  const ref = doc(
    db,
    COLLECTIONS.USERS,
    userId,
    COLLECTIONS.CONNECTIONS,
    profileId
  );
  const conn = await getConnection(userId, profileId);
  const newMessages = conn.messages + 1;
  const newScore = calculateNewScore(
    conn.sintonia,
    newMessages,
    conn.visits,
    conn.timeSpent
  );

  const milestone = getSintoniaMilestone(newScore);
  const message = getSintoniaIncreaseMessage(conn.sintonia, newScore);

  await updateDoc(ref, {
    messages: increment(1),
    sintonia: newScore,
    milestone,
    lastInteraction: serverTimestamp(),
  });

  return { sintonia: newScore, message };
}

// Registra tempo no perfil e atualiza Sintonia
export async function registerTimeSpent(
  userId: string,
  profileId: string,
  seconds: number
): Promise<SintoniaUpdateResult> {
  const ref = doc(
    db,
    COLLECTIONS.USERS,
    userId,
    COLLECTIONS.CONNECTIONS,
    profileId
  );
  const conn = await getConnection(userId, profileId);
  const newTime = conn.timeSpent + seconds;
  const newScore = calculateNewScore(
    conn.sintonia,
    conn.messages,
    conn.visits,
    newTime
  );

  const milestone = getSintoniaMilestone(newScore);
  const message = getSintoniaIncreaseMessage(conn.sintonia, newScore);

  await updateDoc(ref, {
    timeSpent: increment(seconds),
    sintonia: newScore,
    milestone,
    lastInteraction: serverTimestamp(),
  });

  return { sintonia: newScore, message };
}