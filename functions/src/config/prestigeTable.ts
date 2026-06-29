// ============================================
// LUMINA — PRESTIGE TABLE v5.1
// functions/src/config/prestigeTable.ts
//
// REGRA 1:  prestigePoints como camada intermediária
// REGRA 2:  Cada marco gera pontos — não sobe direto
// REGRA 7:  Auras visuais por estágio
// REGRA 8:  Prestígio nunca reseta
// REGRA 9:  Feature Flags
// REGRA 11: Nomes definitivos
// REGRA 12: Legado — linha do tempo
// ============================================

// Feature Flags (REGRA 9)
export const PRESTIGE_FLAGS = {
  PRESTIGE_ENABLED: true,
  PRESTIGE_AURAS:   true,
  PRESTIGE_TITLES:  true,
};

// Estágios de Prestígio (REGRA 11 — nomes definitivos)
export interface PrestigeStageDef {
  stage:       number;
  name:        string;
  icon:        string;
  pointsMin:   number;  // REGRA 1 — pontos mínimos para este estágio
  color:       string;
  aura:        string;  // REGRA 7 — descrição da aura visual
  auraAsset:   string;  // asset identifier
  title:       string;  // título desbloqueado
  description: string;
}

export const PRESTIGE_STAGES: PrestigeStageDef[] = [
  {
    stage: 0, name: 'Desperto',         icon: '✨',
    pointsMin: 0,    color: '#C0C0C0',
    aura: 'Brilho prateado suave',      auraAsset: 'aura_desperto',
    title: 'Desperto',
    description: 'Você deu os primeiros passos no universo Lumina.',
  },
  {
    stage: 1, name: 'Guardião',         icon: '🌿',
    pointsMin: 300,  color: '#A8E063',
    aura: 'Folhas verdes discretas',    auraAsset: 'aura_guardiao',
    title: 'Guardião',
    description: 'Você protege e nutre as conexões ao seu redor.',
  },
  {
    stage: 2, name: 'Mentor',           icon: '🌸',
    pointsMin: 800,  color: '#FF9EBC',
    aura: 'Pétalas flutuantes',         auraAsset: 'aura_mentor',
    title: 'Mentor',
    description: 'Sua presença inspira outros a crescer.',
  },
  {
    stage: 3, name: 'Constelação',      icon: '🌌',
    pointsMin: 1800, color: '#FFD700',
    aura: 'Pequenas estrelas orbitando',auraAsset: 'aura_constelacao',
    title: 'Constelação',
    description: 'Você é um ponto de luz que outros seguem.',
  },
  {
    stage: 4, name: 'Lenda da Sintonia', icon: '💜',
    pointsMin: 4000, color: '#B57BEE',
    aura: 'Galáxia viva ao redor',      auraAsset: 'aura_lenda',
    title: 'Lenda da Sintonia',
    description: 'Você é parte da história do Lumina.',
  },
];

// Marcos e seus Prestige Points (REGRA 2)
export interface PrestigeMarco {
  id:          string;
  label:       string;
  points:      number;
  category:    'TIME' | 'SOCIAL' | 'TREE' | 'COLLECTION' | 'SEASON' | 'ACHIEVEMENT';
  repeatable:  boolean;  // se pode ser conquistado múltiplas vezes
  maxTimes:    number;   // 0 = ilimitado
}

export const PRESTIGE_MARCOS: Record<string, PrestigeMarco> = {
  // Tempo ativo (REGRA 5 — meses com login, não criação)
  ACTIVE_30_DAYS:   { id: 'ACTIVE_30_DAYS',   label: '30 dias ativos',        points: 100, category: 'TIME',        repeatable: true,  maxTimes: 0  },
  ACTIVE_90_DAYS:   { id: 'ACTIVE_90_DAYS',   label: '90 dias ativos',        points: 250, category: 'TIME',        repeatable: false, maxTimes: 1  },
  ACTIVE_180_DAYS:  { id: 'ACTIVE_180_DAYS',  label: '180 dias ativos',       points: 500, category: 'TIME',        repeatable: false, maxTimes: 1  },
  ACTIVE_365_DAYS:  { id: 'ACTIVE_365_DAYS',  label: '1 ano ativo',           points: 1000,category: 'TIME',        repeatable: false, maxTimes: 1  },

  // Sintonias reais (REGRA 6 — com conversa + resposta mútua)
  SINTONIA_10_REAL:  { id: 'SINTONIA_10_REAL',  label: '10 sintonias reais',   points: 80,  category: 'SOCIAL',      repeatable: false, maxTimes: 1  },
  SINTONIA_50_REAL:  { id: 'SINTONIA_50_REAL',  label: '50 sintonias reais',   points: 200, category: 'SOCIAL',      repeatable: false, maxTimes: 1  },
  SINTONIA_100_REAL: { id: 'SINTONIA_100_REAL', label: '100 sintonias reais',  points: 400, category: 'SOCIAL',      repeatable: false, maxTimes: 1  },

  // Árvore (REGRA 4 — evento específico verifica só seus marcos)
  TREE_STAGE_2:     { id: 'TREE_STAGE_2',     label: 'Árvore Florescimento',  points: 150, category: 'TREE',        repeatable: false, maxTimes: 1  },
  TREE_STAGE_3:     { id: 'TREE_STAGE_3',     label: 'Árvore Constelação',    points: 250, category: 'TREE',        repeatable: false, maxTimes: 1  },
  TREE_STAGE_4:     { id: 'TREE_STAGE_4',     label: 'Árvore Galáxia',        points: 600, category: 'TREE',        repeatable: false, maxTimes: 1  },

  // Coleções Gold
  COLLECTION_GOLD_1: { id: 'COLLECTION_GOLD_1', label: '1ª Coleção Ouro',     points: 150, category: 'COLLECTION',  repeatable: false, maxTimes: 1  },
  COLLECTION_GOLD_3: { id: 'COLLECTION_GOLD_3', label: '3 Coleções Ouro',     points: 300, category: 'COLLECTION',  repeatable: false, maxTimes: 1  },

  // Temporadas
  SEASON_COMPLETE:  { id: 'SEASON_COMPLETE',  label: 'Temporada completa',    points: 80,  category: 'SEASON',      repeatable: true,  maxTimes: 0  },
  SEASON_3:         { id: 'SEASON_3',         label: '3 temporadas',          points: 200, category: 'SEASON',      repeatable: false, maxTimes: 1  },

  // Conquistas especiais
  ACH_FOUNDER:      { id: 'ACH_FOUNDER',      label: 'Conquista Fundador',    points: 500, category: 'ACHIEVEMENT', repeatable: false, maxTimes: 1  },
  ACH_STREAK_30:    { id: 'ACH_STREAK_30',    label: 'Sequência 30 dias',     points: 100, category: 'ACHIEVEMENT', repeatable: false, maxTimes: 1  },
};

// Calcula estágio baseado em prestigePoints (REGRA 1)
export function calcPrestigeStage(points: number): PrestigeStageDef {
  let current = PRESTIGE_STAGES[0];
  for (const stage of PRESTIGE_STAGES) {
    if (points >= stage.pointsMin) current = stage;
    else break;
  }
  return current;
}

// Próximo estágio
export function nextPrestigeStage(points: number): PrestigeStageDef | null {
  const current = calcPrestigeStage(points);
  const next    = PRESTIGE_STAGES.find(s => s.stage === current.stage + 1);
  return next ?? null;
}