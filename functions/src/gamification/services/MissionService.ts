// ============================================
// LUMINA — MISSION SERVICE v2.0
// functions/src/gamification/services/MissionService.ts
//
// SPRINT 1B — Único ponto de entrada para conclusão de missões.
// Resolve o conflito identificado na auditoria:
//   progressMission (legado) registra progresso + entrega recompensa.
//   onMissionCompleted (novo) só entrega recompensa.
//
// Esta versão unifica os dois fluxos em um único método:
//   completeMission() = registra progresso + entrega fragmentos + dispara Engine
//
// progressMission (legado) passa a chamar este método internamente,
// SEM alterar seu comportamento externo (mesma resposta ao cliente).
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ValidationError }                from '../ErrorBoundary';
import { GamificationIntegrationService } from '../GamificationIntegrationService';

const db = admin.firestore();

export interface CompleteMissionInput {
  uid:            string;
  missionIdParam: string;
  targetUid?:     string;
  messageLength?: number;
}

export interface CompleteMissionResult {
  alreadyCompleted: boolean;
  duplicate?:       boolean;
  fragments:        number;
  crystals:         number;
  progress:         number;
  completed:        boolean;
  missionCategory?: string;
}

const DAILY_FRAGMENT_LIMIT = 300;
const DAILY_CRYSTAL_LIMIT  = 5;

export const MissionService = {

  // Único ponto de entrada — registra progresso E entrega recompensa.
  // Ao concluir, dispara o Engine via GamificationIntegrationService.
  async completeMission(input: CompleteMissionInput): Promise<CompleteMissionResult> {
    const { uid, missionIdParam, targetUid, messageLength } = input;
    const dateStr   = new Date().toISOString().slice(0, 10);
    const missRef   = db.collection('dailyMissions').doc(`${uid}_${dateStr}`);
    const walletRef = db.collection('wallets').doc(uid);

    const result = await db.runTransaction(async (t) => {
      const [missDoc] = await Promise.all([t.get(missRef), t.get(walletRef)]);

      if (!missDoc.exists) {
        throw new ValidationError('MISSIONS_NOT_GENERATED', 'Missões do dia não geradas', true);
      }

      const data       = missDoc.data()!;
      const missions   = [...(data.missions ?? [])];
      const special    = data.special;

      let missionIdx     = missions.findIndex((m: { missionId: string }) => m.missionId === missionIdParam);
      let isSpecial      = false;
      let targetMission: Record<string, unknown> | null = null;

      if (missionIdx >= 0) {
        targetMission = missions[missionIdx];
      } else if (special?.missionId === missionIdParam) {
        isSpecial = true;
        targetMission = special;
      } else {
        throw new ValidationError('MISSION_NOT_FOUND', 'Missão não encontrada', false);
      }

      if (targetMission!.completed) {
        return { alreadyCompleted: true, fragments: 0, crystals: 0, progress: targetMission!.progress as number, completed: true };
      }

      // Anti-spam mensagem
      if (targetMission!.type === 'send_message' && (!messageLength || messageLength < 10)) {
        throw new ValidationError('MESSAGE_TOO_SHORT', 'Mensagem deve ter pelo menos 10 caracteres', false);
      }

      // UIDs únicos para visitas/curtidas
      if (['visit_profiles', 'like_profiles'].includes(targetMission!.type as string)) {
        if (!targetUid) throw new ValidationError('MISSING_TARGET_UID', 'targetUid obrigatório', false);
        if (targetUid === uid) throw new ValidationError('SELF_ACTION', 'Não pode contar consigo mesmo', false);

        const visitedKey = `visited_${targetMission!.type}`;
        const visited    = (data[visitedKey] as string[]) ?? [];
        if (visited.includes(targetUid)) {
          return { alreadyCompleted: false, duplicate: true, fragments: 0, crystals: 0, progress: targetMission!.progress as number, completed: false };
        }
        t.set(missRef, { [visitedKey]: FieldValue.arrayUnion(targetUid) }, { merge: true });
      }

      const newProgress   = Math.min((targetMission!.progress as number) + 1, targetMission!.target as number);
      const justCompleted = newProgress >= (targetMission!.target as number);
      const updatedMission = { ...targetMission, progress: newProgress, completed: justCompleted, claimed: justCompleted };

      if (isSpecial) {
        t.set(missRef, { special: updatedMission }, { merge: true });
      } else {
        missions[missionIdx] = updatedMission;
        t.set(missRef, { missions }, { merge: true });
      }

      if (!justCompleted) {
        return { alreadyCompleted: false, fragments: 0, crystals: 0, progress: newProgress, completed: false };
      }

      // ── Concluiu — entrega recompensa ──
      const fragmentsToAdd = !isSpecial ? ((targetMission!.fragments as number) ?? 0) : 0;
      const crystalsToAdd  = isSpecial  ? ((targetMission!.crystals  as number) ?? 0) : 0;

      const fragmentsEarnedToday = (data.fragmentsEarnedToday as number) ?? 0;
      const crystalsEarnedToday  = (data.crystalsEarnedToday  as number) ?? 0;

      if (fragmentsToAdd > 0 && fragmentsEarnedToday >= DAILY_FRAGMENT_LIMIT) {
        throw new ValidationError('FRAGMENT_DAILY_LIMIT', 'Limite diário de fragmentos atingido', false);
      }
      if (crystalsToAdd > 0 && crystalsEarnedToday >= DAILY_CRYSTAL_LIMIT) {
        throw new ValidationError('CRYSTAL_DAILY_LIMIT', 'Limite diário de cristais via missões atingido', false);
      }

      if (fragmentsToAdd > 0) {
        t.set(walletRef, { fragments: FieldValue.increment(fragmentsToAdd), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      if (crystalsToAdd > 0) {
        t.set(walletRef, { coinsGratuitos: FieldValue.increment(crystalsToAdd), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }

      t.set(missRef, {
        fragmentsEarnedToday: FieldValue.increment(fragmentsToAdd),
        crystalsEarnedToday:  FieldValue.increment(crystalsToAdd),
        updatedAt:            FieldValue.serverTimestamp(),
      }, { merge: true });

      t.set(db.collection('economyLedger').doc(), {
        uid, origem: 'dailyMissions', missionId: missionIdParam,
        tipo: isSpecial ? 'MISSAO_ESPECIAL' : 'MISSAO_COMUM',
        fragmentos: fragmentsToAdd, cristais: crystalsToAdd,
        timestamp: FieldValue.serverTimestamp(), imutavel: true,
      });

      return {
        alreadyCompleted: false, fragments: fragmentsToAdd, crystals: crystalsToAdd,
        progress: newProgress, completed: true,
        missionCategory: (targetMission!.type as string) ?? 'MISSION',
      };
    });

    // Dispara o Engine SOMENTE quando a missão é concluída agora
    // (não dispara em alreadyCompleted ou duplicate — idempotência preservada)
    if (result.completed && !result.alreadyCompleted) {
      GamificationIntegrationService.handleMissionCompleted({
        uid,
        missionId:       missionIdParam,
        missionCategory: result.missionCategory ?? 'MISSION',
      });
    }

    return result;
  },
};