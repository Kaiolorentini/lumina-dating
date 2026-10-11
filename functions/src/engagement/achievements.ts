// ============================================
// LUMINA — ACHIEVEMENTS SYSTEM v5.6
// functions/src/engagement/achievements.ts
//
// v5.6 (10/10/2026) — coleções coletáveis. Cada coleção devolve
// também `claimed` (fragmentos já coletados) e `claimable` (botão
// "Coletar" no app). Os fragmentos são entregues pela callable
// claimCollectionReward (collectionRewards.ts), no Cofre.
//
// v5.5 — repairAchievements REMOVIDA (auditoria A6, 08/10/2026).
// Era uma tarefa agendada diária que lia até 100 usuários e só
// escrevia um log: custo de leitura todo dia sem efeito nenhum.
//
// v5.4 — checkAchievements REMOVIDA (CRÍTICO).
//
// Era callable e repassava ao AchievementProcessor a AÇÃO e o
// VALOR enviados pelo app. Ações absolutas (sequência, árvore)
// usam o valor direto: um app modificado mandava
// TREE_EVOLUTION = 4 ou STREAK_UPDATE = 30 e desbloqueava
// conquistas com fragmentos, badges, molduras e prestígio.
// Ações incrementais somavam +1 por chamada, sem limite.
//
// Conquistas entram SÓ pelo servidor: cada CF grava em
// achievementTriggers no ponto em que o evento acontece, e o
// onAchievementTrigger processa. Os três chamadores do app
// eram duplicados ou passaram para o servidor:
//   STREAK_UPDATE → claimDailyReward (já registrava, com dias reais)
//   START_CONVO   → earnXP (uma vez por par, conversa verificada)
//   VAULT_WITHDRAW→ withdrawFromVault (já registrava)
//
// v5.3: actions incrementais acumulam progress[achId] + 1 no
// servidor; actions absolutas usam currentValue direto.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { ACHIEVEMENTS_CATALOG } from '../config/achievementsCatalog';
import { COLLECTIONS_CATALOG } from '../config/collectionsCatalog';

const db = admin.firestore();

// ── Status de conquistas ── (inalterada)
export const getAchievementsStatus = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const userDoc  = await db.collection('users').doc(uid).get();
    const userData = userDoc.data() ?? {};
    const achData  = userData.achievements ?? {};

    const unlocked:   string[]               = achData.unlocked            ?? [];
    const progress:   Record<string, number>  = achData.progress            ?? {};
    const completed:  string[]               = achData.completedCollections ?? [];
    const claimed:    string[]               = achData.claimedCollections   ?? [];
    const unlockedAt: Record<string, string>  = achData.unlockedAt          ?? {};

    const achievements = Object.values(ACHIEVEMENTS_CATALOG).map(ach => ({
      ...ach,
      unlocked:    unlocked.includes(ach.id),
      progress:    progress[ach.id] ?? 0,
      unlockedAt:  unlockedAt[ach.id] ?? null,
      title:       (!ach.hidden || unlocked.includes(ach.id)) ? ach.title       : '?????',
      description: (!ach.hidden || unlocked.includes(ach.id)) ? ach.description : 'Conquista secreta',
    }));

    const collections = Object.values(COLLECTIONS_CATALOG).map(col => {
      const achProgress = col.achievementIds.filter(id => unlocked.includes(id)).length;
      // Completa no servidor, ou com todas as conquistas desbloqueadas
      // (a coleta repara a marcação que faltou — ver collectionRewards).
      const isComplete  = completed.includes(col.id) || achProgress === col.achievementIds.length;
      const isClaimed   = claimed.includes(col.id);
      return {
        ...col,
        completed:   isComplete,
        claimed:     isClaimed,
        claimable:   isComplete && !isClaimed && col.reward.fragments > 0,
        achProgress,
        achTotal:    col.achievementIds.length,
      };
    });

    return {
      achievements, collections,
      totalUnlocked:  unlocked.length,
      totalAvailable: Object.keys(ACHIEVEMENTS_CATALOG).length,
    };
  }
);
