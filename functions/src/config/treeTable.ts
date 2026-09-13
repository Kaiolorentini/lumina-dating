// ============================================
// LUMINA — TREE TABLE v5.2
// functions/src/config/treeTable.ts
//
// REGRA 26: treeTable separado de xpTable
// REGRA 14: Árvore evolui com treeXP (conexões reais)
// REGRA 15: Recompensa única por estágio
// REGRA 22: treeProgress salvo no documento
// ============================================

export interface TreeStageDef {
  stage:     number;
  name:      string;
  icon:      string;
  treeXPMin: number;
  reward: {
    type:  'crystals' | 'badge' | 'frame' | 'animation';
    value: number | string;
    label: string;
  };
}

// v5.3 — REBALANCEAMENTO
//
// Os limiares antigos foram calibrados para treeXP de 20 por
// sintonia. Com 50, e considerando que só conexão humana real
// alimenta a árvore (REGRA 14), o estágio 4 exigia 30 sintonias
// distintas — mais do que um usuário faz em meses.
//
// A curva nova é progressiva: o estágio 1 sai na PRIMEIRA
// sintonia, porque recompensa imediata é o que prende no início,
// e cada estágio seguinte custa cerca do dobro do anterior.
//
// As recompensas em cristais (10 e 30) não mudaram — são as
// mesmas da economia atual.
export const TREE_STAGE_TABLE: TreeStageDef[] = [
  { stage: 0, name: 'Broto',         icon: '🌱', treeXPMin: 0,   reward: { type: 'crystals',  value: 10,         label: '10 Cristais Gratuitos' } },
  { stage: 1, name: 'Crescimento',   icon: '🌿', treeXPMin: 50,  reward: { type: 'frame',     value: 'nebulosa', label: 'Moldura Nebulosa'      } },
  { stage: 2, name: 'Florescimento', icon: '🌸', treeXPMin: 150, reward: { type: 'badge',     value: 'flor',     label: 'Badge Flor'            } },
  { stage: 3, name: 'Constelação',   icon: '✨', treeXPMin: 350, reward: { type: 'crystals',  value: 30,         label: '30 Cristais Gratuitos' } },
  { stage: 4, name: 'Galáxia',       icon: '💜', treeXPMin: 700, reward: { type: 'animation', value: 'galaxia',  label: 'Animação Exclusiva'    } },
];

export function calcTreeStage(treeXP: number): {
  current:      TreeStageDef;
  next:         TreeStageDef | null;
  progress:     number; // 0-1 — REGRA 22
} {
  let current = TREE_STAGE_TABLE[0];

  for (const stage of TREE_STAGE_TABLE) {
    if (treeXP >= stage.treeXPMin) current = stage;
    else break;
  }

  const nextIdx = TREE_STAGE_TABLE.findIndex(s => s.stage === current.stage + 1);
  const next    = nextIdx >= 0 ? TREE_STAGE_TABLE[nextIdx] : null;

  const progress = next
    ? Math.min((treeXP - current.treeXPMin) / (next.treeXPMin - current.treeXPMin), 1)
    : 1;

  return { current, next, progress };
}