// ============================================
// LUMINA — CATÁLOGO DE TÍTULOS
// src/config/titlesCatalog.ts
//
// Títulos são conquistados, nunca comprados. Cada um tem um
// SELO CÓSMICO — sem animação, monocromático na cor da
// raridade de origem.
//
// Todos partilham um anel externo, que faz a coleção se ler
// como coleção. Dentro, cada um tem uma configuração astral
// ÚNICA: nenhuma se repete entre os 19.
//
// A hierarquia aparece na DENSIDADE: comuns têm o anel simples
// e poucos corpos; lendários e míticos ganham o segundo anel,
// os raios externos e o interior cheio.
//
// O símbolo vai sozinho no canto superior ESQUERDO da foto,
// espelhando o selo de sintonia à direita. O nome completo só
// aparece no perfil aberto, onde há espaço.
//
// ESPELHO do backend: os títulos são concedidos pelo
// AchievementProcessor a partir de `reward.title` do
// achievementsCatalog e do collectionsCatalog. Se um título
// novo entrar lá e não aqui, o símbolo não desenha.
// ============================================

export type TitleRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';

/** Formas disponíveis. O componente TitleSeal desenha cada uma. */
export type TitleShape =
  | 'elo'            // um elo — primeira conexão
  | 'elo_duplo'      // dois elos com anel
  | 'elos_entrelacados'
  | 'estrela'        // quatro pontas
  | 'estrela_coroada'
  | 'estrela_anel'
  | 'estrela_irradiando'
  | 'barras_duas'
  | 'barras_tres'
  | 'barras_estrela'
  | 'barras_coroa'
  | 'escudo_estrela'
  | 'cristal'
  | 'zero'
  | 'faisca'
  | 'broto'
  | 'flor'
  | 'cruzeiro'
  | 'supernova';

export interface TitleDef {
  id:        string;   // igual ao texto em reward.title
  label:     string;   // como aparece na tela
  shape:     TitleShape;
  rarity:    TitleRarity;
  /** De onde veio — mostrado na tela de títulos. */
  source:    string;
}

export const TITLES: Record<string, TitleDef> = {

  // ── De conquistas ──
  'Conectado': {
    id: 'Conectado', label: 'Conectado', shape: 'elo',
    rarity: 'RARE', source: 'Crie 10 Sintonias',
  },
  'Alma Gêmea': {
    id: 'Alma Gêmea', label: 'Alma Gêmea', shape: 'elos_entrelacados',
    rarity: 'LEGENDARY', source: 'Sintonia com 95%+ de compatibilidade',
  },
  'Explorador': {
    id: 'Explorador', label: 'Explorador', shape: 'estrela',
    rarity: 'EPIC', source: 'Visite 100 perfis',
  },
  'Mestre': {
    id: 'Mestre', label: 'Mestre', shape: 'barras_duas',
    rarity: 'EPIC', source: 'Complete 100 missões',
  },
  'Devoto': {
    id: 'Devoto', label: 'Devoto', shape: 'barras_tres',
    rarity: 'LEGENDARY', source: 'Entre 30 dias seguidos',
  },
  'Guardião da Sintonia': {
    id: 'Guardião da Sintonia', label: 'Guardião da Sintonia', shape: 'escudo_estrela',
    rarity: 'MYTHIC', source: 'Árvore no estágio Galáxia',
  },
  'Fundador': {
    id: 'Fundador', label: 'Fundador', shape: 'estrela_anel',
    rarity: 'MYTHIC', source: 'Entrou durante o lançamento',
  },
  'Creator Zero': {
    id: 'Creator Zero', label: 'Creator Zero', shape: 'zero',
    rarity: 'MYTHIC', source: 'Primeiro criador do Lumina',
  },
  'Apoiador': {
    id: 'Apoiador', label: 'Apoiador', shape: 'cristal',
    rarity: 'RARE', source: 'Primeira compra de cristais',
  },

  // ── De coleções ──
  // "Alma Social" vem da conquista SINTONIA_50 E da coleção
  // SOCIAL_GOLD — um símbolo só, conquistado por qualquer dos
  // dois caminhos.
  'Alma Social': {
    id: 'Alma Social', label: 'Alma Social', shape: 'elo_duplo',
    rarity: 'EPIC', source: 'Coleção Social Ouro',
  },
  'Explorador Supremo': {
    id: 'Explorador Supremo', label: 'Explorador Supremo', shape: 'estrela_coroada',
    rarity: 'LEGENDARY', source: 'Coleção Explorador Ouro',
  },
  'Mestre Supremo': {
    id: 'Mestre Supremo', label: 'Mestre Supremo', shape: 'barras_estrela',
    rarity: 'LEGENDARY', source: 'Coleção Missões Ouro',
  },
  'Devoto Supremo': {
    id: 'Devoto Supremo', label: 'Devoto Supremo', shape: 'barras_coroa',
    rarity: 'LEGENDARY', source: 'Coleção Sequência Ouro',
  },
  'Pioneiro': {
    id: 'Pioneiro', label: 'Pioneiro', shape: 'estrela_irradiando',
    rarity: 'MYTHIC', source: 'Coleção Fundador',
  },

  // ── De estágios de prestígio ──
  // O prestígio concede o título do estágio ao subir. Sem estes
  // cinco, titleById devolvia null e o símbolo não desenhava.
  // Formas PRÓPRIAS. Estes cinco copiavam as de Explorador,
  // Guardião da Sintonia, Alma Social, Explorador Supremo e
  // Pioneiro — cinco pares desenhando idêntico.
  'Desperto': {
    id: 'Desperto', label: 'Desperto', shape: 'faisca',
    rarity: 'COMMON', source: 'Prestígio · estágio inicial',
  },
  'Guardião': {
    id: 'Guardião', label: 'Guardião', shape: 'broto',
    rarity: 'RARE', source: 'Prestígio · 300 pontos',
  },
  'Mentor': {
    id: 'Mentor', label: 'Mentor', shape: 'flor',
    rarity: 'EPIC', source: 'Prestígio · 800 pontos',
  },
  'Constelação': {
    id: 'Constelação', label: 'Constelação', shape: 'cruzeiro',
    rarity: 'LEGENDARY', source: 'Prestígio · 1.800 pontos',
  },
  'Lenda da Sintonia': {
    id: 'Lenda da Sintonia', label: 'Lenda da Sintonia', shape: 'supernova',
    rarity: 'MYTHIC', source: 'Prestígio · 4.000 pontos',
  },
};

/** Cor do símbolo por raridade — mesma escala dos cosméticos. */
export const TITLE_RARITY_COLOR: Record<TitleRarity, string> = {
  COMMON:    '#9E9E9E',
  RARE:      '#4FC3F7',
  EPIC:      '#B57BEE',
  LEGENDARY: '#FFD700',
  MYTHIC:    '#FF6B9D',
};

export function titleById(id: string | null | undefined): TitleDef | null {
  if (!id) return null;
  return TITLES[id] ?? null;
}

/** Lista para a tela de títulos, em ordem de raridade. */
const RARITY_ORDER: TitleRarity[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];

export function allTitles(): TitleDef[] {
  return Object.values(TITLES).sort(
    (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity),
  );
}