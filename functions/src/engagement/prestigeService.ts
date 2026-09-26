// ============================================
// LUMINA — PRESTIGE SERVICE
// functions/src/engagement/prestigeService.ts
//
// Núcleo interno do prestígio. Substitui a callable
// `grantPrestigePoints`, que era uma BRECHA: qualquer cliente
// podia chamar com `marcoId: 'ACH_FOUNDER'` e ganhar 500
// pontos sem nunca ter sido fundador. A CF não verificava
// nada além da idempotência — confiava que o marco tinha
// acontecido.
//
// Agora cada marco é concedido NO PONTO onde o evento
// realmente acontece: sintonia no MatchService, árvore no
// XPService, coleção no AchievementProcessor. O cliente não
// participa.
//
// DIRETRIZES, mantidas da v5.1:
// ✗ Nunca comprável   ✗ Nunca diminui
// ✗ Nunca afeta economia nem matchmaking
// ✓ Recompensas apenas cosméticas
// ✓ prestigeLog imutável
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  PRESTIGE_FLAGS,
  PRESTIGE_MARCOS,
  calcPrestigeStage,
} from '../config/prestigeTable';

const db = admin.firestore();

export interface GrantMarcoResult {
  granted:    boolean;
  reason?:    string;
  points?:    number;
  newTotal?:  number;
  stagedUp?:  boolean;
  newStage?:  number;
  stageName?: string;
}

export const PrestigeService = {

  /**
   * Concede um marco. Idempotente por natureza: marcos não
   * repetíveis são bloqueados pelo `marcosClaimed`, e os
   * repetíveis pelo `maxTimes`.
   *
   * NUNCA lança: prestígio é cosmético e não pode derrubar a
   * operação que o disparou. Quem chama usa `.catch(() => {})`.
   */
  async grantMarco(uid: string, marcoId: string): Promise<GrantMarcoResult> {
    if (!PRESTIGE_FLAGS.PRESTIGE_ENABLED) {
      return { granted: false, reason: 'disabled' };
    }

    const marco = PRESTIGE_MARCOS[marcoId];
    if (!marco) {
      console.warn(`[PrestigeService] Marco inexistente: ${marcoId}`);
      return { granted: false, reason: 'unknown_marco' };
    }

    const prestigeRef = db.collection('prestige').doc(uid);

    try {
      return await db.runTransaction(async (t) => {
        const doc  = await t.get(prestigeRef);
        const data = doc.data() ?? {};

        const currentPoints = (data.prestigePoints as number | undefined) ?? 0;
        const claimed: string[] = data.marcosClaimed ?? {};
        const counts: Record<string, number> = data.marcosCount ?? {};

        if (!marco.repeatable && Array.isArray(claimed) && claimed.includes(marcoId)) {
          return { granted: false, reason: 'already_claimed' };
        }

        if (marco.repeatable && marco.maxTimes > 0) {
          const count = counts[marcoId] ?? 0;
          if (count >= marco.maxTimes) {
            return { granted: false, reason: 'limit_reached' };
          }
        }

        const newPoints = currentPoints + marco.points;
        const prevStage = calcPrestigeStage(currentPoints);
        const newStage  = calcPrestigeStage(newPoints);
        const stagedUp  = newStage.stage > prevStage.stage;

        const updates: Record<string, unknown> = {
          uid,
          prestigePoints: newPoints,
          prestigeStage:  newStage.stage,
          prestigeName:   newStage.name,
          prestigeIcon:   newStage.icon,
          prestigeAura:   newStage.auraAsset,
          prestigeTitle:  newStage.title,
          updatedAt:      FieldValue.serverTimestamp(),
        };

        if (!marco.repeatable) {
          updates.marcosClaimed = FieldValue.arrayUnion(marcoId);
        } else {
          updates[`marcosCount.${marcoId}`] = FieldValue.increment(1);
        }

        // Legado — linha do tempo. `serverTimestamp` não pode ir
        // dentro de array, por isso o ISO local.
        updates.legado = FieldValue.arrayUnion({
          marcoId,
          label:     marco.label,
          points:    marco.points,
          timestamp: new Date().toISOString(),
        });

        t.set(prestigeRef, updates, { merge: true });

        t.set(db.collection('prestigeLog').doc(), {
          uid, marcoId,
          label:            marco.label,
          category:         marco.category,
          pontos:           marco.points,
          prestigeAnterior: currentPoints,
          prestigeAtual:    newPoints,
          stageAnterior:    prevStage.stage,
          stageAtual:       newStage.stage,
          timestamp:        FieldValue.serverTimestamp(),
          imutavel:         true,
        });

        // Marco conquistado: notificação no sino, sem modal.
        // Marcos são frequentes o bastante para virar ruído se
        // interromperem a tela.
        t.set(db.collection('notifications').doc(), {
          userId:  uid,
          type:    'prestige_marco',
          title:   '✦ Marco de Prestígio',
          message: `${marco.label} · +${marco.points} pontos`,
          icon:    '✦',
          read:    false,
          dados:   { marcoId, points: marco.points, newTotal: newPoints },
          timestamp: FieldValue.serverTimestamp(),
        });

        if (stagedUp) {
          // Subida de estágio: são CINCO na vida inteira. Esta
          // merece o modal, e o cliente o mostra pela flag.
          t.set(db.collection('users').doc(uid), {
            progression: {
              unlockedAuras:          { [newStage.auraAsset]: true },
              availableTitles:        FieldValue.arrayUnion(newStage.title),
              prestigeStage:          newStage.stage,
              prestigeName:           newStage.name,
              pendingPrestigeReveal:  newStage.stage,
            },
          }, { merge: true });

          t.set(db.collection('notifications').doc(), {
            userId:  uid,
            type:    'prestige_stage',
            title:   `${newStage.icon} ${newStage.name}`,
            message: newStage.description,
            icon:    newStage.icon,
            read:    false,
            dados:   {
              prestigeStage: newStage.stage,
              stageName:     newStage.name,
              aura:          newStage.auraAsset,
              title:         newStage.title,
            },
            timestamp: FieldValue.serverTimestamp(),
          });

          t.set(
            db.collection('prestigeAnalytics').doc(`${uid}_stage_${newStage.stage}`),
            {
              uid,
              stage:        newStage.stage,
              stageName:    newStage.name,
              points:       newPoints,
              marcoTrigger: marcoId,
              timestamp:    FieldValue.serverTimestamp(),
            },
          );
        }

        return {
          granted:   true,
          points:    marco.points,
          newTotal:  newPoints,
          stagedUp,
          newStage:  newStage.stage,
          stageName: newStage.name,
        };
      });
    } catch (error) {
      console.warn(`[PrestigeService] Falha ao conceder ${marcoId} para ${uid}:`, error);
      return { granted: false, reason: 'error' };
    }
  },
};
