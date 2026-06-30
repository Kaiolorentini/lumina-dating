// ============================================
// LUMINA — TREE CALCULATOR v1.0
// functions/src/gamification/calculators/TreeCalculator.ts
//
// SPRINT 1C — Função pura. Sem Firestore. Sem Transactions.
// ============================================

import { calcTreeStage } from '../../config/treeTable';

const TREE_XP_PER_MATCH = 25;

export interface TreeCalculatorInput {
  isMatchEvent: boolean; // árvore só evolui com MATCH_CREATED
  currentTreeXP: number;
}

export interface TreeCalculatorOutput {
  treeXP:    number;
  treeStage: number;
}

export function calculateTree(input: TreeCalculatorInput): TreeCalculatorOutput | null {
  if (!input.isMatchEvent) return null;

  const newTreeXP = input.currentTreeXP + TREE_XP_PER_MATCH;
  const newTree    = calcTreeStage(newTreeXP);

  return { treeXP: newTreeXP, treeStage: newTree.current.stage };
}