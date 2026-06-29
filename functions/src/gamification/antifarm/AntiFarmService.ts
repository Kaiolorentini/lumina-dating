// ============================================
// LUMINA — ANTI FARM SERVICE v1.0
// functions/src/gamification/antifarm/AntiFarmService.ts
//
// BLOCO 5 — Única fonte de verdade anti-farm.
// Validators nunca implementam regras anti-farm.
// Todos chamam este serviço.
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { GameEventType }                        from '../GameEventTypes';
import { getPolicyForFarm }   from './AntiFarmPolicy';
import { ValidationError }                      from '../ErrorBoundary';

const db = admin.firestore();

export interface AntiFarmContext {
  eventType:  GameEventType;
  uid:        string;
  targetUid?: string;
}

export const AntiFarmService = {

  // Verifica e registra — lança ValidationError se farm detectado
  async check(ctx: AntiFarmContext): Promise<void> {
    const policy = getPolicyForFarm(ctx.eventType);
    if (!policy) return; // sem política = sem restrição

    const todayStr  = new Date().toISOString().slice(0, 10);
    const controlId = `${ctx.uid}_${todayStr}`;
    const controlRef = db.collection(policy.collectionPath).doc(controlId);
    const controlDoc = await controlRef.get();
    const control    = controlDoc.data() ?? {};

    // Verifica cooldown por targetUid (1x por alvo/dia)
    if (policy.perTargetCooldown && ctx.targetUid) {
      const farmKey = `${ctx.eventType}_${ctx.targetUid}`;
      if (control[farmKey] === true) {
        throw new ValidationError(
          'ANTI_FARM_DUPLICATE',
          `${ctx.eventType} já registrado para este alvo hoje`,
          false
        );
      }
    }

    // Verifica limite diário total
    if (policy.maxPerDay > 0) {
      const dailyCount = control[`${ctx.eventType}_count`] ?? 0;
      if (dailyCount >= policy.maxPerDay) {
        throw new ValidationError(
          'ANTI_FARM_DAILY_LIMIT',
          `Limite diário de ${policy.maxPerDay} atingido para ${ctx.eventType}`,
          false
        );
      }
    }
  },

  // Registra a ação após validação bem-sucedida
  async register(ctx: AntiFarmContext): Promise<void> {
    const policy = getPolicyForFarm(ctx.eventType);
    if (!policy) return;

    const todayStr   = new Date().toISOString().slice(0, 10);
    const controlId  = `${ctx.uid}_${todayStr}`;
    const controlRef = db.collection(policy.collectionPath).doc(controlId);

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      date:      todayStr,
      uid:       ctx.uid,
      [`${ctx.eventType}_count`]: FieldValue.increment(1),
    };

    if (policy.perTargetCooldown && ctx.targetUid) {
      updates[`${ctx.eventType}_${ctx.targetUid}`] = true;
    }

    await controlRef.set(updates, { merge: true });
  },
};