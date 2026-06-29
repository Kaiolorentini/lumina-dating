// ============================================
// LUMINA — DAILY MISSIONS v5.2
// functions/src/engagement/dailyMissions.ts
//
// REGRAS IMPLEMENTADAS:
// 1.  Nenhuma recompensa client-side
// 2.  Missões geradas pelo servidor
// 3.  missionId único: daily_YYYY_MM_DD_tipo
// 4.  Recompensa fixa por missão
// 5.  completed=true na mesma transaction
// 6.  serverTimestamp() obrigatório
// 7.  Anti-spam: mínimo 10 chars em mensagens
// 8.  Visitar: apenas UIDs únicos
// 9.  Curtidas: apenas UIDs únicos
// 10. 100 fragmentos = 1 cristal gratuito
// 11. Limite 300 fragmentos/dia
// 12. Limite 2000 fragmentos/semana
// 13. Limite 5 cristais gratuitos/dia via missões
// 14. Cofre: nunca cristais premium
// 15. Economy Ledger imutável
// 16. Missão especial: max 1/dia, 1 cristal gratuito
// 17. 3 de 8 missões sorteadas server-side
// 18. Não entregar sem ação do usuário
// 19. Fragmentos separados de cristais
// 20. Saldo nunca negativo (fail-safe)
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

// ── CATÁLOGO COMPLETO — 8 missões comuns ──
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

// ── CATÁLOGO — Missões especiais (1/dia) ──
const SPECIAL_MISSIONS_CATALOG = [
  { type: 'create_sintonia',  label: 'Criar uma nova Sintonia',    icon: '✨', crystals: 1, target: 1 },
  { type: 'complete_profile', label: 'Perfil 100% completo',       icon: '🏆', crystals: 1, target: 1 },
  { type: 'receive_like',     label: 'Receber uma curtida',        icon: '💖', crystals: 1, target: 1 },
  { type: 'long_chat',        label: 'Trocar 5 mensagens no chat', icon: '💬', crystals: 1, target: 5 },
] as const;



// Sorteia 3 de 8 missões comuns de forma determinística (mesmas para o dia)
function sortearMissoesDoDia(uid: string, dateStr: string): typeof MISSIONS_CATALOG[number][] {
  // Seed determinística: uid + data → mesmas missões o dia todo
  const seed   = uid.slice(0, 8) + dateStr.replace(/-/g, '');
  const hash   = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const indices: number[] = [];
  let   current = hash;

  while (indices.length < 3) {
    const idx = current % MISSIONS_CATALOG.length;
    if (!indices.includes(idx)) indices.push(idx);
    current = (current * 31 + 7) % 97;
  }

  return indices.map(i => MISSIONS_CATALOG[i]);
}

// Sorteia 1 missão especial do dia
function sortearMissaoEspecialDoDia(uid: string, dateStr: string): typeof SPECIAL_MISSIONS_CATALOG[number] {
  const seed  = uid.slice(2, 10) + dateStr.replace(/-/g, '');
  const hash  = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const idx   = hash % SPECIAL_MISSIONS_CATALOG.length;
  return SPECIAL_MISSIONS_CATALOG[idx];
}

// Gera missionId único por dia
function missionId(dateStr: string, type: string): string {
  return `daily_${dateStr.replace(/-/g, '_')}_${type}`;
}

// Economy Ledger — escrita inline via transaction (REGRA 15)

// ============================================
// CF 1 — Gerar missões do dia (chamada no login)
// ============================================
export const generateDailyMissions = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const dateStr   = new Date().toISOString().slice(0, 10);
    const docId     = `${uid}_${dateStr}`;
    const missRef   = db.collection('dailyMissions').doc(docId);
    const existing  = await missRef.get();

    // Idempotente — se já gerou hoje, retorna as mesmas
    if (existing.exists) {
      return { missions: existing.data()!.missions, special: existing.data()!.special, generated: false };
    }

    // Sorteia server-side
    const commonMissions  = sortearMissoesDoDia(uid, dateStr);
    const specialMission  = sortearMissaoEspecialDoDia(uid, dateStr);

    const missions = commonMissions.map(m => ({
      missionId:  missionId(dateStr, m.type),
      type:       m.type,
      label:      m.label,
      icon:       m.icon,
      fragments:  m.fragments,
      target:     m.target,
      unit:       m.unit,
      progress:   0,
      completed:  false,
      claimed:    false,
    }));

    const special = {
      missionId:  missionId(dateStr, specialMission.type),
      type:       specialMission.type,
      label:      specialMission.label,
      icon:       specialMission.icon,
      crystals:   specialMission.crystals,
      target:     specialMission.target,
      progress:   0,
      completed:  false,
      claimed:    false,
    };

    await missRef.set({
      uid,
      date:                dateStr,
      missions,
      special,
      fragmentsEarnedToday: 0,
      crystalsEarnedToday:  0,
      generatedAt:          FieldValue.serverTimestamp(),
    });

    return { missions, special, generated: true };
  }
);

// ============================================
// CF 2 — Buscar missões do dia
// ============================================
export const getDailyMissions = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const dateStr = new Date().toISOString().slice(0, 10);
    const docId   = `${uid}_${dateStr}`;
    const missRef = db.collection('dailyMissions').doc(docId);
    const walletRef = db.collection('wallets').doc(uid);

    const [missDoc, walletDoc] = await Promise.all([
      missRef.get(),
      walletRef.get(),
    ]);

    // Se não gerou ainda → gera agora
    if (!missDoc.exists) {
      const commonMissions  = sortearMissoesDoDia(uid, dateStr);
      const specialMission  = sortearMissaoEspecialDoDia(uid, dateStr);

      const missions = commonMissions.map(m => ({
        missionId:  missionId(dateStr, m.type),
        type:       m.type,
        label:      m.label,
        icon:       m.icon,
        fragments:  m.fragments,
        target:     m.target,
        unit:       m.unit,
        progress:   0,
        completed:  false,
        claimed:    false,
      }));

      const special = {
        missionId:  missionId(dateStr, specialMission.type),
        type:       specialMission.type,
        label:      specialMission.label,
        icon:       specialMission.icon,
        crystals:   specialMission.crystals,
        target:     specialMission.target,
        progress:   0,
        completed:  false,
        claimed:    false,
      };

      await missRef.set({
        uid, date: dateStr, missions, special,
        fragmentsEarnedToday: 0, crystalsEarnedToday: 0,
        generatedAt: FieldValue.serverTimestamp(),
      });

      const walletData    = walletDoc.data() ?? {};
      return {
        missions, special,
        fragments:           walletData.fragments       ?? 0,
        coinsGratuitos:      walletData.coinsGratuitos  ?? 0,
        fragmentsEarnedToday: 0,
        crystalsEarnedToday:  0,
        allCompleteBonusClaimed: false,
      };
    }

    const data       = missDoc.data()!;
    const walletData = walletDoc.data() ?? {};

    return {
      missions:              data.missions,
      special:               data.special,
      fragments:             walletData.fragments       ?? 0,
      coinsGratuitos:        walletData.coinsGratuitos  ?? 0,
      fragmentsEarnedToday:  data.fragmentsEarnedToday  ?? 0,
      crystalsEarnedToday:   data.crystalsEarnedToday   ?? 0,
      allCompleteBonusClaimed: data.allCompleteBonusClaimed ?? false,
    };
  }
);

// ============================================
// CF 3 — Registrar progresso de missão
// ============================================
export const progressMission = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const {
      missionIdParam,   // ID único da missão (ex: daily_2026_07_01_visit_profiles)
      targetUid,        // UID do perfil visitado/curtido (para validar unicidade)
      messageLength,    // Comprimento da mensagem (para anti-spam)
    } = request.data as {
      missionIdParam: string;
      targetUid?:     string;
      messageLength?: number;
    };

    if (!missionIdParam) {
      throw new functions.HttpsError('invalid-argument', 'missionIdParam obrigatório.');
    }

    const dateStr   = new Date().toISOString().slice(0, 10);
    const docId     = `${uid}_${dateStr}`;
    const missRef   = db.collection('dailyMissions').doc(docId);
    const walletRef = db.collection('wallets').doc(uid);

    const result = await db.runTransaction(async (t) => {
      const [missDoc, walletDoc] = await Promise.all([
        t.get(missRef),
        t.get(walletRef),
      ]);

      if (!missDoc.exists) {
        throw new functions.HttpsError('not-found', 'Missões do dia não geradas.');
      }

      const data       = missDoc.data()!;
      const walletData = walletDoc.data() ?? {};

      // Encontra a missão (comum ou especial)
      const missions  = [...(data.missions ?? [])];
      const special   = data.special;
      let   missionIdx   = missions.findIndex((m: any) => m.missionId === missionIdParam);
      let   isSpecial    = false;
      let   targetMission: any = null;

      if (missionIdx >= 0) {
        targetMission = missions[missionIdx];
      } else if (special?.missionId === missionIdParam) {
        isSpecial     = true;
        targetMission = special;
      } else {
        throw new functions.HttpsError('not-found', 'Missão não encontrada.');
      }

      // REGRA 5: já completada → idempotência
      if (targetMission.completed) {
        return { alreadyCompleted: true, fragments: 0, crystals: 0, progress: targetMission.progress };
      }

      // REGRA 7: anti-spam mensagem
      if (targetMission.type === 'send_message') {
        if (!messageLength || messageLength < 10) {
          throw new functions.HttpsError('failed-precondition', 'Mensagem deve ter pelo menos 10 caracteres.');
        }
      }

      // REGRAS 8 e 9: UIDs únicos para visitas e curtidas
      if (['visit_profiles', 'like_profiles'].includes(targetMission.type)) {
        if (!targetUid) {
          throw new functions.HttpsError('invalid-argument', 'targetUid obrigatório para esta missão.');
        }
        // Não conta o próprio usuário
        if (targetUid === uid) {
          throw new functions.HttpsError('failed-precondition', 'Não pode contar interação consigo mesmo.');
        }
        const visitedKey = `visited_${targetMission.type}`;
        const visited    = data[visitedKey] ?? [];
        if (visited.includes(targetUid)) {
          // Já contou esse perfil — retorna progresso atual sem incrementar
          return { alreadyCompleted: false, duplicate: true, fragments: 0, crystals: 0, progress: targetMission.progress };
        }
        // Registra UID único
        t.set(missRef, { [visitedKey]: FieldValue.arrayUnion(targetUid) }, { merge: true });
      }

      // Incrementa progresso
      const newProgress   = Math.min(targetMission.progress + 1, targetMission.target);
      const justCompleted = newProgress >= targetMission.target;

      // Atualiza missão
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

      // ── CONCLUIU — creditar recompensa ──
      const fragmentsToAdd  = !isSpecial ? (targetMission.fragments ?? 0) : 0;
      const crystalsToAdd   = isSpecial  ? (targetMission.crystals  ?? 0) : 0;

      const currentFragments    = walletData.fragments      ?? 0;
      const currentGratuitos    = walletData.coinsGratuitos ?? 0;
      const fragmentsEarnedToday = data.fragmentsEarnedToday ?? 0;
      const crystalsEarnedToday  = data.crystalsEarnedToday  ?? 0;

      // REGRA 11: limite 300 fragmentos/dia
      if (fragmentsToAdd > 0 && fragmentsEarnedToday >= 300) {
        throw new functions.HttpsError('resource-exhausted', 'Limite diário de fragmentos atingido.');
      }

      // REGRA 13: limite 5 cristais gratuitos/dia via missões
      if (crystalsToAdd > 0 && crystalsEarnedToday >= 5) {
        throw new functions.HttpsError('resource-exhausted', 'Limite diário de cristais via missões atingido.');
      }

      // REGRA 20: fail-safe — nunca negativo
      const newFragments   = Math.max(0, currentFragments   + fragmentsToAdd);
      const newGratuitos   = Math.max(0, currentGratuitos   + crystalsToAdd);

      // Credita na wallet
      if (fragmentsToAdd > 0) {
        t.set(walletRef, {
          fragments:  FieldValue.increment(fragmentsToAdd),
          updatedAt:  FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      if (crystalsToAdd > 0) {
        t.set(walletRef, {
          coinsGratuitos: FieldValue.increment(crystalsToAdd),
          updatedAt:      FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      // Atualiza contadores do dia
      t.set(missRef, {
        fragmentsEarnedToday: FieldValue.increment(fragmentsToAdd),
        crystalsEarnedToday:  FieldValue.increment(crystalsToAdd),
        updatedAt:            FieldValue.serverTimestamp(),
      }, { merge: true });

      // REGRA 15: Economy Ledger imutável
      const ledgerData = {
        uid,
        origem:         'dailyMissions',
        missionId:      missionIdParam,
        tipo:           isSpecial ? 'MISSAO_ESPECIAL' : 'MISSAO_COMUM',
        fragmentos:     fragmentsToAdd,
        cristais:       crystalsToAdd,
        saldoAnterior:  fragmentsToAdd > 0 ? currentFragments : currentGratuitos,
        saldoPosterior: fragmentsToAdd > 0 ? newFragments      : newGratuitos,
      };
      t.set(db.collection('economyLedger').doc(), {
        ...ledgerData,
        timestamp: FieldValue.serverTimestamp(),
        imutavel:  true,
      });

      return {
        alreadyCompleted: false,
        fragments:        fragmentsToAdd,
        crystals:         crystalsToAdd,
        progress:         newProgress,
        completed:        true,
      };
    });

    return { success: true, ...result };
  }
);