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
// v5.4 — ÁRVORE EM ~3 MESES DE USO DIÁRIO
//
// A v5.3 fazia o estágio 1 sair na primeira sintonia (50) — a
// pessoa evoluía no primeiro dia e a Galáxia vinha em semanas.
// Decisão de produto: o XP GLOBAL continua livre (teto diário de
// 400, valores inalterados); só a Árvore exige constância.
//
// Referência — uso diário típico, ~3 sintonias e ~3 conversas
// reais por semana (~28 treeXP/dia):
//   Crescimento   ~5 dias    · Florescimento ~3 semanas
//   Constelação   ~7 semanas · Galáxia       ~3 meses
// Uso leve (1+1/semana) chega à Galáxia em ~9 meses; intenso
// (1+1/dia), em ~5 semanas.
//
// No primeiro dia, uma sintonia com conversa dá 65 treeXP: a
// Árvore NÃO evolui no dia 1, e o estágio 1 recompensa quem
// voltou durante a primeira semana.
//
// Recompensas inalteradas.
export const TREE_STAGE_TABLE: TreeStageDef[] = [
  { stage: 0, name: 'Broto',         icon: '🌱', treeXPMin: 0,    reward: { type: 'crystals',  value: 10,         label: '10 Cristais Gratuitos' } },
  { stage: 1, name: 'Crescimento',   icon: '🌿', treeXPMin: 150,  reward: { type: 'frame',     value: 'nebulosa', label: 'Moldura Nebulosa'      } },
  { stage: 2, name: 'Florescimento', icon: '🌸', treeXPMin: 600,  reward: { type: 'badge',     value: 'flor',     label: 'Badge Flor'            } },
  { stage: 3, name: 'Constelação',   icon: '✨', treeXPMin: 1400, reward: { type: 'crystals',  value: 30,         label: '30 Cristais Gratuitos' } },
  { stage: 4, name: 'Galáxia',       icon: '💜', treeXPMin: 2500, reward: { type: 'animation', value: 'galaxia',  label: 'Animação Exclusiva'    } },
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