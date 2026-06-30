// ============================================
// LUMINA — DAILY MISSIONS v5.3
// functions/src/engagement/dailyMissions.ts
//
// SPRINT 1B: progressMission agora delega ao MissionService.completeMission().
// Mesma resposta externa ao cliente — zero mudança de comportamento percebida.
// generateDailyMissions e getDailyMissions permanecem INALTERADOS.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { MissionService } from '../gamification/services/MissionService';
import { ValidationError } from '../gamification/ErrorBoundary';

const db = admin.firestore();

// ── CATÁLOGO — inalterado ──
const MISSIONS_CATALOG = [
  { type: 'visit_profiles',   label: 'Visitar 3 perfis diferentes',      icon: '👁️',  fragments: 10, target: 3, unit: 'perfis'    },
  { type: 'send_message',     label: 'Enviar 1 mensagem (mín. 10 chars)', icon: '💬',  fragments: 15, target: 1, unit: 'mensagem'   },
  { type: 'open_destiny',     label: 'Abrir Carta do Destino',            icon: '🃏',  fragments: 10, target: 1, unit: 'carta'      },
  { type: 'claim_faisca',     label: 'Resgatar Faísca do Destino',        icon: '⚡',  fragments: 10, target: 1, unit: 'faísca'     },
  { type: 'claim_daily',      label: 'Resgatar recompensa diária',        icon: '🎁',  fragments: 10, target: 1, unit: 'recompensa' },
  { type: 'like_profiles',    label: 'Curtir 3 perfis diferentes',        icon: '💜',  fragments: 12, target: 3, unit: 'curtidas'   },
  { type: 'view_media',       label: 'Ver 2 itens de Mídia',              icon: '📸',  fragments: 8,  target: 2, unit: 'mídias'     },
  { type: 'update_profile',   label: 'Atualizar bio ou foto do perfil',   icon: '✏️',  fragments: 15, target: 1, unit: 'atualiz.'   },
] as const;

const SPECIAL_MISSIONS_CATALOG = [
  { type: 'create_sintonia',  label: 'Criar uma nova Sintonia',    icon: '✨', crystals: 1, target: 1 },
  { type: 'complete_profile', label: 'Perfil 100% completo',       icon: '🏆', crystals: 1, target: 1 },
  { type: 'receive_like',     label: 'Receber uma curtida',        icon: '💖', crystals: 1, target: 1 },
  { type: 'long_chat',        label: 'Trocar 5 mensagens no chat', icon: '💬', crystals: 1, target: 5 },
] as const;

function sortearMissoesDoDia(uid: string, dateStr: string): typeof MISSIONS_CATALOG[number][] {
  const seed = uid.slice(0, 8) + dateStr.replace(/-/g, '');
  const hash = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const indices: number[] = [];
  let current = hash;
  while (indices.length < 3) {
    const idx = current % MISSIONS_CATALOG.length;
    if (!indices.includes(idx)) indices.push(idx);
    current = (current * 31 + 7) % 97;
  }
  return indices.map(i => MISSIONS_CATALOG[i]);
}

function sortearMissaoEspecialDoDia(uid: string, dateStr: string): typeof SPECIAL_MISSIONS_CATALOG[number] {
  const seed = uid.slice(2, 10) + dateStr.replace(/-/g, '');
  const hash = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return SPECIAL_MISSIONS_CATALOG[hash % SPECIAL_MISSIONS_CATALOG.length];
}

function missionId(dateStr: string, type: string): string {
  return `daily_${dateStr.replace(/-/g, '_')}_${type}`;
}

// ============================================
// CF 1 — Gerar missões do dia — INALTERADA
// ============================================
export const generateDailyMissions = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const dateStr  = new Date().toISOString().slice(0, 10);
    const missRef  = db.collection('dailyMissions').doc(`${uid}_${dateStr}`);
    const existing = await missRef.get();

    if (existing.exists) {
      return { missions: existing.data()!.missions, special: existing.data()!.special, generated: false };
    }

    const commonMissions = sortearMissoesDoDia(uid, dateStr);
    const specialMission = sortearMissaoEspecialDoDia(uid, dateStr);

    const missions = commonMissions.map(m => ({
      missionId: missionId(dateStr, m.type), type: m.type, label: m.label, icon: m.icon,
      fragments: m.fragments, target: m.target, unit: m.unit,
      progress: 0, completed: false, claimed: false,
    }));

    const special = {
      missionId: missionId(dateStr, specialMission.type), type: specialMission.type,
      label: specialMission.label, icon: specialMission.icon, crystals: specialMission.crystals,
      target: specialMission.target, progress: 0, completed: false, claimed: false,
    };

    await missRef.set({
      uid, date: dateStr, missions, special,
      fragmentsEarnedToday: 0, crystalsEarnedToday: 0,
      generatedAt: FieldValue.serverTimestamp(),
    });

    return { missions, special, generated: true };
  }
);

// ============================================
// CF 2 — Buscar missões do dia — INALTERADA
// ============================================
export const getDailyMissions = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const dateStr    = new Date().toISOString().slice(0, 10);
    const missRef    = db.collection('dailyMissions').doc(`${uid}_${dateStr}`);
    const walletRef  = db.collection('wallets').doc(uid);
    const [missDoc, walletDoc] = await Promise.all([missRef.get(), walletRef.get()]);

    if (!missDoc.exists) {
      const commonMissions = sortearMissoesDoDia(uid, dateStr);
      const specialMission = sortearMissaoEspecialDoDia(uid, dateStr);

      const missions = commonMissions.map(m => ({
        missionId: missionId(dateStr, m.type), type: m.type, label: m.label, icon: m.icon,
        fragments: m.fragments, target: m.target, unit: m.unit,
        progress: 0, completed: false, claimed: false,
      }));

      const special = {
        missionId: missionId(dateStr, specialMission.type), type: specialMission.type,
        label: specialMission.label, icon: specialMission.icon, crystals: specialMission.crystals,
        target: specialMission.target, progress: 0, completed: false, claimed: false,
      };

      await missRef.set({
        uid, date: dateStr, missions, special,
        fragmentsEarnedToday: 0, crystalsEarnedToday: 0,
        generatedAt: FieldValue.serverTimestamp(),
      });

      const walletData = walletDoc.data() ?? {};
      return {
        missions, special,
        fragments: walletData.fragments ?? 0, coinsGratuitos: walletData.coinsGratuitos ?? 0,
        fragmentsEarnedToday: 0, crystalsEarnedToday: 0, allCompleteBonusClaimed: false,
      };
    }

    const data       = missDoc.data()!;
    const walletData = walletDoc.data() ?? {};

    return {
      missions: data.missions, special: data.special,
      fragments: walletData.fragments ?? 0, coinsGratuitos: walletData.coinsGratuitos ?? 0,
      fragmentsEarnedToday: data.fragmentsEarnedToday ?? 0, crystalsEarnedToday: data.crystalsEarnedToday ?? 0,
      allCompleteBonusClaimed: data.allCompleteBonusClaimed ?? false,
    };
  }
);

// ============================================
// CF 3 — Registrar progresso — SPRINT 1B: delega ao MissionService
// ============================================
export const progressMission = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const { missionIdParam, targetUid, messageLength } = request.data as {
      missionIdParam: string;
      targetUid?:     string;
      messageLength?: number;
    };

    if (!missionIdParam) {
      throw new functions.HttpsError('invalid-argument', 'missionIdParam obrigatório.');
    }

    try {
      // SPRINT 1B: único ponto de entrada — registra progresso + recompensa + dispara Engine
      const result = await MissionService.completeMission({ uid, missionIdParam, targetUid, messageLength });
      return { success: true, ...result };
    } catch (error) {
      if (error instanceof ValidationError) {
        const httpCode = error.fatal ? 'not-found' : 'failed-precondition';
        throw new functions.HttpsError(httpCode, error.message);
      }
      throw new functions.HttpsError('internal', 'Erro ao registrar progresso da missão.');
    }
  }
);