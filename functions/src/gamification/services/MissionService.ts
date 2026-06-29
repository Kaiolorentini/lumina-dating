// ============================================
// LUMINA — MISSION SERVICE v1.0
// functions/src/gamification/services/MissionService.ts
//
// Responsabilidade: concluir missão e entregar fragmentos.
// Fragmentos entregues ANTES de chamar o Engine.
// Emite MISSION_COMPLETED via GamificationIntegrationService.
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ValidationError } from '../ErrorBoundary';

const db = admin.firestore();

export interface MissionRewardResult {
  missionId:       string;
  missionCategory: string;
  fragmentsEarned: number;
}

export const MissionService = {

  // Marca missão como resgatada e entrega fragmentos — dentro de transaction
  async claimReward(uid: string, missionId: string): Promise<MissionRewardResult> {
    const todayStr   = new Date().toISOString().slice(0, 10);
    const missionRef = db.collection('dailyMissions').doc(`${uid}_${todayStr}`);
    const walletRef  = db.collection('wallets').doc(uid);
    const ledgerRef  = db.collection('economyLedger');

    return db.runTransaction(async (t) => {
      const [missionDoc, walletDoc] = await Promise.all([
        t.get(missionRef),
        t.get(walletRef),
      ]);

      if (!missionDoc.exists) {
        throw new ValidationError('MISSION_NOT_FOUND', 'Missão não encontrada', false);
      }

      const data     = missionDoc.data()!;
      const missions = data.missions as Array<{
        id:        string;
        category:  string;
        completed: boolean;
        claimed:   boolean;
        fragments: number;
      }> ?? [];

      const idx     = missions.findIndex(m => m.id === missionId);
      const mission = missions[idx];

      if (!mission) throw new ValidationError('MISSION_NOT_ASSIGNED', 'Missão não encontrada', false);
      if (!mission.completed) throw new ValidationError('MISSION_NOT_COMPLETED', 'Missão não completada', false);
      if (mission.claimed)    throw new ValidationError('MISSION_ALREADY_CLAIMED', 'Já resgatado', false);

      const fragments    = mission.fragments ?? 0;
      const prevFrags    = walletDoc.data()?.fragments ?? 0;

      // Marca como resgatada
      const updatedMissions = [...missions];
      updatedMissions[idx]  = { ...mission, claimed: true };
      t.set(missionRef, { missions: updatedMissions }, { merge: true });

      // Entrega fragmentos na wallet
      t.set(walletRef, {
        fragments: FieldValue.increment(fragments),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // Ledger imutável
      t.set(ledgerRef.doc(), {
        uid,
        tipo:        'MISSION_REWARD',
        missionId,
        fragmentos:  fragments,
        saldoAntes:  prevFrags,
        saldoDepois: prevFrags + fragments,
        timestamp:   FieldValue.serverTimestamp(),
        imutavel:    true,
      });

      return {
        missionId,
        missionCategory: mission.category ?? 'MISSION',
        fragmentsEarned: fragments,
      };
    });
  },
};