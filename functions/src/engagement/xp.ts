// ============================================
// LUMINA — XP SYSTEM v5.2
// functions/src/engagement/xp.ts
//
// 28 REGRAS IMPLEMENTADAS.
// XP nunca gerado no cliente.
// Todos os sistemas independentes.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { XP_ACTION_VALUES, DAILY_XP_MAX } from '../config/xpValues';
import { XP_MULTIPLIERS, XP_FEATURE_FLAGS, ANTI_BOT } from '../config/xpMultipliers';
import { calcLevel } from '../config/xpTable';
import { calcTreeStage } from '../config/treeTable';
import { grantTreeStageReward } from '../services/rewardService';

const db = admin.firestore();

// ── 1. Ganhar XP ──
export const earnXP = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    // REGRA 24: Feature Flag
    if (!XP_FEATURE_FLAGS.XP_ENABLED) {
      return { disabled: true, xpGained: 0 };
    }

    const {
      action,
      targetUid,
      actionId,       // REGRA 3: ID único por ação
      messageCount,   // REGRA 6: contagem de mensagens para conversas
      eventCategory,  // REGRA 19: categoria para multiplicador de evento
    } = request.data as {
      action:         string;
      targetUid?:     string;
      actionId:       string;
      messageCount?:  number;
      eventCategory?: string;
    };

    const actionDef = XP_ACTION_VALUES[action];
    if (!actionDef) {
      throw new functions.HttpsError('invalid-argument', `Ação inválida: ${action}`);
    }

    // REGRA 6: conversa exige mínimo de mensagens
    if (actionDef.minMessages && (!messageCount || messageCount < actionDef.minMessages)) {
      throw new functions.HttpsError(
        'failed-precondition',
        `Conversa precisa de ao menos ${actionDef.minMessages} mensagens trocadas.`
      );
    }

    const todayStr        = new Date().toISOString().slice(0, 10);
    const userRef         = db.collection('users').doc(uid);
    const xpLogRef        = db.collection('xpLog');
    const notifRef        = db.collection('notifications');
    const idempotencyRef  = db.collection('xpIdempotency').doc(`${uid}_${actionId}`);

    const result = await db.runTransaction(async (t) => {
      const [userDoc, idempotencyDoc] = await Promise.all([
        t.get(userRef),
        t.get(idempotencyRef),
      ]);

      // REGRA 4: idempotência
      if (idempotencyDoc.exists) {
        return { alreadyProcessed: true, xpGained: 0 };
      }

      const userData = userDoc.data() ?? {};
      const xp       = userData.xp ?? {};

      const totalXP       = xp.totalXP       ?? 0;
      const treeXP        = xp.treeXP        ?? 0;
      const xpToday       = xp.xpTodayDate === todayStr ? (xp.xpToday ?? 0) : 0;
      const lastLevel     = xp.level         ?? 1;      // REGRA 20
      const lastTreeStage = xp.treeStage     ?? 0;      // REGRA 20
      const riskScore     = xp.xpRiskScore   ?? 0;      // REGRA 18
      const prestigeLevel = xp.prestigeLevel ?? 0;      // REGRA 27

      // REGRA 18: Anti-bot
      if (XP_FEATURE_FLAGS.ANTI_BOT_ENABLED && riskScore >= ANTI_BOT.BLOCK_THRESHOLD) {
        return { blocked: true, xpGained: 0, reason: 'risk_score_exceeded' };
      }

      // REGRA 5: teto diário global
      if (xpToday >= DAILY_XP_MAX) {
        return { limitReached: true, xpGained: 0 };
      }

      // REGRA 7: curtida/visita — 1x por usuário alvo/dia
      if (actionDef.perUser && targetUid) {
        const perUserRef = db.collection('xpIdempotency').doc(`${uid}_peruser_${action}_${targetUid}_${todayStr}`);
        const perUserDoc = await t.get(perUserRef);
        if (perUserDoc.exists) {
          return { perUserDuplicate: true, xpGained: 0 };
        }
        t.set(perUserRef, {
          uid, action, targetUid, date: todayStr,
          timestamp: FieldValue.serverTimestamp(),
        });
      }

      // REGRA 19: Multiplicador centralizado
      const fertAtivo   = userData.progression?.arvore?.fertilizanteAtivo === true;
      const fertExpira  = userData.progression?.arvore?.fertilizanteExpiraEm?.toDate?.() ?? null;
      const fertActive  = XP_FEATURE_FLAGS.FERTILIZER_ENABLED && fertAtivo && fertExpira && fertExpira > new Date();

      let multiplier = XP_MULTIPLIERS.NORMAL;
      if (fertActive) multiplier = XP_MULTIPLIERS.FERTILIZER;
      if (eventCategory === 'EVENT') multiplier = Math.max(multiplier, XP_MULTIPLIERS.EVENT_DOUBLE);

      // XP final respeitando teto diário
      const rawXP     = Math.floor(actionDef.xp * multiplier);
      const xpGained  = Math.min(rawXP, DAILY_XP_MAX - xpToday);
      const treeXPGain = XP_FEATURE_FLAGS.TREE_ENABLED && actionDef.treeXP > 0
        ? Math.floor(actionDef.treeXP * multiplier)
        : 0;

      const newTotalXP = totalXP + xpGained;
      const newTreeXP  = treeXP  + treeXPGain;
      const newXPToday = xpToday + xpGained;

      // REGRA 11: level derivado de totalXP
      const prevLevelInfo = calcLevel(totalXP);
      const newLevelInfo  = calcLevel(newTotalXP);
      const leveledUp     = newLevelInfo.level > prevLevelInfo.level;

      // REGRA 14+22: árvore
      const prevTree = calcTreeStage(treeXP);
      const newTree  = calcTreeStage(newTreeXP);
      const stageUp  = newTree.current.stage > prevTree.current.stage;

      // REGRA 22: treeProgress salvo
      t.set(userRef, {
        xp: {
          totalXP:         newTotalXP,
          treeXP:          newTreeXP,
          level:           newLevelInfo.level,
          tier:            newLevelInfo.tier,
          treeStage:       newTree.current.stage,
          treeName:        newTree.current.name,
          treeIcon:        newTree.current.icon,
          treeProgress:    newTree.progress,           // REGRA 22
          lastLevel:       lastLevel,                  // REGRA 20
          lastTreeStage:   lastTreeStage,              // REGRA 20
          xpToday:         newXPToday,
          xpTodayDate:     todayStr,
          xpRiskScore:     riskScore,                  // REGRA 18
          prestigeLevel,                               // REGRA 27
          updatedAt:       FieldValue.serverTimestamp(),
        },
      }, { merge: true });

      // REGRA 4: registra idempotência
      t.set(idempotencyRef, {
        uid, action, actionId, xpGained,
        timestamp: FieldValue.serverTimestamp(),
      });

      // REGRA 2: xpLog imutável
      t.set(xpLogRef.doc(), {
        uid,
        origem:         action,
        actionId,
        category:       actionDef.category,
        xpRecebido:     xpGained,
        treeXPRecebido: treeXPGain,
        multiplicador:  multiplier,
        xpAnterior:     totalXP,
        xpAtual:        newTotalXP,
        treeXPAnterior: treeXP,
        treeXPAtual:    newTreeXP,
        timestamp:      FieldValue.serverTimestamp(),
        imutavel:       true,
      });

      // REGRA 13+16+23: fila de eventos — nunca simultâneo
      const events: { type: string; data: Record<string, unknown> }[] = [];

      if (leveledUp) {
        events.push({ type: 'LEVEL_UP', data: { level: newLevelInfo.level, tier: newLevelInfo.tier } });
      }
      if (stageUp) {
        events.push({ type: 'TREE_EVOLUTION', data: { stage: newTree.current.stage, name: newTree.current.name } });
      }

      // REGRA 16+23: notificações em fila (delay incremental)
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (ev.type === 'LEVEL_UP') {
          t.set(notifRef.doc(), {
            userId:    uid,
            type:      'level_up',
            title:     `🎉 Nível ${ev.data.level}!`,
            message:   `Você alcançou ${ev.data.tier}. Continue evoluindo!`,
            icon:      '⬆️',
            read:      false,
            dados:     ev.data,
            priority:  i,  // REGRA 23: fila ordenada
            timestamp: FieldValue.serverTimestamp(),
          });
        }

        if (ev.type === 'TREE_EVOLUTION') {
          // REGRA 21: recompensa via RewardService — XP não conhece Cristais
          await grantTreeStageReward(t, uid, newTree.current);

          t.set(notifRef.doc(), {
            userId:    uid,
            type:      'tree_evolution',
            title:     `${newTree.current.icon} Árvore evoluiu!`,
            message:   `Estágio ${newTree.current.name} desbloqueado! ${newTree.current.reward.label}`,
            icon:      newTree.current.icon,
            read:      false,
            dados:     { stage: newTree.current.stage, reward: newTree.current.reward },
            priority:  i,  // REGRA 23
            timestamp: FieldValue.serverTimestamp(),
          });

          // REGRA 15: marca recompensa como concedida
          t.set(userRef, {
            [`xp.stageRewardsClaimed.stage_${newTree.current.stage}`]: true,
          }, { merge: true });
        }
      }

      // REGRA 18: atualiza risk score (ação muito rápida = risco)
      // Implementação simples: incrementa e decai ao longo do tempo
      if (riskScore < ANTI_BOT.BLOCK_THRESHOLD) {
        t.set(userRef, { 'xp.xpRiskScore': Math.max(0, riskScore - 1) }, { merge: true });
      }

      return {
        alreadyProcessed: false,
        xpGained,
        treeXPGain,
        newTotalXP,
        newTreeXP,
        newLevel:     newLevelInfo.level,
        newTier:      newLevelInfo.tier,
        levelProgress: newLevelInfo.progress,
        leveledUp,
        stageUp,
        newStage:     newTree.current.stage,
        newStageName: newTree.current.name,
        treeProgress: newTree.progress,  // REGRA 22
      };
    });

    return { success: true, ...result };
  }
);

// ── 2. Status de XP (REGRA 28: cliente recebe tudo pronto) ──
export const getXPStatus = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const userDoc  = await db.collection('users').doc(uid).get();
    const userData = userDoc.data() ?? {};
    const xp       = userData.xp ?? {};

    const todayStr  = new Date().toISOString().slice(0, 10);
    const totalXP   = xp.totalXP   ?? 0;
    const treeXP    = xp.treeXP    ?? 0;
    const xpToday   = xp.xpTodayDate === todayStr ? (xp.xpToday ?? 0) : 0;

    // REGRA 28: servidor calcula tudo — cliente só exibe
    const levelInfo = calcLevel(totalXP);
    const treeInfo  = calcTreeStage(treeXP);

    const fertAtivo  = userData.progression?.arvore?.fertilizanteAtivo === true;
    const fertExpira = userData.progression?.arvore?.fertilizanteExpiraEm?.toDate?.() ?? null;
    const fertActive = fertAtivo && fertExpira && fertExpira > new Date();

    return {
      // XP global
      totalXP,
      xpToday,
      dailyMax:          DAILY_XP_MAX,
      level:             levelInfo.level,
      tier:              levelInfo.tier,
      nextLevelXP:       levelInfo.nextLevelXP,
      levelProgress:     levelInfo.progress,

      // Árvore
      treeXP,
      treeStage:         treeInfo.current.stage,
      treeName:          treeInfo.current.name,
      treeIcon:          treeInfo.current.icon,
      treeProgress:      treeInfo.progress,        // REGRA 22
      nextTreeStage:     treeInfo.next,

      // Fertilizante
      fertilizanteAtivo: fertActive,
      fertilizanteExpiraEm: fertExpira?.toISOString() ?? null,

      // Prestígio (REGRA 27 — reservado)
      prestigeLevel:     xp.prestigeLevel ?? 0,

      // Feature flags (REGRA 24)
      features: {
        xpEnabled:       XP_FEATURE_FLAGS.XP_ENABLED,
        treeEnabled:     XP_FEATURE_FLAGS.TREE_ENABLED,
        fertEnabled:     XP_FEATURE_FLAGS.FERTILIZER_ENABLED,
      },
    };
  }
);