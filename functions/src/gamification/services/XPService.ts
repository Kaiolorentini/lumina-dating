// ============================================
// LUMINA — XP SERVICE v3.0
// functions/src/gamification/services/XPService.ts
//
// SPRINT 1C — v3.0: computeOnly() renomeado para simulate().
// simulate() deixa explícito: ZERO persistência, nunca.
// process() = calcula + persiste (modo ENGINE).
// ============================================

import * as admin from 'firebase-admin';
import { XPRepository } from '../repositories/XPRepository';
import { XP_ACTION_VALUES, DAILY_XP_MAX } from '../../config/xpValues';
import { XP_MULTIPLIERS }                  from '../../config/xpMultipliers';
import { calcLevel }                       from '../../config/xpTable';
import { calcTreeStage }                   from '../../config/treeTable';
import { todayBr }                         from '../../utils/dateBr';
import { FieldValue }                       from 'firebase-admin/firestore';

const db = admin.firestore();

export const EVENT_TO_XP_ACTION: Record<string, string> = {
  PROFILE_VISIT:     'VISIT_PROFILE',
  PROFILE_LIKE:      'GIVE_LIKE',
  MATCH_CREATED:     'CREATE_SINTONIA',
  MESSAGE_REPLY:     'START_CONVO',
  MISSION_COMPLETED: 'COMPLETE_MISSION',
};

export interface XPServiceResult {
  skipped:     boolean;
  reason?:     string;
  xpGained?:   number;
  treeGain?:   number;
  newTotalXP?: number;
  newLevel?:   number;
  leveledUp?:  boolean;
  stageUp?:    boolean;
  newStage?:   number;
}

export const XPService = {
  getActionKey(eventType: string): string | undefined {
    return EVENT_TO_XP_ACTION[eventType];
  },

  // SPRINT 1C: renomeado de computeOnly() para simulate().
  // ZERO persistência — usado apenas em modo SHADOW para comparação.
  async simulate(uid: string, eventId: string, eventType: string): Promise<XPServiceResult> {
    const actionKey = EVENT_TO_XP_ACTION[eventType];
    if (!actionKey) return { skipped: true, reason: `Sem ação XP para ${eventType}` };

    const actionDef = XP_ACTION_VALUES[actionKey];
    if (!actionDef) return { skipped: true, reason: `Ação ${actionKey} não encontrada` };

    const todayStr = todayBr();
    const userDoc  = await db.collection('users').doc(uid).get();
    const data     = userDoc.data() ?? {};
    const xp       = data.xp ?? {};
    const arv      = data.progression?.arvore ?? {};

    const totalXP        = xp.totalXP ?? 0;
    const currentXPToday = xp.xpTodayDate === todayStr ? (xp.xpToday ?? 0) : 0;
    if (currentXPToday >= DAILY_XP_MAX) return { skipped: true, reason: 'Limite diário atingido' };

    const fertAtivo  = arv.fertilizanteAtivo === true;
    const fertExpira = arv.fertilizanteExpiraEm?.toDate?.() ?? null;
    const fertActive = fertAtivo && fertExpira && fertExpira > new Date();
    const multiplier = fertActive ? XP_MULTIPLIERS.FERTILIZER : XP_MULTIPLIERS.NORMAL;
    const xpGained   = Math.min(Math.floor(actionDef.xp * multiplier), DAILY_XP_MAX - currentXPToday);
    const newTotalXP = totalXP + xpGained;
    const newLevel   = calcLevel(newTotalXP);

    return { skipped: false, xpGained, newTotalXP, newLevel: newLevel.level };
  },

  // Calcula + persiste — usado em modo ENGINE
  async process(uid: string, eventId: string, eventType: string): Promise<XPServiceResult> {
    const actionKey = EVENT_TO_XP_ACTION[eventType];
    if (!actionKey) return { skipped: true, reason: `Sem ação XP para ${eventType}` };

    const actionDef = XP_ACTION_VALUES[actionKey];
    if (!actionDef) return { skipped: true, reason: `Ação ${actionKey} não encontrada` };

    // Mesma fronteira do earnXP — se divergirem, um caminho zera
    // o contador que o outro ainda considera cheio.
    const todayStr = todayBr();
    const idempKey = `${uid}_${eventId}`;

    const result = await db.runTransaction(async (t) => {
      const [snapshot, isDupe] = await Promise.all([
        XPRepository.getSnapshot(t, uid),
        XPRepository.isIdempotent(t, idempKey),
      ]);

      if (isDupe) return { skipped: true, reason: 'XP já concedido para este evento' };

      const currentXPToday = snapshot.xpTodayDate === todayStr ? snapshot.xpToday : 0;
      if (currentXPToday >= DAILY_XP_MAX) return { skipped: true, reason: 'Limite diário de XP atingido' };

      const fertActive = snapshot.fertilizanteAtivo &&
        snapshot.fertilizanteExpiraEm !== null &&
        snapshot.fertilizanteExpiraEm > new Date();

      const multiplier = fertActive ? XP_MULTIPLIERS.FERTILIZER : XP_MULTIPLIERS.NORMAL;
      const xpGained   = Math.min(Math.floor(actionDef.xp * multiplier), DAILY_XP_MAX - currentXPToday);
      const treeGain   = actionDef.treeXP > 0 ? Math.floor(actionDef.treeXP * multiplier) : 0;

      const newTotalXP = snapshot.totalXP + xpGained;
      const newTreeXP  = snapshot.treeXP  + treeGain;
      const prevLevel  = calcLevel(snapshot.totalXP);
      const newLevel   = calcLevel(newTotalXP);
      const prevTree   = calcTreeStage(snapshot.treeXP);
      const newTree    = calcTreeStage(newTreeXP);

      XPRepository.write(t, uid, {
        totalXP:     newTotalXP,
        treeXP:      newTreeXP,
        level:       newLevel.level,
        tier:        newLevel.tier,
        treeStage:   newTree.current.stage,
        treeName:    newTree.current.name,
        treeIcon:    newTree.current.icon,
        treeProgress: newTree.progress,
        xpToday:     currentXPToday + xpGained,
        xpTodayDate: todayStr,
      });

      XPRepository.markIdempotent(t, idempKey, uid, eventId);

      XPRepository.writeLog(t, {
        uid, origem: actionKey, actionId: eventId,
        category: actionDef.category, xpRecebido: xpGained,
        treeXPRecebido: treeGain, multiplicador: multiplier,
        xpAnterior: snapshot.totalXP, xpAtual: newTotalXP,
      });

      const stageUp = newTree.current.stage > prevTree.current.stage;

      // ── EVOLUÇÃO DA ÁRVORE ──
      //
      // O `engagement/xp.ts` (caminho do cliente) paga a
      // recompensa do estágio e notifica; este Service não fazia
      // nem uma coisa nem outra. Como a árvore passou a crescer
      // pelo Engine, quem evoluía NÃO RECEBIA NADA e a conquista
      // TREE_STAGE_1/4 nunca era disparada.
      //
      // A recompensa é gravada aqui, inline, e não pelo
      // grantTreeStageReward: ele faz um t.get() e o Firestore
      // exige todas as leituras ANTES das escritas — nesta altura
      // da transação já escrevemos.
      if (stageUp) {
        const reward = newTree.current.reward;
        const userRef = db.collection('users').doc(uid);

        if (reward.type === 'crystals' && typeof reward.value === 'number') {
          t.set(
            db.collection('wallets').doc(uid),
            {
              coinsGratuitos: FieldValue.increment(reward.value),
              updatedAt:      FieldValue.serverTimestamp(),
            },
            { merge: true },
          );

          t.set(db.collection('economyLedger').doc(), {
            uid,
            tipo:      'ARVORE_RECOMPENSA',
            origem:    'XPService',
            stage:     newTree.current.stage,
            stageName: newTree.current.name,
            cristais:  reward.value,
            timestamp: FieldValue.serverTimestamp(),
            imutavel:  true,
          });
        } else if (reward.type === 'badge' || reward.type === 'frame') {
          t.set(
            userRef,
            {
              progression: {
                unlockedItems: { [`${reward.type}_${reward.value}`]: true },
              },
            },
            { merge: true },
          );
        } else if (reward.type === 'animation') {
          t.set(
            userRef,
            { progression: { unlockedAnimations: { [String(reward.value)]: true } } },
            { merge: true },
          );
        }

        // Marca a recompensa como concedida, igual ao xp.ts.
        t.set(
          userRef,
          { [`xp.stageRewardsClaimed.stage_${newTree.current.stage}`]: true },
          { merge: true },
        );

        t.set(db.collection('notifications').doc(), {
          userId:    uid,
          type:      'tree_evolution',
          title:     `${newTree.current.icon} Árvore evoluiu!`,
          message:   `Estágio ${newTree.current.name} desbloqueado! ${reward.label}`,
          icon:      newTree.current.icon,
          read:      false,
          dados:     { stage: newTree.current.stage, reward },
          timestamp: FieldValue.serverTimestamp(),
        });
      }

      return {
        skipped:    false,
        xpGained,
        treeGain,
        newTotalXP,
        newLevel:   newLevel.level,
        leveledUp:  newLevel.level > prevLevel.level,
        stageUp,
        newStage:   newTree.current.stage,
      };
    });

    // Conquista TREE_STAGE_1/4 — FORA da transação, como o
    // engagement/xp.ts faz. TREE_EVOLUTION é action ABSOLUTA no
    // AchievementProcessor: currentValue vai direto contra o
    // target, sem somar.
    if (result.stageUp && result.newStage !== undefined) {
      db.collection('achievementTriggers').add({
        uid,
        action:       'TREE_EVOLUTION',
        currentValue: result.newStage,
        processedAt:  null,
        timestamp:    FieldValue.serverTimestamp(),
      }).catch(() => { /* conquista nunca derruba o XP */ });
    }

    return result;
  },
};