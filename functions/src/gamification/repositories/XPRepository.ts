// ============================================
// LUMINA — XP REPOSITORY v1.0
// functions/src/gamification/repositories/XPRepository.ts
//
// RESPONSABILIDADE ÚNICA: acesso ao Firestore para XP.
// Nenhuma regra de negócio aqui.
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

export interface XPSnapshot {
  totalXP:     number;
  treeXP:      number;
  xpToday:     number;
  xpTodayDate: string;
  fertilizanteAtivo:    boolean;
  fertilizanteExpiraEm: Date | null;
}

export interface XPWrite {
  totalXP:     number;
  treeXP:      number;
  level:       number;
  tier:        string;
  treeStage:   number;
  treeName:    string;
  treeIcon:    string;
  treeProgress: number;
  xpToday:     number;
  xpTodayDate: string;
}

export const XPRepository = {
  async getSnapshot(t: FirebaseFirestore.Transaction, uid: string): Promise<XPSnapshot> {
    const doc  = await t.get(db.collection('users').doc(uid));
    const data = doc.data() ?? {};
    const xp   = data.xp ?? {};
    const arv  = data.progression?.arvore ?? {};
    return {
      totalXP:     xp.totalXP     ?? 0,
      treeXP:      xp.treeXP      ?? 0,
      xpToday:     xp.xpToday     ?? 0,
      xpTodayDate: xp.xpTodayDate ?? '',
      fertilizanteAtivo:    arv.fertilizanteAtivo    === true,
      fertilizanteExpiraEm: arv.fertilizanteExpiraEm?.toDate?.() ?? null,
    };
  },

  write(t: FirebaseFirestore.Transaction, uid: string, data: XPWrite): void {
    t.set(db.collection('users').doc(uid), { xp: { ...data, updatedAt: FieldValue.serverTimestamp() } }, { merge: true });
  },

  writeLog(t: FirebaseFirestore.Transaction, payload: Record<string, unknown>): void {
    t.set(db.collection('xpLog').doc(), { ...payload, timestamp: FieldValue.serverTimestamp(), imutavel: true });
  },

  async isIdempotent(t: FirebaseFirestore.Transaction, key: string): Promise<boolean> {
    const doc = await t.get(db.collection('xpIdempotency').doc(key));
    return doc.exists;
  },

  markIdempotent(t: FirebaseFirestore.Transaction, key: string, uid: string, eventId: string): void {
    t.set(db.collection('xpIdempotency').doc(key), { uid, eventId, timestamp: FieldValue.serverTimestamp() });
  },
};