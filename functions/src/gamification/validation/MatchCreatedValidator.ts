// ============================================
// LUMINA — MATCH CREATED VALIDATOR v1.0
// functions/src/gamification/validation/MatchCreatedValidator.ts
//
// Evento mais crítico — nunca criado pelo cliente.
// Só existe após criação real da Sintonia no servidor.
// ============================================

import * as admin from 'firebase-admin';
import { BaseGameEventValidator } from './BaseGameEventValidator';
import { ValidatorContext }       from '../IGameEventValidator';
import { GameEventType }          from '../GameEventTypes';
import { ValidationError }        from '../ErrorBoundary';
import { AntiFarmService }        from '../antifarm/AntiFarmService';

const db = admin.firestore();

export class MatchCreatedValidator extends BaseGameEventValidator {

  canHandle(eventType: GameEventType): boolean {
    return eventType === 'MATCH_CREATED';
  }

  async validate(ctx: ValidatorContext): Promise<void> {
    // 1. Validações comuns
    await this.validateCommon(ctx);

    if (!ctx.targetUid) {
      throw new ValidationError('MISSING_TARGET', 'targetUid obrigatório para MATCH_CREATED', true);
    }

    // 2. Verifica se a Sintonia realmente existe no servidor
    const matchId  = [ctx.uid, ctx.targetUid].sort().join('_');
    const matchDoc = await db.collection('sintonias').doc(matchId).get();

    if (!matchDoc.exists) {
      throw new ValidationError('MATCH_NOT_FOUND', 'Sintonia não encontrada no servidor', true);
    }

    // 3. Verifica se já foi processada pelo Engine (anti-duplicata)
    const matchData = matchDoc.data()!;
    if (matchData.gamificationProcessed === true) {
      throw new ValidationError(
        'MATCH_ALREADY_PROCESSED',
        'Gamificação desta Sintonia já foi processada',
        false
      );
    }

    // 4. Verifica se ambos curtiram (match mútuo real)
    const likedByUid       = matchData.likedBy ?? [];
    const bothLiked        = likedByUid.includes(ctx.uid) && likedByUid.includes(ctx.targetUid);
    if (!bothLiked) {
      throw new ValidationError('NOT_MUTUAL_MATCH', 'Sintonia não é mútua', false);
    }

    // 5. Anti-farm: 1x por par de usuários
    await AntiFarmService.check({
      eventType: 'MATCH_CREATED',
      uid:       ctx.uid,
      targetUid: ctx.targetUid,
    });
  }
}