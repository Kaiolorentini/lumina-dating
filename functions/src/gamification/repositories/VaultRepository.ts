// ============================================
// LUMINA — VAULT REPOSITORY v1.0
// functions/src/gamification/repositories/VaultRepository.ts
//
// RESPONSABILIDADE ÚNICA: acesso ao Firestore para o Cofre.
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

export interface VaultSnapshot {
  vaultFragments:   number;
  vaultUnlockAt:    Date | null;
  vaultFullNotified: boolean;
}

export const VaultRepository = {
  async getSnapshot(t: FirebaseFirestore.Transaction, uid: string): Promise<VaultSnapshot> {
    const doc  = await t.get(db.collection('wallets').doc(uid));
    const data = doc.data() ?? {};
    return {
      vaultFragments:    data.vaultFragments    ?? 0,
      vaultUnlockAt:     data.vaultUnlockAt?.toDate?.() ?? null,
      vaultFullNotified: data.vaultFullNotified ?? false,
    };
  },

  async isFarmDuplicate(t: FirebaseFirestore.Transaction, targetUid: string, farmKey: string, todayStr: string): Promise<boolean> {
    const doc = await t.get(db.collection('vaultControl').doc(`${targetUid}_${todayStr}`));
    return doc.data()?.[farmKey] === true;
  },

  write(t: FirebaseFirestore.Transaction, uid: string, updates: Record<string, unknown>): void {
    t.set(db.collection('wallets').doc(uid), { ...updates, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  },

  markFarm(t: FirebaseFirestore.Transaction, targetUid: string, farmKey: string, todayStr: string): void {
    t.set(db.collection('vaultControl').doc(`${targetUid}_${todayStr}`), {
      [farmKey]: true, updatedAt: FieldValue.serverTimestamp(), targetUid,
    }, { merge: true });
  },

  writeLedger(t: FirebaseFirestore.Transaction, payload: Record<string, unknown>): void {
    t.set(db.collection('economyLedger').doc(), { ...payload, timestamp: FieldValue.serverTimestamp(), imutavel: true });
  },

  writeNotification(t: FirebaseFirestore.Transaction, uid: string, fragments: number): void {
    t.set(db.collection('notifications').doc(), {
      userId: uid, type: 'cofre_cheio', title: '🗝️ Cofre Cheio',
      message: 'Resgate para continuar acumulando.',
      icon: '🗝️', read: false, dados: { fragments },
      timestamp: FieldValue.serverTimestamp(),
    });
  },
};