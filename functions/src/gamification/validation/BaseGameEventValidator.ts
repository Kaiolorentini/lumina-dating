// ============================================
// LUMINA — BASE GAME EVENT VALIDATOR v1.0
// functions/src/gamification/validation/BaseGameEventValidator.ts
//
// BLOCO 5 — Validações comuns a todos os eventos.
// Validators específicos herdam desta classe.
// ============================================

import * as admin from 'firebase-admin';
import { IGameEventValidator, ValidatorContext } from '../IGameEventValidator';
import { GameEventType }  from '../GameEventTypes';
import { ValidationError } from '../ErrorBoundary';

const db = admin.firestore();

export abstract class BaseGameEventValidator implements IGameEventValidator {
  abstract canHandle(eventType: GameEventType): boolean;

  // Valida campos comuns — chamado por todos os Validators
  protected async validateCommon(ctx: ValidatorContext): Promise<void> {
    if (!ctx.uid) {
      throw new ValidationError('MISSING_UID', 'uid obrigatório', true);
    }
    if (!ctx.correlationId) {
      throw new ValidationError('MISSING_CORRELATION_ID', 'correlationId obrigatório', true);
    }

    // Verifica se usuário existe e não está banido
    const userDoc = await db.collection('users').doc(ctx.uid).get();
    if (!userDoc.exists) {
      throw new ValidationError('USER_NOT_FOUND', 'Usuário não encontrado', true);
    }
    if (userDoc.data()?.banned === true) {
      throw new ValidationError('USER_BANNED', 'Usuário banido', true);
    }

    // Valida targetUid se presente
    if (ctx.targetUid) {
      if (ctx.uid === ctx.targetUid) {
        throw new ValidationError('SELF_ACTION', `Auto-ação não permitida em ${ctx.eventType}`, false);
      }
      const targetDoc = await db.collection('users').doc(ctx.targetUid).get();
      if (!targetDoc.exists) {
        throw new ValidationError('TARGET_NOT_FOUND', 'Perfil alvo não encontrado', true);
      }
    }
  }

  // Subclasses implementam regras específicas
  abstract validate(ctx: ValidatorContext): Promise<void>;
}