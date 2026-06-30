// ============================================
// LUMINA — PRESTIGE REPOSITORY v1.0
// functions/src/gamification/repositories/PrestigeRepository.ts
//
// SPRINT 1A — Acesso ao Firestore para Prestígio.
// Mesma estrutura do legado: users/{uid}.prestige
// Nenhuma regra de negócio aqui.
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

export interface PrestigeSnapshot {
  prestigePoints: number;
  stage:          number;
}

export const PrestigeRepository = {
  async getSnapshot(uid: string): Promise<PrestigeSnapshot> {
    const doc  = await db.collection('users').doc(uid).get();
    const data = doc.data()?.prestige ?? {};
    return {
      prestigePoints: data.prestigePoints ?? 0,
      stage:          data.stage          ?? 0,
    };
  },

  write(t: FirebaseFirestore.Transaction, uid: string, prestigePoints: number, stage: number, stageName: string): void {
    t.set(db.collection('users').doc(uid), {
      prestige: {
        prestigePoints: FieldValue.increment(prestigePoints),
        stage,
        stageName,
        updatedAt: FieldValue.serverTimestamp(),
      },
    }, { merge: true });
  },

  writeNotification(t: FirebaseFirestore.Transaction, uid: string, payload: Record<string, unknown>): void {
    t.set(db.collection('notifications').doc(), {
      userId: uid, type: 'prestige_evolution', read: false,
      ...payload, timestamp: FieldValue.serverTimestamp(),
    });
  },
};