// ============================================
// LUMINA — MISSION COMPLETED VALIDATOR v1.0
// functions/src/gamification/validation/MissionCompletedValidator.ts
//
// Nunca confiar no cliente.
// Missão validada server-side antes de qualquer recompensa.
// ============================================

import * as admin from 'firebase-admin';
import { BaseGameEventValidator } from './BaseGameEventValidator';
import { ValidatorContext }       from '../IGameEventValidator';
import { GameEventType }          from '../GameEventTypes';
import { ValidationError }        from '../ErrorBoundary';

const db = admin.firestore();

export class MissionCompletedValidator extends BaseGameEventValidator {

  canHandle(eventType: GameEventType): boolean {
    return eventType === 'MISSION_COMPLETED';
  }

  async validate(ctx: ValidatorContext): Promise<void> {
    // 1. Validações comuns
    await this.validateCommon(ctx);

    const missionId = ctx.meta?.missionId as string | undefined;
    if (!missionId) {
      throw new ValidationError('MISSING_MISSION_ID', 'missionId obrigatório', true);
    }

    const todayStr  = new Date().toISOString().slice(0, 10);
    const missionRef = db.collection('dailyMissions').doc(`${ctx.uid}_${todayStr}`);
    const missionDoc = await missionRef.get();

    if (!missionDoc.exists) {
      throw new ValidationError('MISSION_NOT_FOUND', 'Missão não encontrada para hoje', false);
    }

    const data     = missionDoc.data()!;
    const missions = data.missions as Array<{
      id:        string;
      completed: boolean;
      claimed:   boolean;
    }> ?? [];

    const mission = missions.find(m => m.id === missionId);

    if (!mission) {
      throw new ValidationError('MISSION_NOT_ASSIGNED', 'Missão não atribuída a este usuário', false);
    }

    if (!mission.completed) {
      throw new ValidationError('MISSION_NOT_COMPLETED', 'Missão ainda não completada', false);
    }

    if (mission.claimed) {
      throw new ValidationError('MISSION_ALREADY_CLAIMED', 'Recompensa já resgatada', false);
    }
  }
}