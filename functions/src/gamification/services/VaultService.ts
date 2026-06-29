// ============================================
// LUMINA — VAULT SERVICE v1.0
// functions/src/gamification/services/VaultService.ts
//
// RESPONSABILIDADE ÚNICA: lógica de negócio do Cofre.
// Não acessa Firestore diretamente — usa VaultRepository.
// ============================================

import * as admin from 'firebase-admin';
import { VaultRepository } from '../repositories/VaultRepository';

const db            = admin.firestore();
const VAULT_MAX     = 5000;
const VAULT_SOURCES: Record<string, number> = {
  PROFILE_VISIT: 2,
  PROFILE_LIKE:  5,
  MATCH_CREATED: 20,
};

export interface VaultServiceResult {
  skipped:   boolean;
  reason?:   string;
  deposited?: number;
  newVault?:  number;
}

export const VaultService = {
  getFragments(eventType: string): number | undefined {
    return VAULT_SOURCES[eventType];
  },

  async process(
    fromUid:   string,
    targetUid: string,
    eventType: string,
    eventId:   string
  ): Promise<VaultServiceResult> {
    const fragments = VAULT_SOURCES[eventType];
    if (!fragments) return { skipped: true, reason: `${eventType} não alimenta o Cofre` };

    const todayStr = new Date().toISOString().slice(0, 10);
    const farmKey  = `vault_${eventType}_${fromUid}_${todayStr}`;

    return db.runTransaction(async (t) => {
      const [snapshot, isDupe] = await Promise.all([
        VaultRepository.getSnapshot(t, targetUid),
        VaultRepository.isFarmDuplicate(t, targetUid, farmKey, todayStr),
      ]);

      if (isDupe)                              return { skipped: true, reason: 'anti-farm: já depositado hoje' };
      if (snapshot.vaultFragments >= VAULT_MAX) return { skipped: true, reason: 'cofre cheio' };

      const canDeposit = Math.min(fragments, VAULT_MAX - snapshot.vaultFragments);
      const newVault   = snapshot.vaultFragments + canDeposit;
      const nowFull    = newVault >= VAULT_MAX;

      const needsNewCycle = !snapshot.vaultUnlockAt || Date.now() > snapshot.vaultUnlockAt.getTime();
      const updates: Record<string, unknown> = { vaultFragments: newVault, vaultLastContribution: admin.firestore.FieldValue.serverTimestamp() };
      if (needsNewCycle) {
        updates.vaultUnlockAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 48 * 3600000));
      }

      VaultRepository.write(t, targetUid, updates);
      VaultRepository.markFarm(t, targetUid, farmKey, todayStr);
      VaultRepository.writeLedger(t, {
        uid: targetUid, fromUid, tipo: 'COFRE_DEPOSITO',
        source: eventType, fragmentos: canDeposit, eventId,
        saldoAntes: snapshot.vaultFragments, saldoDepois: newVault,
      });

      if (nowFull && !snapshot.vaultFullNotified) {
        VaultRepository.writeNotification(t, targetUid, newVault);
        VaultRepository.write(t, targetUid, { vaultFullNotified: true });
      }

      return { skipped: false, deposited: canDeposit, newVault };
    });
  },
};