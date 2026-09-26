// ============================================
// LUMINA — AURA DE PRESTÍGIO
// src/config/prestigeAura.ts
//
// Espelho visual dos estágios do prestígio no cliente. O
// backend concede `progression.prestigeStage`; aqui está o que
// esse número significa na tela.
//
// A aura ESTILIZA O CARD — cor da borda e brilho —, em vez de
// disputar espaço com a moldura. Assim o que a pessoa comprou
// e o que ela conquistou se somam em vez de competir.
//
// ANIMAÇÃO SÓ NOS ESTÁGIOS 3 E 4: o feed mostra vários cards
// ao mesmo tempo, e partículas em todos comem a fluidez da
// rolagem. Constelação e Lenda são raros o bastante para
// valerem o custo; os estágios baixos ficam com cor e brilho,
// que são estáticos e de graça.
// ============================================

export interface PrestigeAuraDef {
  stage:     number;
  name:      string;
  icon:      string;
  /** Cor da borda do card e do brilho. */
  color:     string;
  /** Intensidade do brilho, 0 a 1. Sobe com o estágio. */
  glow:      number;
  /** Partículas animadas ao redor do card. Só 3 e 4. */
  particles: 'none' | 'stars' | 'galaxy';
  description: string;
}

export const PRESTIGE_AURAS: PrestigeAuraDef[] = [
  {
    stage: 0, name: 'Desperto', icon: '✨',
    color: '#C0C0C0', glow: 0,    particles: 'none',
    description: 'Brilho prateado suave',
  },
  {
    stage: 1, name: 'Guardião', icon: '🌿',
    color: '#A8E063', glow: 0.25, particles: 'none',
    description: 'Verde discreto',
  },
  {
    stage: 2, name: 'Mentor', icon: '🌸',
    color: '#FF9EBC', glow: 0.4,  particles: 'none',
    description: 'Rosa de pétalas',
  },
  {
    stage: 3, name: 'Constelação', icon: '🌌',
    color: '#FFD700', glow: 0.6,  particles: 'stars',
    description: 'Estrelas orbitando',
  },
  {
    stage: 4, name: 'Lenda da Sintonia', icon: '💜',
    color: '#B57BEE', glow: 0.85, particles: 'galaxy',
    description: 'Galáxia viva',
  },
];

/**
 * Aura de um estágio. O estágio 0 devolve null: "Desperto" é
 * o padrão de todo mundo e não deve estilizar nada — se todo
 * card tem aura, nenhum tem.
 */
export function auraByStage(stage: number | null | undefined): PrestigeAuraDef | null {
  if (typeof stage !== 'number' || stage <= 0) return null;
  return PRESTIGE_AURAS.find(a => a.stage === stage) ?? null;
}