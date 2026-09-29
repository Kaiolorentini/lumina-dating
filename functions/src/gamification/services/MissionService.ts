// ============================================
// LUMINA — MISSION SERVICE v3.0
// functions/src/gamification/services/MissionService.ts
//
// v3.0 — O SERVIDOR REGISTRA AS MISSÕES.
//
// Antes, o app DECLARAVA o progresso pelo progressMission: qual
// missão, o alvo e até o tamanho da mensagem. Dava para concluir
// o dia sem fazer nada.
//
// Agora cada missão é registrada pela CF onde o evento é real
// (recordEvent): visita registrada, curtida nova, sintonia, carta
// aberta, Faísca, diária, compra confirmada, foto enviada,
// mensagem criada. O app só pede o que o servidor confere sozinho
// (claimVerifiable) — hoje, o perfil completo.
//
// Se o documento do dia ainda não existe, é gerado aqui, na mesma
// transação: quem age antes de abrir a tela de missões não perde
// o progresso.
//
// Limites diários (300 fragmentos, 5 cristais): acima deles a
// missão CONCLUI pagando só o que cabe — antes lançava erro e
// derrubava o evento que a disparou.
// ============================================
import { auditLogFinanceiro } from '../../utils/auditLogFinanceiro';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ValidationError }                from '../ErrorBoundary';
import { GamificationIntegrationService } from '../GamificationIntegrationService';
import { todayBr }                        from '../../utils/dateBr';
import { buildDailyMissionsDoc, isMarketplaceOpen } from '../../engagement/missionsCatalog';

const db = admin.firestore();

const DAILY_FRAGMENT_LIMIT = 300;
const DAILY_CRYSTAL_LIMIT  = 5;

export type MissionEventType =
  | 'visit_profiles' | 'like_profiles' | 'send_message' | 'open_destiny'
  | 'claim_faisca'   | 'claim_daily'   | 'buy_product'  | 'update_photo'
  | 'create_sintonia'| 'receive_like'  | 'long_chat'    | 'complete_profile';

/** Contam alvos DISTINTOS no dia. */
const DISTINCT_TARGET_TYPES: ReadonlySet<string> = new Set(['visit_profiles', 'like_profiles']);

/** O app pode pedir estas: o servidor confere o estado sozinho. */
const CLIENT_VERIFIABLE_TYPES: ReadonlySet<string> = new Set(['complete_profile']);

interface MissionDoc {
  missionId:  string;
  type:       string;
  label:      string;
  icon:       string;
  fragments?: number;
  crystals?:  number;
  target:     number;
  unit?:      string;
  progress:   number;
  completed:  boolean;
  claimed:    boolean;
}

export interface MissionProgressResult {
  type:      string;
  missionId: string;
  progress:  number;
  completed: boolean;
  fragments: number;
  crystals:  number;
  duplicate: boolean;
}

/**
 * Registra um evento real. Sem missão desse tipo hoje, ou já
 * concluída, não faz nada (null). Nunca é chamada pelo app.
 */
async function recordEvent(
  uid: string,
  type: MissionEventType,
  targetUid?: string,
): Promise<MissionProgressResult | null> {
  if (DISTINCT_TARGET_TYPES.has(type) && (!targetUid || targetUid === uid)) return null;

  const dateStr   = todayBr();
  const missRef   = db.collection('dailyMissions').doc(`${uid}_${dateStr}`);
  const walletRef = db.collection('wallets').doc(uid);
  const marketplaceOpen = await isMarketplaceOpen();

  const result = await db.runTransaction(async (t): Promise<MissionProgressResult | null> => {
    const snap = await t.get(missRef);

    let data: Record<string, unknown>;
    if (snap.exists) {
      data = snap.data()!;
    } else {
      data = buildDailyMissionsDoc(uid, dateStr, marketplaceOpen);
      t.set(missRef, { ...data, generatedAt: FieldValue.serverTimestamp() });
    }

    const missions  = [...((data.missions as MissionDoc[] | undefined) ?? [])];
    const special   = data.special as MissionDoc | undefined;
    const idx       = missions.findIndex(m => m.type === type);
    const isSpecial = idx < 0 && special?.type === type;
    const mission   = idx >= 0 ? missions[idx] : (isSpecial ? special! : null);

    if (!mission || mission.completed) return null;

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    if (DISTINCT_TARGET_TYPES.has(type)) {
      const key     = `visited_${type}`;
      const visited = (data[key] as string[] | undefined) ?? [];
      if (visited.includes(targetUid!)) {
        return {
          type, missionId: mission.missionId, progress: mission.progress,
          completed: false, fragments: 0, crystals: 0, duplicate: true,
        };
      }
      updates[key] = FieldValue.arrayUnion(targetUid!);
    }

    const newProgress   = Math.min(mission.progress + 1, mission.target);
    const justCompleted = newProgress >= mission.target;
    const updated: MissionDoc = {
      ...mission, progress: newProgress, completed: justCompleted, claimed: justCompleted,
    };

    if (isSpecial) {
      updates.special = updated;
    } else {
      missions[idx]    = updated;
      updates.missions = missions;
    }

    let fragments = 0;
    let crystals  = 0;

    if (justCompleted) {
      const fragToday = (data.fragmentsEarnedToday as number | undefined) ?? 0;
      const crysToday = (data.crystalsEarnedToday  as number | undefined) ?? 0;

      fragments = isSpecial ? 0 : Math.max(0, Math.min(mission.fragments ?? 0, DAILY_FRAGMENT_LIMIT - fragToday));
      crystals  = isSpecial ? Math.max(0, Math.min(mission.crystals ?? 0, DAILY_CRYSTAL_LIMIT - crysToday)) : 0;

      if (fragments > 0 || crystals > 0) {
        const walletUpdate: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
        if (fragments > 0) walletUpdate.fragments      = FieldValue.increment(fragments);
        if (crystals  > 0) walletUpdate.coinsGratuitos = FieldValue.increment(crystals);
        t.set(walletRef, walletUpdate, { merge: true });

        t.set(db.collection('economyLedger').doc(), {
          uid,
          origem:     'dailyMissions',
          missionId:  mission.missionId,
          tipo:       isSpecial ? 'MISSAO_ESPECIAL' : 'MISSAO_COMUM',
          fragmentos: fragments,
          cristais:   crystals,
          timestamp:  FieldValue.serverTimestamp(),
          imutavel:   true,
        });

        if (fragments > 0) {
          auditLogFinanceiro({
            uid, tipo: 'FRAG_MISSAO', valor: fragments, origem: 'dailyMissions',
            metadata: { missionId: mission.missionId },
          }, t);
        }
        if (crystals > 0) {
          auditLogFinanceiro({
            uid, tipo: 'MISSAO_ESPECIAL', coinTipo: 'gratuito', valor: crystals, origem: 'dailyMissions',
            metadata: { missionId: mission.missionId },
          }, t);
        }
      }

      updates.fragmentsEarnedToday = FieldValue.increment(fragments);
      updates.crystalsEarnedToday  = FieldValue.increment(crystals);
    }

    t.set(missRef, updates, { merge: true });

    return {
      type, missionId: mission.missionId, progress: newProgress,
      completed: justCompleted, fragments, crystals, duplicate: false,
    };
  });

  // Engine e conquista só quando concluiu AGORA. Aguardados: soltos,
  // a CPU da instância é cortada depois da resposta e podem se perder.
  if (result?.completed) {
    await GamificationIntegrationService.handleMissionCompleted({
      uid,
      missionId:       result.missionId,
      missionCategory: type,
    });

    await db.collection('achievementTriggers').add({
      uid,
      action:       'COMPLETE_MISSION',
      currentValue: 1,
      processedAt:  null,
      timestamp:    FieldValue.serverTimestamp(),
    }).catch(() => { /* conquista nunca derruba a missão */ });
  }

  return result;
}

/** Campos que faltam para o perfil contar como 100% completo. */
async function missingProfileFields(uid: string): Promise<string[]> {
  const snap = await db.collection('users').doc(uid).get();
  const u    = snap.data() ?? {};
  const missing: string[] = [];

  if (!u.photoURL)                   missing.push('foto');
  if (!u.name)                       missing.push('nome');
  if (!u.age)                        missing.push('idade');
  if (!u.city || !u.state)           missing.push('cidade');
  if (!u.gender)                     missing.push('gênero');
  if (!Array.isArray(u.preferences) || u.preferences.length === 0) missing.push('interesse');
  if (typeof u.bio !== 'string' || u.bio.trim().length < 20)       missing.push('bio (mín. 20 caracteres)');

  return missing;
}

/**
 * Pedido do app para missões que o servidor confere sozinho.
 * As demais são automáticas e recusadas aqui.
 */
async function claimVerifiable(
  uid: string,
  missionIdParam: string,
): Promise<MissionProgressResult | null> {
  const dateStr = todayBr();
  const snap    = await db.collection('dailyMissions').doc(`${uid}_${dateStr}`).get();

  if (!snap.exists) {
    throw new ValidationError('MISSIONS_NOT_GENERATED', 'Missões do dia não geradas', true);
  }

  const data     = snap.data()!;
  const missions = (data.missions as MissionDoc[] | undefined) ?? [];
  const special  = data.special as MissionDoc | undefined;
  const mission  = missions.find(m => m.missionId === missionIdParam)
    ?? (special?.missionId === missionIdParam ? special : undefined);

  if (!mission) {
    throw new ValidationError('MISSION_NOT_FOUND', 'Missão não encontrada', false);
  }

  if (!CLIENT_VERIFIABLE_TYPES.has(mission.type)) {
    throw new ValidationError(
      'MISSION_AUTOMATIC',
      'Esta missão é registrada automaticamente quando você faz a ação.',
      false,
    );
  }

  if (mission.type === 'complete_profile') {
    const missing = await missingProfileFields(uid);
    if (missing.length > 0) {
      throw new ValidationError(
        'PROFILE_INCOMPLETE',
        `Falta completar: ${missing.join(', ')}.`,
        false,
      );
    }
  }

  return recordEvent(uid, mission.type as MissionEventType);
}

export const MissionService = {
  recordEvent,
  claimVerifiable,
};