// ============================================
// LUMINA — PRESTIGE SYSTEM v5.1
// functions/src/engagement/prestige.ts
//
// DIRETRIZES ABSOLUTAS:
// ✗ Nunca comprável (nem Premium, nem dinheiro)
// ✗ Nunca diminui
// ✗ Nunca afeta economia (sem cristais/fragmentos/XP)
// ✗ Nunca afeta matchmaking
// ✓ Totalmente desacoplado de Wallet e XP
// ✓ prestigePoints como camada intermediária
// ✓ Cada marco verifica apenas seus próprios eventos
// ✓ prestigeLog imutável
// ✓ Legado — linha do tempo de marcos
// ✓ Recompensas apenas cosméticas
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  PRESTIGE_FLAGS,
  PRESTIGE_MARCOS,
  calcPrestigeStage,
  nextPrestigeStage,
} from '../config/prestigeTable';

const db = admin.firestore();

// ── 1. Conceder Prestige Points por marco ──
export const grantPrestigePoints = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    // REGRA 9: Feature Flag
    if (!PRESTIGE_FLAGS.PRESTIGE_ENABLED) {
      return { disabled: true };
    }

    const { marcoId } = request.data as { marcoId: string };
    const marco = PRESTIGE_MARCOS[marcoId];
    if (!marco) {
      throw new functions.HttpsError('invalid-argument', `Marco inválido: ${marcoId}`);
    }

    const prestigeRef = db.collection('prestige').doc(uid);
    const logRef      = db.collection('prestigeLog');
    const notifRef    = db.collection('notifications');

    const result = await db.runTransaction(async (t) => {
      const prestigeDoc = await t.get(prestigeRef);
      const data        = prestigeDoc.data() ?? {};

      const currentPoints  = data.prestigePoints ?? 0;
      const marcosClaimed: string[] = data.marcosClaimed ?? [];
      const marcosCount: Record<string, number> = data.marcosCount ?? {};

      // Verifica idempotência
      if (!marco.repeatable && marcosClaimed.includes(marcoId)) {
        return { alreadyClaimed: true, points: 0 };
      }

      // Verifica limite de repetições
      if (marco.repeatable && marco.maxTimes > 0) {
        const count = marcosCount[marcoId] ?? 0;
        if (count >= marco.maxTimes) {
          return { limitReached: true, points: 0 };
        }
      }

      const newPoints   = currentPoints + marco.points;
      const prevStage   = calcPrestigeStage(currentPoints);
      const newStage    = calcPrestigeStage(newPoints);
      const stagedUp    = newStage.stage > prevStage.stage;

      // Atualiza prestígio
      const updates: Record<string, any> = {
        uid,
        prestigePoints:  newPoints,
        prestigeStage:   newStage.stage,
        prestigeName:    newStage.name,
        prestigeIcon:    newStage.icon,
        prestigeAura:    newStage.auraAsset,
        prestigeTitle:   newStage.title,
        updatedAt:       FieldValue.serverTimestamp(),
      };

      if (!marco.repeatable) {
        updates.marcosClaimed = FieldValue.arrayUnion(marcoId);
      } else {
        updates[`marcosCount.${marcoId}`] = FieldValue.increment(1);
      }

      // REGRA 12: Legado — linha do tempo
      updates.legado = FieldValue.arrayUnion({
        marcoId,
        label:     marco.label,
        points:    marco.points,
        timestamp: new Date().toISOString(), // aproximação — serverTimestamp não pode ir em array
      });

      t.set(prestigeRef, updates, { merge: true });

      // REGRA 3: prestigeLog imutável
      t.set(logRef.doc(), {
        uid,
        marcoId,
        label:           marco.label,
        category:        marco.category,
        pontos:          marco.points,
        prestigeAnterior: currentPoints,
        prestigeAtual:   newPoints,
        stageAnterior:   prevStage.stage,
        stageAtual:      newStage.stage,
        timestamp:       FieldValue.serverTimestamp(),
        imutavel:        true,
      });

      // Notificação de novo estágio (só cosmético — REGRA)
      if (stagedUp) {
        t.set(notifRef.doc(), {
          userId:    uid,
          type:      'achievement_unlocked',
          title:     `${newStage.icon} ${newStage.name}!`,
          message:   newStage.description,
          icon:      newStage.icon,
          read:      false,
          dados: {
            prestigeStage: newStage.stage,
            stageName:     newStage.name,
            aura:          newStage.auraAsset,
            title:         newStage.title,
          },
          timestamp: FieldValue.serverTimestamp(),
        });

        // Desbloqueia aura e título (apenas cosmético)
        t.set(db.collection('users').doc(uid), {
          [`progression.unlockedAuras.${newStage.auraAsset}`]: true,
          [`progression.availableTitles`]: FieldValue.arrayUnion(newStage.title),
          [`progression.prestigeStage`]:   newStage.stage,
          [`progression.prestigeName`]:    newStage.name,
        }, { merge: true });

        // REGRA 10: analytics
        t.set(db.collection('prestigeAnalytics').doc(`${uid}_stage_${newStage.stage}`), {
          uid,
          stage:       newStage.stage,
          stageName:   newStage.name,
          points:      newPoints,
          marcoTrigger: marcoId,
          timestamp:   FieldValue.serverTimestamp(),
        });
      }

      return {
        alreadyClaimed: false,
        points:         marco.points,
        newTotal:       newPoints,
        prevStage:      prevStage.stage,
        newStage:       newStage.stage,
        stagedUp,
        stageName:      newStage.name,
      };
    });

    return { success: true, ...result };
  }
);

// ── 2. Status do Prestígio ──
export const getPrestigeStatus = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const prestigeDoc = await db.collection('prestige').doc(uid).get();
    const data        = prestigeDoc.data() ?? {};

    const points      = data.prestigePoints ?? 0;
    const stage       = calcPrestigeStage(points);
    const next        = nextPrestigeStage(points);
    const progress    = next
      ? Math.min((points - stage.pointsMin) / (next.pointsMin - stage.pointsMin), 1)
      : 1;

    // REGRA 12: Legado — linha do tempo
    const legado: any[] = data.legado ?? [];

    return {
      prestigePoints:  points,
      prestigeStage:   stage.stage,
      prestigeName:    stage.name,
      prestigeIcon:    stage.icon,
      prestigeTitle:   stage.title,
      prestigeColor:   stage.color,
      prestigeAura:    stage.auraAsset,
      description:     stage.description,
      nextStage:       next,
      progress,
      pointsToNext:    next ? next.pointsMin - points : 0,
      marcosClaimed:   data.marcosClaimed ?? [],
      legado:          legado.slice(-20), // últimos 20 marcos
      flags:           PRESTIGE_FLAGS,
    };
  }
);

// ── 3. Verificar marcos de tempo ativo (scheduled diário) ──
import * as scheduler from 'firebase-functions/v2/scheduler';

export const checkPrestigeTimeMarcos = scheduler.onSchedule(
  { schedule: 'every 24 hours', region: 'us-central1' },
  async () => {
    if (!PRESTIGE_FLAGS.PRESTIGE_ENABLED) return;

    // Busca usuários com lastActive recente
    const now       = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const usersSnap = await db.collection('users')
      .where('lastActive', '>=', yesterday)
      .limit(200)
      .get();

    for (const userDoc of usersSnap.docs) {
      const uid      = userDoc.id;
      const userData = userDoc.data();

      // REGRA 5: conta meses com login real
      const activeDays   = userData.progression?.activeDays   ?? 0;
      const prestigeData = await db.collection('prestige').doc(uid).get();
      const claimed      = prestigeData.data()?.marcosClaimed ?? [];

      // Verifica marcos de tempo
      const timeMarcos = [
        { id: 'ACTIVE_30_DAYS',  threshold: 30  },
        { id: 'ACTIVE_90_DAYS',  threshold: 90  },
        { id: 'ACTIVE_180_DAYS', threshold: 180 },
        { id: 'ACTIVE_365_DAYS', threshold: 365 },
      ];

      for (const marco of timeMarcos) {
        if (activeDays >= marco.threshold && !claimed.includes(marco.id)) {
          // Chama grantPrestigePoints internamente
          await db.collection('prestige').doc(uid).set({
            pendingMarcos: FieldValue.arrayUnion(marco.id),
          }, { merge: true });
        }
      }
    }

    console.log(`[checkPrestigeTimeMarcos] ${usersSnap.size} usuários verificados`);
  }
);