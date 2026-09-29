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

/**
 * Número finito e não negativo; qualquer outra coisa vira 0.
 *
 * Os campos de xp NÃO são confiáveis como tipo: um totalXP editado
 * no console como TEXTO ("1849") fez o XPService calcular
 * "1849" + 2 = "18492" — concatenação — e a conta saltou do nível 9
 * ao 35, recebendo os marcos 10/20/30.
 */
function toSafeNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

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
      totalXP:     toSafeNumber(xp.totalXP),
      treeXP:      toSafeNumber(xp.treeXP),
      xpToday:     toSafeNumber(xp.xpToday),
      xpTodayDate: typeof xp.xpTodayDate === 'string' ? xp.xpTodayDate : '',
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