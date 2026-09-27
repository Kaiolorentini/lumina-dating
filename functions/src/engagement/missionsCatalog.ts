// ============================================
// LUMINA — CATÁLOGO DE MISSÕES DIÁRIAS
// functions/src/engagement/missionsCatalog.ts
//
// Fonte única do catálogo e do sorteio. O dailyMissions.ts (telas)
// e o MissionService (eventos do servidor) geram o dia pelo MESMO
// código — antes a geração estava copiada em duas CFs.
//
// Trocas de 27/09:
//   view_media     → buy_product  (a aba Mídia saiu do app)
//   update_profile → update_photo (verificável pelo Storage)
//
// Sem marketplace ativo, buy_product NÃO entra no sorteio —
// ninguém recebe missão impossível.
// ============================================

import * as admin from 'firebase-admin';

export interface CommonMissionDef {
  type:      string;
  label:     string;
  icon:      string;
  fragments: number;
  target:    number;
  unit:      string;
}

export interface SpecialMissionDef {
  type:     string;
  label:    string;
  icon:     string;
  crystals: number;
  target:   number;
}

export const MISSIONS_CATALOG: CommonMissionDef[] = [
  { type: 'visit_profiles', label: 'Visitar 3 perfis diferentes',            icon: '👁️', fragments: 10, target: 3, unit: 'perfis'     },
  { type: 'send_message',   label: 'Enviar 1 mensagem (mín. 10 caracteres)', icon: '💬', fragments: 15, target: 1, unit: 'mensagem'   },
  { type: 'open_destiny',   label: 'Abrir Carta do Destino',                 icon: '🃏', fragments: 10, target: 1, unit: 'carta'      },
  { type: 'claim_faisca',   label: 'Resgatar Faísca do Destino',             icon: '⚡', fragments: 10, target: 1, unit: 'faísca'     },
  { type: 'claim_daily',    label: 'Resgatar recompensa diária',             icon: '🎁', fragments: 10, target: 1, unit: 'recompensa' },
  { type: 'like_profiles',  label: 'Curtir 3 perfis diferentes',             icon: '💜', fragments: 12, target: 3, unit: 'curtidas'   },
  { type: 'buy_product',    label: 'Comprar um produto no Marketplace',      icon: '🛍️', fragments: 15, target: 1, unit: 'compra'     },
  { type: 'update_photo',   label: 'Atualizar sua foto de perfil',           icon: '📸', fragments: 15, target: 1, unit: 'foto'       },
];

export const SPECIAL_MISSIONS_CATALOG: SpecialMissionDef[] = [
  { type: 'create_sintonia',  label: 'Criar uma nova Sintonia',    icon: '✨', crystals: 1, target: 1 },
  { type: 'complete_profile', label: 'Perfil 100% completo',       icon: '🏆', crystals: 1, target: 1 },
  { type: 'receive_like',     label: 'Receber uma curtida',        icon: '💖', crystals: 1, target: 1 },
  { type: 'long_chat',        label: 'Trocar 5 mensagens no chat', icon: '💬', crystals: 1, target: 5 },
];

const COMMON_PER_DAY = 3;

function drawCommon(uid: string, dateStr: string, catalog: CommonMissionDef[]): CommonMissionDef[] {
  const seed = uid.slice(0, 8) + dateStr.replace(/-/g, '');
  let current = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const indices: number[] = [];
  const wanted = Math.min(COMMON_PER_DAY, catalog.length);

  // Guarda contra ciclo curto do gerador: completa em ordem.
  let guard = 0;
  while (indices.length < wanted && guard < 200) {
    const idx = current % catalog.length;
    if (!indices.includes(idx)) indices.push(idx);
    current = (current * 31 + 7) % 97;
    guard++;
  }
  for (let i = 0; indices.length < wanted && i < catalog.length; i++) {
    if (!indices.includes(i)) indices.push(i);
  }
  return indices.map(i => catalog[i]);
}

function drawSpecial(uid: string, dateStr: string): SpecialMissionDef {
  const seed = uid.slice(2, 10) + dateStr.replace(/-/g, '');
  const hash = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return SPECIAL_MISSIONS_CATALOG[hash % SPECIAL_MISSIONS_CATALOG.length];
}

export function missionId(dateStr: string, type: string): string {
  return `daily_${dateStr.replace(/-/g, '_')}_${type}`;
}

/** Documento do dia, sem generatedAt (quem grava acrescenta). */
export function buildDailyMissionsDoc(
  uid: string,
  dateStr: string,
  marketplaceOpen: boolean,
): Record<string, unknown> {
  const catalog = marketplaceOpen
    ? MISSIONS_CATALOG
    : MISSIONS_CATALOG.filter(m => m.type !== 'buy_product');

  const missions = drawCommon(uid, dateStr, catalog).map(m => ({
    missionId: missionId(dateStr, m.type),
    type:      m.type,
    label:     m.label,
    icon:      m.icon,
    fragments: m.fragments,
    target:    m.target,
    unit:      m.unit,
    progress:  0,
    completed: false,
    claimed:   false,
  }));

  const s = drawSpecial(uid, dateStr);
  const special = {
    missionId: missionId(dateStr, s.type),
    type:      s.type,
    label:     s.label,
    icon:      s.icon,
    crystals:  s.crystals,
    target:    s.target,
    progress:  0,
    completed: false,
    claimed:   false,
  };

  return {
    uid,
    date: dateStr,
    missions,
    special,
    fragmentsEarnedToday: 0,
    crystalsEarnedToday:  0,
  };
}

// Mesma regra das rules (isMarketplaceEnabled). Cache de 5 min
// por instância: é lido a cada evento que gera o dia.
let marketplaceCache: { value: boolean; at: number } | null = null;
const MARKETPLACE_CACHE_MS = 5 * 60 * 1000;

export async function isMarketplaceOpen(): Promise<boolean> {
  if (marketplaceCache && Date.now() - marketplaceCache.at < MARKETPLACE_CACHE_MS) {
    return marketplaceCache.value;
  }
  const snap  = await admin.firestore().collection('appSettings').doc('config').get();
  const data  = snap.data() ?? {};
  const value = data.marketplaceEnabled === true && data.maintenanceMode !== true;
  marketplaceCache = { value, at: Date.now() };
  return value;
}