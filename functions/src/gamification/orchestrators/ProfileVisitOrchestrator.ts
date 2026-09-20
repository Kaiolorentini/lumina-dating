// ============================================
// LUMINA — PROFILE VISIT ORCHESTRATOR v1.0
// functions/src/gamification/orchestrators/ProfileVisitOrchestrator.ts
//
// BLOCO 4 — Regra 1+5: intermediário entre emotionalTriggers e Engine.
// Padrão Orchestrator adotado para todo o backend.
// emotionalTriggers.ts nunca conhece o Engine.
//
// Fluxo:
//   1. ProfileVisitValidator (BusinessValidation)
//   2. EmotionalTriggersService (independente)
//   3. GamificationIntegrationService (fire-and-forget)
//
// Regra 6: ErrorBoundary é o único ponto de captura.
// ============================================

import * as admin                        from 'firebase-admin';
import { FieldValue }                    from 'firebase-admin/firestore';
import { ProfileVisitValidator }         from '../validation/ProfileVisitValidator';
import { GamificationIntegrationService } from '../GamificationIntegrationService';
import { handleError }                from '../ErrorBoundary';
import { GameLogger }                    from '../GameLogger';

// Tipos de input do Orchestrator
export interface ProfileVisitOrchestratorInput {
  visitorUid:  string;
  targetUid:   string;
  platform?:   'ios' | 'android' | 'web';
  sessionId?:  string;
  correlationId: string;
  // Função que executa os gatilhos emocionais (injetada — sem acoplamento)
  runEmotionalTriggers: () => Promise<void>;
}

export const ProfileVisitOrchestrator = {

  async execute(input: ProfileVisitOrchestratorInput): Promise<void> {
    const { visitorUid, targetUid, correlationId } = input;
    const errorCtx = { uid: visitorUid, eventId: `visit_${visitorUid}_${targetUid}`, correlationId };

    try {
      // ETAPA 1: BusinessValidation
      await ProfileVisitValidator.validate({ visitorUid, targetUid });

    } catch (error) {
      const boundary = handleError(error, errorCtx);
      // Validação fatal: encerra sem gatilhos e sem gamificação
      if (boundary.fatal) return;
      // Validação não-fatal (ex: auto-visita): encerra silenciosamente
      GameLogger.warn({
        dispatcher: 'ANALYTICS',
        eventId:    errorCtx.eventId,
        uid:        visitorUid,
        message:    `Visita ignorada: ${boundary.message}`,
        warning:    boundary.code,
        meta:       { correlationId, targetUid },
      });
      return;
    }

    // ETAPA 2: Emotional Triggers — totalmente independentes (REGRA 2)
    // Falha dos triggers NÃO cancela a gamificação
    try {
      await input.runEmotionalTriggers();
    } catch (error) {
      handleError(error, errorCtx);
      // Continua mesmo se trigger falhar
    }

    // ETAPA 3: Gamification — fire-and-forget (REGRA 15)
    // Nunca bloqueia. Nunca falha para o usuário.
    GamificationIntegrationService.handleProfileVisit({
      visitorUid,
      targetUid,
      platform:  input.platform,
      sessionId: input.sessionId,
    });

    // ETAPA 4: conquistas EXPLORER_10/50/100.
    //
    // NINGUÉM disparava VISIT_PROFILE — as três conquistas de
    // explorador nunca avançavam. Fica AQUI, e não no
    // registerProfileVisit, porque este Orchestrator já roda
    // depois do ProfileVisitValidator: visita duplicada,
    // auto-visita e bloqueio já foram descartados.
    //
    // Action INCREMENTAL: currentValue é somado ao progresso.
    admin.firestore().collection('achievementTriggers').add({
      uid:          visitorUid,
      action:       'VISIT_PROFILE',
      currentValue: 1,
      processedAt:  null,
      timestamp:    FieldValue.serverTimestamp(),
    }).catch(() => { /* conquista nunca derruba a visita */ });
  },
};