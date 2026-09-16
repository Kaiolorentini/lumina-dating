// ============================================
// LUMINA — CATÁLOGO DE COSMÉTICOS v1.0
// functions/src/config/cosmeticsCatalog.ts
//
// FASE 5 — molduras de perfil.
//
// DOIS REGIMES DE POSSE, uma leitura só:
//   permanente → progression.unlockedItems.{itemId} = true
//                concedido por conquista (AchievementProcessor)
//   aluguel    → progression.frameRentals.{itemId} = Timestamp
//                comprado na loja, expira em 30 dias
//
// O aluguel é o que sustenta a recompra: a moldura é barata
// justamente porque volta a ser vendida todo mês. Conquista é
// o único caminho para posse definitiva.
//
// NOMENCLATURA: todo item cosmético é `frame_*`. A chave de
// PREÇO continua sendo a de COSTS (MOLDURA_*), que já existe em
// contrato com o cliente — o mapa abaixo faz a tradução. Sem
// isso, a tela teria que entender dois padrões de nome.
// ============================================

export type CosmeticRarity = 'RARE' | 'EPIC' | 'LEGENDARY';
export type CosmeticKind   = 'FRAME';

export interface CosmeticDef {
  id:          string;          // grava em unlockedItems / frameRentals
  costKey:     string;          // chave em COSTS
  kind:        CosmeticKind;
  title:       string;
  description: string;
  rarity:      CosmeticRarity;
  rentalDays:  number;          // 0 = permanente (só conquista)
  // Cores do render — o ProfileFrame desenha a partir daqui
  // enquanto não houver asset de imagem.
  borderColor: string;
  glowColor:   string;
  borderWidth: number;
  animated:    boolean;         // pulso suave no glow
}

// ── MOLDURAS DA LOJA — aluguel de 30 dias, Premium-only ──
export const COSMETICS_CATALOG: Record<string, CosmeticDef> = {

  // ── RARE — 70 Premium ──
  frame_nebulosa: {
    id: 'frame_nebulosa', costKey: 'MOLDURA_NEBULOSA', kind: 'FRAME',
    title: 'Nebulosa', description: 'Poeira estelar em tons de violeta',
    rarity: 'RARE', rentalDays: 30,
    borderColor: '#B57BEE', glowColor: 'rgba(181,123,238,0.55)',
    borderWidth: 2, animated: false,
  },
  frame_eclipse: {
    id: 'frame_eclipse', costKey: 'MOLDURA_ECLIPSE', kind: 'FRAME',
    title: 'Eclipse', description: 'Um anel de sombra e luz',
    rarity: 'RARE', rentalDays: 30,
    borderColor: '#5A4A7A', glowColor: 'rgba(90,74,122,0.55)',
    borderWidth: 2, animated: false,
  },
  frame_maresia: {
    id: 'frame_maresia', costKey: 'MOLDURA_MARESIA', kind: 'FRAME',
    title: 'Maresia', description: 'Azul profundo de mar noturno',
    rarity: 'RARE', rentalDays: 30,
    borderColor: '#56CCF2', glowColor: 'rgba(86,204,242,0.55)',
    borderWidth: 2, animated: false,
  },

  // ── EPIC — 100 Premium ──
  frame_supernova: {
    id: 'frame_supernova', costKey: 'MOLDURA_SUPERNOVA', kind: 'FRAME',
    title: 'Supernova', description: 'O brilho de uma estrela que explode',
    rarity: 'EPIC', rentalDays: 30,
    borderColor: '#FF6B4A', glowColor: 'rgba(255,107,74,0.65)',
    borderWidth: 3, animated: true,
  },
  frame_aurora: {
    id: 'frame_aurora', costKey: 'MOLDURA_AURORA', kind: 'FRAME',
    title: 'Aurora', description: 'Verde e rosa dançando no polo',
    rarity: 'EPIC', rentalDays: 30,
    borderColor: '#44FFAA', glowColor: 'rgba(68,255,170,0.65)',
    borderWidth: 3, animated: true,
  },
  frame_cometa: {
    id: 'frame_cometa', costKey: 'MOLDURA_COMETA', kind: 'FRAME',
    title: 'Cometa', description: 'Rastro dourado atravessando o escuro',
    rarity: 'EPIC', rentalDays: 30,
    borderColor: '#FFC24A', glowColor: 'rgba(255,194,74,0.65)',
    borderWidth: 3, animated: true,
  },

  // ── LEGENDARY — 150 Premium ──
  frame_buraco_negro: {
    id: 'frame_buraco_negro', costKey: 'MOLDURA_BURACO_NEGRO', kind: 'FRAME',
    title: 'Horizonte de Eventos', description: 'Nada escapa do seu perfil',
    rarity: 'LEGENDARY', rentalDays: 30,
    borderColor: '#1A1A2E', glowColor: 'rgba(123,47,190,0.85)',
    borderWidth: 4, animated: true,
  },
  frame_via_lactea: {
    id: 'frame_via_lactea', costKey: 'MOLDURA_VIA_LACTEA', kind: 'FRAME',
    title: 'Via Láctea', description: 'Cem bilhões de estrelas ao seu redor',
    rarity: 'LEGENDARY', rentalDays: 30,
    borderColor: '#FFD700', glowColor: 'rgba(255,215,0,0.85)',
    borderWidth: 4, animated: true,
  },

  // ── FRAMES DE CONQUISTA — permanentes, não vendáveis ──
  // Concedidos pelo AchievementProcessor. Sem costKey: não têm
  // preço e nunca aparecem na loja. Mais simples de propósito —
  // o valor deles é serem definitivos, não chamativos.
  frame_social: {
    id: 'frame_social', costKey: '', kind: 'FRAME',
    title: 'Alma Social', description: 'Conquistado com 50 Sintonias',
    rarity: 'EPIC', rentalDays: 0,
    borderColor: '#B57BEE', glowColor: 'rgba(181,123,238,0.4)',
    borderWidth: 2, animated: false,
  },
  frame_explorer: {
    id: 'frame_explorer', costKey: '', kind: 'FRAME',
    title: 'Explorador', description: 'Conquistado com 100 perfis visitados',
    rarity: 'EPIC', rentalDays: 0,
    borderColor: '#56CCF2', glowColor: 'rgba(86,204,242,0.4)',
    borderWidth: 2, animated: false,
  },
  frame_devoto: {
    id: 'frame_devoto', costKey: '', kind: 'FRAME',
    title: 'Devoto', description: 'Conquistado com 30 dias seguidos',
    rarity: 'LEGENDARY', rentalDays: 0,
    borderColor: '#FF9800', glowColor: 'rgba(255,152,0,0.4)',
    borderWidth: 3, animated: false,
  },
  frame_galaxia: {
    id: 'frame_galaxia', costKey: '', kind: 'FRAME',
    title: 'Galáxia Viva', description: 'Conquistado com a Árvore no estágio Galáxia',
    rarity: 'LEGENDARY', rentalDays: 0,
    borderColor: '#7B2FBE', glowColor: 'rgba(123,47,190,0.5)',
    borderWidth: 3, animated: true,
  },
  frame_fundador: {
    id: 'frame_fundador', costKey: '', kind: 'FRAME',
    title: 'Fundador', description: 'Esteve aqui desde o começo',
    rarity: 'LEGENDARY', rentalDays: 0,
    borderColor: '#FFD700', glowColor: 'rgba(255,215,0,0.5)',
    borderWidth: 3, animated: true,
  },
};

// COSTS key → item id. O spendCoins consulta este mapa: se a
// feature comprada está aqui, concede o item na MESMA transação
// do débito. Nunca debita sem conceder.
export const COST_KEY_TO_COSMETIC: Record<string, string> = Object.values(COSMETICS_CATALOG)
  .filter(c => c.costKey !== '')
  .reduce((acc, c) => { acc[c.costKey] = c.id; return acc; }, {} as Record<string, string>);

// Itens vendáveis, para a loja montar a vitrine.
export const PURCHASABLE_COSMETICS: CosmeticDef[] =
  Object.values(COSMETICS_CATALOG).filter(c => c.costKey !== '');