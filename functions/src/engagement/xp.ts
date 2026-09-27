// ============================================
// LUMINA — XP SYSTEM v5.4
// functions/src/engagement/xp.ts
//
// v5.4 — earnXP FECHADO AO QUE O APP REALMENTE USA.
//
// O cliente escolhia a ação, o alvo, a chave de idempotência,
// o multiplicador (eventCategory: 'EVENT' = XP em dobro) e
// DECLARAVA quantas mensagens houve. Qualquer ação da tabela —
// inclusive CREATE_SINTONIA, 50 de treeXP — era pedida à
// vontade até o teto diário, e a Árvore chegava à Galáxia em
// dias, com recompensas de cada estágio.
//
// Agora:
//   • só START_CONVO e UNLOCK_ACHIEVEMENT vêm do app — o resto é
//     creditado pelo Engine, no servidor, quando o evento ocorre;
//   • a chave é do servidor: uid + ação + alvo, uma vez por par;
//   • o alvo precisa existir;
//   • START_CONVO exige mensagem dos DOIS lados no chat —
//     conferido aqui, não declarado pelo app;
//   • multiplicador só do fertilizante, lido do documento.
//
// BUG CORRIGIDO: a recompensa do estágio (grantTreeStageReward)
// faz t.get() e rodava DEPOIS de escritas na transação — o
// Firestore exige todas as leituras antes, e a chamada falhava
// justamente quando a Árvore evoluía. Agora roda antes de
// qualquer escrita.
//
// BUG CORRIGIDO: set com merge NÃO interpreta ponto no nome do
// campo — `xp.stageRewardsClaimed.stage_N` virava um campo com
// esse nome literal. Agora é o mapa aninhado.
//
// XP nunca gerado no cliente.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { XP_ACTION_VALUES, DAILY_XP_MAX } from '../config/xpValues';
import { XP_MULTIPLIERS, XP_FEATURE_FLAGS, ANTI_BOT } from '../config/xpMultipliers';
import { calcLevel } from '../config/xpTable';
import { calcTreeStage, TREE_STAGE_TABLE } from '../config/treeTable';
import { grantTreeStageReward } from '../services/rewardService';
import { todayBr } from '../utils/dateBr';

const db = admin.firestore();

/**
 * Únicas ações que o APP pode pedir. Visita, curtida, sintonia,
 * missão e resposta são creditadas pelo Engine, no servidor —
 * aceitá-las aqui também as creditaria em dobro.
 */
const CLIENT_ACTIONS: ReadonlySet<string> = new Set([
  'START_CONVO',          // ChatScreen, via engagementService.onMessageSent
  'UNLOCK_ACHIEVEMENT',   // ProgressiveGallery, via engagementService.onContentUnlocked
]);

/** Mesmo formato das rules (isChatMember) e do messageService. */
function chatIdFor(a: string, b: string): string {
  return [a, b].sort().join('_');
}

/** Conversa real: ao menos uma mensagem de CADA lado. */
async function hasRealConversation(uid: string, targetUid: string): Promise<boolean> {
  const messages = db.collection('chats').doc(chatIdFor(uid, targetUid)).collection('messages');
  const [mine, theirs] = await Promise.all([
    messages.where('senderId', '==', uid).limit(1).get(),
    messages.where('senderId', '==', targetUid).limit(1).get(),
  ]);
  return !mine.empty && !theirs.empty;
}

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

    // actionId, messageCount e eventCategory ainda chegam de
    // versões antigas do app — e são IGNORADOS de propósito.
    const { action, targetUid } = request.data as {
      action?:    unknown;
      targetUid?: unknown;
    };

    if (typeof action !== 'string' || !CLIENT_ACTIONS.has(action)) {
      throw new functions.HttpsError('permission-denied', 'Ação não permitida.');
    }

    const actionDef = XP_ACTION_VALUES[action];
    if (!actionDef) {
      throw new functions.HttpsError('invalid-argument', `Ação inválida: ${action}`);
    }

    if (typeof targetUid !== 'string' || !targetUid || targetUid === uid || targetUid.includes('/')) {
      throw new functions.HttpsError('invalid-argument', 'Alvo inválido.');
    }

    const targetSnap = await db.collection('users').doc(targetUid).get();
    if (!targetSnap.exists) {
      throw new functions.HttpsError('not-found', 'Perfil não encontrado.');
    }

    // REGRA 6, conferida no servidor. Sem resposta ainda não é
    // erro: a próxima mensagem da conversa chama de novo.
    if (action === 'START_CONVO' && !(await hasRealConversation(uid, targetUid))) {
      return { success: true, pending: true, xpGained: 0 };
    }

    // BRT: em UTC o teto diário (DAILY_XP_MAX) zerava às 21h,
    // liberando até 800 XP no mesmo dia civil.
    const todayStr       = todayBr();
    const idempotencyKey = `${uid}_${action}_${targetUid}`;
    const userRef        = db.collection('users').doc(uid);
    const xpLogRef       = db.collection('xpLog');
    const notifRef       = db.collection('notifications');
    const idempotencyRef = db.collection('xpIdempotency').doc(idempotencyKey);

    const result = await db.runTransaction(async (t) => {
      // ── LEITURAS — todas antes de qualquer escrita ──
      const [userDoc, idempotencyDoc] = await Promise.all([
        t.get(userRef),
        t.get(idempotencyRef),
      ]);

      // REGRA 4: idempotência — uma vez por par
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

      // REGRA 19: multiplicador — só o fertilizante, lido do
      // documento. eventCategory do cliente não conta mais.
      const fertAtivo  = userData.progression?.arvore?.fertilizanteAtivo === true;
      const fertExpira = userData.progression?.arvore?.fertilizanteExpiraEm?.toDate?.() ?? null;
      const fertActive = XP_FEATURE_FLAGS.FERTILIZER_ENABLED && fertAtivo && fertExpira && fertExpira > new Date();
      const multiplier = fertActive ? XP_MULTIPLIERS.FERTILIZER : XP_MULTIPLIERS.NORMAL;

      // XP final respeitando teto diário
      const rawXP      = Math.floor(actionDef.xp * multiplier);
      const xpGained   = Math.min(rawXP, DAILY_XP_MAX - xpToday);
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

      // REGRA 21: recompensa do estágio ANTES de qualquer escrita.
      // O grantTreeStageReward faz t.get() — depois de uma escrita
      // o Firestore recusaria a transação inteira.
      if (stageUp) {
        await grantTreeStageReward(t, uid, newTree.current);
      }

      // ── ESCRITAS ──

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
        uid, action, targetUid, xpGained,
        timestamp: FieldValue.serverTimestamp(),
      });

      // REGRA 2: xpLog imutável
      t.set(xpLogRef.doc(), {
        uid,
        origem:         action,
        actionId:       idempotencyKey,
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

      // REGRA 13+16+23: notificações em fila ordenada
      let priority = 0;

      if (leveledUp) {
        t.set(notifRef.doc(), {
          userId:    uid,
          type:      'level_up',
          title:     `🎉 Nível ${newLevelInfo.level}!`,
          message:   `Você alcançou ${newLevelInfo.tier}. Continue evoluindo!`,
          icon:      '⬆️',
          read:      false,
          dados:     { level: newLevelInfo.level, tier: newLevelInfo.tier },
          priority:  priority++,
          timestamp: FieldValue.serverTimestamp(),
        });
      }

      if (stageUp) {
        t.set(notifRef.doc(), {
          userId:    uid,
          type:      'tree_evolution',
          title:     `${newTree.current.icon} Árvore evoluiu!`,
          message:   `Estágio ${newTree.current.name} desbloqueado! ${newTree.current.reward.label}`,
          icon:      newTree.current.icon,
          read:      false,
          dados:     { stage: newTree.current.stage, reward: newTree.current.reward },
          priority:  priority++,
          timestamp: FieldValue.serverTimestamp(),
        });

        // REGRA 15: marca recompensa como concedida — mapa
        // aninhado. Com set+merge, o nome com pontos gravava um
        // campo literal "xp.stageRewardsClaimed.stage_N".
        t.set(userRef, {
          xp: { stageRewardsClaimed: { [`stage_${newTree.current.stage}`]: true } },
        }, { merge: true });
      }

      // REGRA 18: decai o risk score.
      // ATENÇÃO: nada o incrementa hoje — o anti-bot está inerte.
      // Pendência registrada; não alterado nesta versão.
      if (riskScore < ANTI_BOT.BLOCK_THRESHOLD) {
        t.set(userRef, { xp: { xpRiskScore: Math.max(0, riskScore - 1) } }, { merge: true });
      }

      return {
        alreadyProcessed: false,
        xpGained,
        treeXPGain,
        newTotalXP,
        newTreeXP,
        newLevel:      newLevelInfo.level,
        newTier:       newLevelInfo.tier,
        levelProgress: newLevelInfo.progress,
        leveledUp,
        stageUp,
        newStage:      newTree.current.stage,
        newStageName:  newTree.current.name,
        treeProgress:  newTree.progress,  // REGRA 22
      };
    });

    // v5.3 — conquista TREE_EVOLUTION (fire-and-forget, só se evoluiu)
    if (result.stageUp && result.newStage !== undefined) {
      db.collection('achievementTriggers').add({
        uid,
        action:       'TREE_EVOLUTION',
        currentValue: result.newStage,
        processedAt:  null,
        timestamp:    FieldValue.serverTimestamp(),
      }).catch(() => {});
    }

    return { success: true, ...result };
  }
);

/**
 * Formas de ganhar XP exibidas na tela "XP & Níveis". Só texto
 * fica aqui — XP e treeXP são LIDOS de XP_ACTION_VALUES na hora,
 * então a tela nunca diverge do que o servidor paga. A cópia que
 * vivia no app estava várias versões atrás.
 *
 * Só entram ações que algum evento realmente credita.
 * RECEIVE_LIKE fica de fora até ser disparada.
 */
const XP_ACTIONS_PUBLIC: { action: string; icon: string; label: string; note: string }[] = [
  { action: 'VISIT_PROFILE',      icon: '👁️', label: 'Visitar perfil',        note: '1x por perfil/dia'            },
  { action: 'GIVE_LIKE',          icon: '💜', label: 'Curtir perfil',          note: '1x por perfil/dia'            },
  { action: 'START_CONVO',        icon: '💬', label: 'Iniciar conversa real',  note: 'após resposta, 1x por pessoa' },
  { action: 'CREATE_SINTONIA',    icon: '✨', label: 'Criar Sintonia',         note: 'quando ambos curtiram'        },
  { action: 'COMPLETE_MISSION',   icon: '📋', label: 'Completar missão',       note: 'após validação'               },
  { action: 'UNLOCK_ACHIEVEMENT', icon: '🔓', label: 'Desbloquear galeria',    note: '1x por perfil'                },
];

// ── 2. Status de XP (REGRA 28: cliente recebe tudo pronto) ──
export const getXPStatus = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const userDoc  = await db.collection('users').doc(uid).get();
    const userData = userDoc.data() ?? {};
    const xp       = userData.xp ?? {};

    const todayStr  = todayBr();
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

      // Tabelas para a tela — o app não guarda cópia.
      treeStages: TREE_STAGE_TABLE.map(s => ({
        stage:       s.stage,
        name:        s.name,
        icon:        s.icon,
        treeXPMin:   s.treeXPMin,
        rewardLabel: s.reward.label,
      })),
      xpActions: XP_ACTIONS_PUBLIC.flatMap(a => {
        const def = XP_ACTION_VALUES[a.action];
        return def ? [{ ...a, xp: def.xp, treeXP: def.treeXP }] : [];
      }),
      dailyXPMax: DAILY_XP_MAX,

      // Feature flags (REGRA 24)
      features: {
        xpEnabled:       XP_FEATURE_FLAGS.XP_ENABLED,
        treeEnabled:     XP_FEATURE_FLAGS.TREE_ENABLED,
        fertEnabled:     XP_FEATURE_FLAGS.FERTILIZER_ENABLED,
      },
    };
  }
);