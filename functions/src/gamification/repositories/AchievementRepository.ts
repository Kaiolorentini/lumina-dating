// ============================================
// LUMINA — ACHIEVEMENT REPOSITORY v1.0
// functions/src/gamification/repositories/AchievementRepository.ts
//
// SPRINT 1A — Acesso ao Firestore para Conquistas.
// Mesma estrutura do legado: users/{uid}.achievements
// Nenhuma regra de negócio aqui.
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

export interface AchievementSnapshot {
  unlocked: string[];
  progress: Record<string, number>;
}

export const AchievementRepository = {
  async getSnapshot(uid: string): Promise<AchievementSnapshot> {
    const doc  = await db.collection('users').doc(uid).get();
    const data = doc.data()?.achievements ?? {};
    return {
      unlocked: data.unlocked ?? [],
      progress: data.progress ?? {},
    };
  },

  async getSnapshotInTransaction(t: FirebaseFirestore.Transaction, uid: string): Promise<AchievementSnapshot> {
    const doc  = await t.get(db.collection('users').doc(uid));
    const data = doc.data()?.achievements ?? {};
    return {
      unlocked: data.unlocked ?? [],
      progress: data.progress ?? {},
    };
  },

  updateProgress(t: FirebaseFirestore.Transaction, uid: string, achId: string, progress: number): void {
    t.set(db.collection('users').doc(uid), {
      achievements: { progress: { [achId]: progress } },
    }, { merge: true });
  },

  unlock(t: FirebaseFirestore.Transaction, uid: string, achId: string): void {
    t.set(db.collection('users').doc(uid), {
      achievements: {
        unlocked:   FieldValue.arrayUnion(achId),
        unlockedAt: { [achId]: FieldValue.serverTimestamp() },
      },
    }, { merge: true });
  },

  writeLog(t: FirebaseFirestore.Transaction, payload: Record<string, unknown>): void {
    t.set(db.collection('achievementLog').doc(), {
      ...payload, timestamp: FieldValue.serverTimestamp(), imutavel: true,
    });
  },

  writeNotification(t: FirebaseFirestore.Transaction, uid: string, payload: Record<string, unknown>): void {
    t.set(db.collection('notifications').doc(), {
      userId: uid, type: 'achievement_unlocked', read: false,
      ...payload, timestamp: FieldValue.serverTimestamp(),
    });
  },
};