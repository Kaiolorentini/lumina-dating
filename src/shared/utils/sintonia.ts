// ============================================
// UTILITÁRIOS DE SINTONIA
// Funções de label, cor e mensagem
// ============================================

import { SINTONIA } from '../../core/constants';

// Label baseado no score
export function getSintoniaLabel(score: number): string {
  if (score >= 95) return '✦ Sintonia Perfeita';
  if (score >= 85) return '🔥 Alta Sintonia';
  if (score >= 70) return '⚡ Boa Sintonia';
  if (score >= 50) return '💫 Sintonia Moderada';
  return '🌱 Sintonia Inicial';
}

// Cor baseada no score
export function getSintoniaColor(score: number): string {
  if (score >= 95) return '#FFD700';
  if (score >= 85) return '#D4AF37';
  if (score >= 70) return '#A8E063';
  if (score >= 50) return '#56CCF2';
  return '#AAAAAA';
}

// Milestone baseado no score
export function getSintoniaMilestone(score: number): string {
  if (score >= 95) return '✦ Alma gêmea encontrada';
  if (score >= 90) return '🔥 Conexão perfeita';
  if (score >= 80) return '💫 Sintonia incrível';
  if (score >= 70) return '⚡ Conexão forte';
  if (score >= 60) return '💛 Laço especial';
  if (score >= 50) return '🌱 Conexão crescendo';
  if (score >= 40) return '👋 Primeiros passos';
  return '✨ Início de algo especial';
}

// Mensagem de aumento de Sintonia
export function getSintoniaIncreaseMessage(
  oldScore: number,
  newScore: number
): string {
  const diff = newScore - oldScore;
  if (diff <= 0) return '';
  if (newScore >= 95) return '✦ Vocês são almas gêmeas!';
  if (newScore >= 90) return '🔥 Conexão perfeita atingida!';
  if (newScore >= 80) return `💫 Sintonia aumentou para ${newScore.toFixed(0)}%!`;
  if (diff >= 5) return `⚡ Sua Sintonia aumentou para ${newScore.toFixed(0)}%`;
  return `💛 Sintonia evoluiu para ${newScore.toFixed(0)}%`;
}