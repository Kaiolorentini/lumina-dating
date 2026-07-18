import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  doc,
  getDoc,
  setDoc,
  increment,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';

export interface ProfileVisit {
  id: string;
  visitorId: string;
  profileId: string;
  timestamp: Date;
}

export interface ProfileVisitCount {
  profileId: string;
  totalVisits: number;
  todayVisits: number;
  lastVisit: Date;
}

const DUPLICATE_WINDOW_MINUTES = 5;

async function hasRecentVisit(
  visitorId: string,
  profileId: string
): Promise<boolean> {
  try {
    const fiveMinutesAgo = new Date(
      Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000
    );

    const q = query(
      collection(db, 'profile_visits'),
      where('visitorId', '==', visitorId),
      where('profileId', '==', profileId),
      where('timestamp', '>=', Timestamp.fromDate(fiveMinutesAgo))
    );

    const snap = await getDocs(q);
    return !snap.empty;
  } catch (error) {
    return false;
  }
}

async function updateVisitCount(profileId: string): Promise<void> {
  try {
    const countRef = doc(db, 'profile_visit_counts', profileId);
    const snap = await getDoc(countRef);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (snap.exists()) {
      const data = snap.data();
      const lastVisitDate = data.lastVisit?.toDate() || new Date(0);
      lastVisitDate.setHours(0, 0, 0, 0);

      const isNewDay = lastVisitDate.getTime() < today.getTime();

      await updateDoc(countRef, {
        totalVisits: increment(1),
        todayVisits: isNewDay ? 1 : increment(1),
        lastVisit: serverTimestamp(),
      });
    } else {
      await setDoc(countRef, {
        profileId,
        totalVisits: 1,
        todayVisits: 1,
        lastVisit: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('[updateVisitCount] Erro:', error);
  }
}

export async function registrarVisita(
  visitorId: string,
  profileId: string
): Promise<boolean> {
  if (!visitorId || !profileId) {
    console.warn('[registrarVisita] IDs inválidos — abortando:', visitorId, profileId);
    return false;
  }
  try {
    console.log('[registrarVisita] Iniciando:', visitorId, '->', profileId);

    const isDuplicate = await hasRecentVisit(visitorId, profileId);
    console.log('[registrarVisita] isDuplicate:', isDuplicate);

    if (isDuplicate) {
      console.log('[registrarVisita] Visita ignorada — muito recente');
      return false;
    }

    console.log('[registrarVisita] Criando documento...');
    await addDoc(collection(db, 'profile_visits'), {
      visitorId,
      profileId,
      timestamp: serverTimestamp(),
    });
    console.log('[registrarVisita] ✅ Documento criado com sucesso');

    await updateVisitCount(profileId);
    return true;
  } catch (error) {
    console.error('[registrarVisita] ❌ Erro:', error);
    return false;
  }
}

export async function getVisitasHoje(profileId: string): Promise<number> {
  try {
    const countRef = doc(db, 'profile_visit_counts', profileId);
    const snap = await getDoc(countRef);

    if (!snap.exists()) return 0;

    const data = snap.data();
    const lastVisitDate = data.lastVisit?.toDate() || new Date(0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastVisitDate.setHours(0, 0, 0, 0);

    if (lastVisitDate.getTime() === today.getTime()) {
      return data.todayVisits || 0;
    }

    return 0;
  } catch (error) {
    return 0;
  }
}

export async function getTotalVisitas(profileId: string): Promise<number> {
  try {
    const countRef = doc(db, 'profile_visit_counts', profileId);
    const snap = await getDoc(countRef);
    if (!snap.exists()) return 0;
    return snap.data().totalVisits || 0;
  } catch (error) {
    return 0;
  }
}

export async function getMostVisitedProfiles(
  limitCount: number = 20
): Promise<ProfileVisitCount[]> {
  try {
    const q = query(
      collection(db, 'profile_visit_counts'),
      orderBy('totalVisits', 'desc'),
      limit(limitCount)
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      profileId: d.data().profileId,
      totalVisits: d.data().totalVisits || 0,
      todayVisits: d.data().todayVisits || 0,
      lastVisit: d.data().lastVisit?.toDate() || new Date(),
    }));
  } catch (error) {
    console.error('[getMostVisitedProfiles] Erro:', error);
    return [];
  }
}

export async function getVisitasRecentes(
  profileId: string,
  limitCount: number = 10
): Promise<ProfileVisit[]> {
  try {
    const q = query(
      collection(db, 'profile_visits'),
      where('profileId', '==', profileId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      visitorId: d.data().visitorId,
      profileId: d.data().profileId,
      timestamp: d.data().timestamp?.toDate() || new Date(),
    }));
  } catch (error) {
    return [];
  }
}