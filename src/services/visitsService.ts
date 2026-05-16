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

// ============================================
// SISTEMA DE VISITAS DE PERFIL
//
// Duas coleções:
//
// 1. profile_visits/ — registro individual de cada visita
// 2. profile_visit_counts/ — contador de visitas por perfil
//    (usado para buscar os mais visitados rapidamente)
// ============================================

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

// Verifica se já existe visita recente
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

// Atualiza contador de visitas do perfil
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

      // Reseta contador diário se for novo dia
      const isNewDay = lastVisitDate.getTime() < today.getTime();

      await updateDoc(countRef, {
        totalVisits: increment(1),
        todayVisits: isNewDay ? 1 : increment(1),
        lastVisit: serverTimestamp(),
      });
    } else {
      // Cria contador novo
      await setDoc(countRef, {
        profileId,
        totalVisits: 1,
        todayVisits: 1,
        lastVisit: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Erro ao atualizar contador:', error);
  }
}

// Registra visita ao perfil
export async function registrarVisita(
  visitorId: string,
  profileId: string
): Promise<boolean> {
  try {
    const isDuplicate = await hasRecentVisit(visitorId, profileId);
    if (isDuplicate) {
      console.log('⏱️ Visita ignorada — muito recente');
      return false;
    }

    // Salva visita individual
    await addDoc(collection(db, 'profile_visits'), {
      visitorId,
      profileId,
      timestamp: serverTimestamp(),
    });

    // Atualiza contador do perfil
    await updateVisitCount(profileId);

    console.log('✅ Visita registrada com sucesso');
    return true;
  } catch (error) {
    console.error('Erro ao registrar visita:', error);
    return false;
  }
}

// Busca visitas de hoje
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

    // Se a última visita foi hoje, retorna o contador diário
    if (lastVisitDate.getTime() === today.getTime()) {
      return data.todayVisits || 0;
    }

    return 0;
  } catch (error) {
    return 0;
  }
}

// Busca total de visitas
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

// Busca os perfis mais visitados
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
    console.error('Erro ao buscar mais visitados:', error);
    return [];
  }
}

// Busca visitas recentes
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
    return snap.docs.map(doc => ({
      id: doc.id,
      visitorId: doc.data().visitorId,
      profileId: doc.data().profileId,
      timestamp: doc.data().timestamp?.toDate() || new Date(),
    }));
  } catch (error) {
    return [];
  }
}