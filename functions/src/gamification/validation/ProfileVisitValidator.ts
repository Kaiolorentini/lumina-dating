// ============================================
// LUMINA — PROFILE VISIT VALIDATOR v1.0
// functions/src/gamification/validation/ProfileVisitValidator.ts
//
// BLOCO 4 — Regra 2: validador dedicado para PROFILE_VISIT.
// Lança ValidationError se inválido.
// Nunca gera XP nem Fragmentos se falhar.
// ============================================

import * as admin from 'firebase-admin';
import { ValidationError } from '../ErrorBoundary';

const db = admin.firestore();

const DAILY_VISIT_LIMIT = 50;

export interface ProfileVisitInput {
  visitorUid: string;
  targetUid:  string;
}

export const ProfileVisitValidator = {

  async validate(input: ProfileVisitInput): Promise<void> {
    const { visitorUid, targetUid } = input;

    // Auto-visita
    if (visitorUid === targetUid) {
      throw new ValidationError('SELF_VISIT', 'Auto-visita ignorada', false);
    }

    // Busca em paralelo
    const [visitorDoc, targetDoc, blockSnap] = await Promise.all([
      db.collection('users').doc(visitorUid).get(),
      db.collection('users').doc(targetUid).get(),
      db.collection('blocks')
        .where('blockerId', '==', targetUid)
        .where('blockedId', '==', visitorUid)
        .limit(1).get(),
    ]);

    if (!visitorDoc.exists) {
      throw new ValidationError('VISITOR_NOT_FOUND', 'Visitante não encontrado', true);
    }
    if (!targetDoc.exists) {
      throw new ValidationError('TARGET_NOT_FOUND', 'Perfil alvo não encontrado', true);
    }
    if (visitorDoc.data()?.banned === true) {
      throw new ValidationError('VISITOR_BANNED', 'Visitante banido', true);
    }
    if (!blockSnap.empty) {
      throw new ValidationError('VISITOR_BLOCKED', 'Visitante bloqueado pelo dono do perfil', false);
    }

    // Anti-farm diário
    const todayStr  = new Date().toISOString().slice(0, 10);
    const farmDoc   = await db.collection('visitFarmControl').doc(`${visitorUid}_${todayStr}`).get();
    const farmData  = farmDoc.data() ?? {};
    const visitCount = Object.keys(farmData).filter(k => k.startsWith('visited_')).length;

    if (visitCount >= DAILY_VISIT_LIMIT) {
      throw new ValidationError('DAILY_LIMIT', `Limite de ${DAILY_VISIT_LIMIT} visitas únicas/dia atingido`, false);
    }
  },
};