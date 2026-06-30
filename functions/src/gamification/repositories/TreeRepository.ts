// ============================================
// LUMINA — TREE REPOSITORY v1.0
// functions/src/gamification/repositories/TreeRepository.ts
//
// SPRINT 1A — Acesso ao Firestore para Árvore de Progressão.
// Mesma estrutura do legado: users/{uid}.progression.arvore
// Nenhuma regra de negócio aqui.
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

export interface TreeSnapshot {
  treeXP:    number;
  treeStage: number;
}

export const TreeRepository = {
  async getSnapshot(uid: string): Promise<TreeSnapshot> {
    const doc  = await db.collection('users').doc(uid).get();
    const xp   = doc.data()?.xp ?? {};
    return {
      treeXP:    xp.treeXP    ?? 0,
      treeStage: xp.treeStage ?? 0,
    };
  },

  async getSnapshotInTransaction(t: FirebaseFirestore.Transaction, uid: string): Promise<TreeSnapshot> {
    const doc = await t.get(db.collection('users').doc(uid));
    const xp  = doc.data()?.xp ?? {};
    return {
      treeXP:    xp.treeXP    ?? 0,
      treeStage: xp.treeStage ?? 0,
    };
  },

  writeStage(t: FirebaseFirestore.Transaction, uid: string, treeStage: number, treeName: string, treeIcon: string, treeProgress: number): void {
    t.set(db.collection('users').doc(uid), {
      xp: { treeStage, treeName, treeIcon, treeProgress, updatedAt: FieldValue.serverTimestamp() },
    }, { merge: true });
  },

  writeNotification(t: FirebaseFirestore.Transaction, uid: string, payload: Record<string, unknown>): void {
    t.set(db.collection('notifications').doc(), {
      userId: uid, type: 'tree_evolution', read: false,
      ...payload, timestamp: FieldValue.serverTimestamp(),
    });
  },
};