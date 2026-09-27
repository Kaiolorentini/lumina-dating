// ============================================
// LUMINA — PROFILE LIKE VALIDATOR v1.0
// functions/src/gamification/validation/ProfileLikeValidator.ts
//
// Regras específicas de PROFILE_LIKE.
// Validações comuns delegadas ao BaseGameEventValidator.
// Anti-farm delegado ao AntiFarmService.
// ============================================

import * as admin from 'firebase-admin';
import { BaseGameEventValidator }  from './BaseGameEventValidator';
import { ValidatorContext }        from '../IGameEventValidator';
import { GameEventType }           from '../GameEventTypes';
import { ValidationError }         from '../ErrorBoundary';
import { AntiFarmService }         from '../antifarm/AntiFarmService';

const db = admin.firestore();

export class ProfileLikeValidator extends BaseGameEventValidator {

  canHandle(eventType: GameEventType): boolean {
    return eventType === 'PROFILE_LIKE';
  }

  async validate(ctx: ValidatorContext): Promise<void> {
    // 1. Validações comuns (uid, targetUid, banido, bloqueado)
    await this.validateCommon(ctx);

    // 2. Verifica se perfil alvo não bloqueou o usuário
    const blockSnap = await db.collection('blocks')
      .where('blockerId', '==', ctx.targetUid)
      .where('blockedId', '==', ctx.uid)
      .limit(1).get();

    if (!blockSnap.empty) {
      throw new ValidationError('TARGET_BLOCKED_LIKER', 'Perfil alvo bloqueou este usuário', false);
    }

    // 3. A curtida precisa EXISTIR. O onProfileLike é chamado pelo
    //    app depois de curtir, e antes nada conferia isso: qualquer
    //    conta o chamava para alvos arbitrários — 5 fragmentos no
    //    Cofre do alvo, XP e ranking para quem chamou, sem curtida
    //    nenhuma.
    //    Só o onCreateMatch grava em likes (rules: write false), no
    //    id `${uid}_${alvo}_${dia}`, com o dia em BRT formatado como
    //    'en-CA' (AAAA-MM-DD). A expressão abaixo é a MESMA de lá:
    //    outra formatação recusaria toda curtida legítima.
    const todayStr = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Sao_Paulo',
    });
    const likeSnap = await db.collection('likes')
      .doc(`${ctx.uid}_${ctx.targetUid}_${todayStr}`)
      .get();

    if (!likeSnap.exists) {
      throw new ValidationError('LIKE_NOT_FOUND', 'Curtida não encontrada', false);
    }

    // 4. Anti-farm: 1 curtida por usuário/perfil/dia
    await AntiFarmService.check({
      eventType: 'PROFILE_LIKE',
      uid:       ctx.uid,
      targetUid: ctx.targetUid,
    });
  }
}