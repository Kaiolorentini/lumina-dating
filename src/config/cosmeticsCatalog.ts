// ============================================
// LUMINA — CATÁLOGO VISUAL DE COSMÉTICOS (CLIENTE)
// src/config/cosmeticsCatalog.ts
//
// FASE 5 Etapa 2 — fonte única da aparência de molduras e badges.
//
// POR QUE EXISTE: para desenhar a moldura de OUTRA pessoa, o
// ProfileCard precisa das mesmas cores que a loja usa. Antes o
// catálogo estava copiado dentro de FramesShopScreen e
// BadgesShopScreen; uma terceira cópia seria onde a divergência
// nasceria.
//
// Espelho de functions/src/config/{cosmeticsCatalog,badgesCatalog}.ts,
// só com o que o cliente precisa DESENHAR. Preço continua vindo
// do servidor (R3B) — os valores aqui são exibição.
// ============================================

import { BadgeShape, BadgeMotion } from '../components/profile/Badge';
import { FrameScene }              from '../components/profile/ProfileFrame';

export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';

export const RARITY_LABEL: Record<string, string> = {
  COMMON: 'Comum', RARE: 'Rara', EPIC: 'Épica',
  LEGENDARY: 'Lendária', MYTHIC: 'Mítica',
};

export const RARITY_COLOR: Record<string, string> = {
  COMMON: '#8FA3C8', RARE: '#56CCF2', EPIC: '#B57BEE',
  LEGENDARY: '#FFD700', MYTHIC: '#FF6B8A',
};

// ── MOLDURAS ──

export interface FrameLook {
  id:          string;
  costKey:     string | null;  // null = só por conquista
  title:       string;
  description: string;
  rarity:      Rarity;
  price:       number;         // 0 quando não vendável
  borderColor: string;
  glowColor:   string;
  borderWidth: number;
  animated:    boolean;
  /** Cena desenhada ao redor da foto — é ela que cumpre a
   *  descrição. Sem isso, "cem bilhões de estrelas" vira anel. */
  scene:       FrameScene;
}

export const FRAMES: Record<string, FrameLook> = {
  // Vendáveis — aluguel de 30 dias, Premium-only
  frame_nebulosa:     { id: 'frame_nebulosa',     costKey: 'MOLDURA_NEBULOSA',     title: 'Nebulosa',             description: 'Nuvens de poeira violeta em lenta deriva',   rarity: 'RARE',      price: 70,  borderColor: '#B57BEE', glowColor: 'rgba(181,123,238,0.55)', borderWidth: 2, animated: true, scene: 'nebulosa' },
  frame_eclipse:      { id: 'frame_eclipse',      costKey: 'MOLDURA_ECLIPSE',      title: 'Eclipse',              description: 'A coroa de luz que só o escuro revela',      rarity: 'RARE',      price: 70,  borderColor: '#5A4A7A', glowColor: 'rgba(232,216,168,0.55)', borderWidth: 2, animated: true, scene: 'eclipse' },
  frame_maresia:      { id: 'frame_maresia',      costKey: 'MOLDURA_MARESIA',      title: 'Maresia',              description: 'Ondas de mar noturno sob o luar',            rarity: 'RARE',      price: 70,  borderColor: '#56CCF2', glowColor: 'rgba(86,204,242,0.55)',  borderWidth: 2, animated: true, scene: 'maresia' },
  frame_supernova:    { id: 'frame_supernova',    costKey: 'MOLDURA_SUPERNOVA',    title: 'Supernova',            description: 'A onda de choque de uma estrela morrendo',   rarity: 'EPIC',      price: 100, borderColor: '#FF6B4A', glowColor: 'rgba(255,107,74,0.65)',  borderWidth: 3, animated: true, scene: 'supernova' },
  frame_aurora:       { id: 'frame_aurora',       costKey: 'MOLDURA_AURORA',       title: 'Aurora',               description: 'Cortinas de verde e rosa dançando no polo',  rarity: 'EPIC',      price: 100, borderColor: '#44FFAA', glowColor: 'rgba(68,255,170,0.65)',  borderWidth: 3, animated: true, scene: 'aurora' },
  frame_cometa:       { id: 'frame_cometa',       costKey: 'MOLDURA_COMETA',       title: 'Cometa',               description: 'Um rastro dourado dando a volta por você',   rarity: 'EPIC',      price: 100, borderColor: '#FFC24A', glowColor: 'rgba(255,194,74,0.65)',  borderWidth: 3, animated: true, scene: 'cometa' },
  frame_buraco_negro: { id: 'frame_buraco_negro', costKey: 'MOLDURA_BURACO_NEGRO', title: 'Horizonte de Eventos', description: 'Um disco de acreção girando em torno do nada', rarity: 'LEGENDARY', price: 150, borderColor: '#FFD700', glowColor: 'rgba(255,215,0,0.85)',   borderWidth: 4, animated: true, scene: 'buraco_negro' },
  frame_via_lactea:   { id: 'frame_via_lactea',   costKey: 'MOLDURA_VIA_LACTEA',   title: 'Via Láctea',           description: 'Braços espirais e cem bilhões de estrelas',  rarity: 'LEGENDARY', price: 150, borderColor: '#FFD700', glowColor: 'rgba(255,244,208,0.85)', borderWidth: 4, animated: true, scene: 'via_lactea' },

  // De conquista — permanentes, nunca na loja
  // Conquista: cena sóbria de propósito. O valor delas é serem
  // permanentes, não competirem em brilho com as pagas.
  frame_social:    { id: 'frame_social',    costKey: null, title: 'Alma Social',   description: 'Conquistado com 50 Sintonias',           rarity: 'EPIC',      price: 0, borderColor: '#B57BEE', glowColor: 'rgba(181,123,238,0.4)', borderWidth: 2, animated: false, scene: 'conquista' },
  frame_explorer:  { id: 'frame_explorer',  costKey: null, title: 'Explorador',    description: 'Conquistado com 100 perfis visitados',   rarity: 'EPIC',      price: 0, borderColor: '#56CCF2', glowColor: 'rgba(86,204,242,0.4)',  borderWidth: 2, animated: false, scene: 'conquista' },
  frame_devoto:    { id: 'frame_devoto',    costKey: null, title: 'Devoto',        description: 'Conquistado com 30 dias seguidos',       rarity: 'LEGENDARY', price: 0, borderColor: '#FF9800', glowColor: 'rgba(255,152,0,0.4)',   borderWidth: 3, animated: false, scene: 'conquista' },
  frame_galaxia:   { id: 'frame_galaxia',   costKey: null, title: 'Galáxia Viva',  description: 'Conquistado com a Árvore no estágio Galáxia', rarity: 'LEGENDARY', price: 0, borderColor: '#7B2FBE', glowColor: 'rgba(123,47,190,0.5)', borderWidth: 3, animated: true, scene: 'nebulosa' },
  frame_fundador:  { id: 'frame_fundador',  costKey: null, title: 'Fundador',      description: 'Esteve aqui desde o começo',             rarity: 'LEGENDARY', price: 0, borderColor: '#FFD700', glowColor: 'rgba(255,215,0,0.5)',   borderWidth: 3, animated: true, scene: 'via_lactea' },

  // Criador — a única moldura de fogo. O contraste com as oito
  // cósmicas é proposital: a insígnia precisa ser reconhecida de
  // longe, e quem produz conteúdo queima por isso.
  // A descrição diz COMO se obtém, porque ela aparece na tela de
  // molduras de quem ainda não é criador.
  frame_forja:     { id: 'frame_forja',     costKey: null, title: 'Forja',         description: 'Exclusiva de criadores — concedida quando a equipe aprova seu pedido para publicar conteúdo', rarity: 'MYTHIC', price: 0, borderColor: '#FF8A1F', glowColor: 'rgba(255,138,31,0.75)', borderWidth: 4, animated: true, scene: 'forja' },
};

export const PURCHASABLE_FRAMES: FrameLook[] =
  Object.values(FRAMES).filter(f => f.costKey !== null);

// Aparência pronta para o ProfileFrame. null quando o id não
// existe no catálogo — protege contra dado antigo no Firestore.
export function frameAppearanceById(frameId: string | null | undefined) {
  if (!frameId) return null;
  const def = FRAMES[frameId];
  if (!def) return null;
  return {
    borderColor: def.borderColor,
    glowColor:   def.glowColor,
    borderWidth: def.borderWidth,
    animated:    def.animated,
    scene:       def.scene,
  };
}

// ── BADGES ──
//
// FASE 8: badges são SINAIS DE INTENÇÃO. `meaning` é o que a
// pessoa está dizendo sobre si, e aparece no card ao lado do
// símbolo — um ícone sozinho não comunica "só de passagem".

export interface BadgeLook {
  id:          string;
  costKey:     string | null;   // null = fragmentos ou conquista
  title:       string;
  meaning:     string;
  rarity:      Rarity;
  currency:    'FRAGMENTS' | 'CRYSTALS' | 'ACHIEVEMENT';
  price:       number;
  /** 0 = permanente. Fragmentos são sempre 0. */
  rentalDays:  number;
  shape:       BadgeShape;
  coreColor:   string;
  accentColor: string;
  glowColor:   string;
  motion:      BadgeMotion;
}

export const BADGES: Record<string, BadgeLook> = {
  // ── FRAGMENTOS — permanentes ──
  badge_faisca:          { id: 'badge_faisca',          costKey: null, title: 'Faísca',          meaning: 'Começando agora, sem pressa de rótulo',            rarity: 'COMMON', currency: 'FRAGMENTS', price: 150, rentalDays: 0,  shape: 'spark',         coreColor: '#B57BEE', accentColor: '#E0CCFF', glowColor: 'rgba(181,123,238,0.45)', motion: 'none' },
  badge_orbita:          { id: 'badge_orbita',          costKey: null, title: 'Órbita',          meaning: 'Gosta de companhia constante',                     rarity: 'COMMON', currency: 'FRAGMENTS', price: 250, rentalDays: 0,  shape: 'orbit',         coreColor: '#56CCF2', accentColor: '#CFF0FF', glowColor: 'rgba(86,204,242,0.45)',  motion: 'none' },
  badge_constelacao:     { id: 'badge_constelacao',     costKey: null, title: 'Constelação',     meaning: 'Coleciona boas conversas',                         rarity: 'COMMON', currency: 'FRAGMENTS', price: 400, rentalDays: 0,  shape: 'constellation', coreColor: '#FFFFFF', accentColor: '#9BB8FF', glowColor: 'rgba(155,184,255,0.45)', motion: 'none' },
  badge_mare:            { id: 'badge_mare',            costKey: null, title: 'Maré',            meaning: 'Vai e volta, no próprio ritmo',                    rarity: 'COMMON', currency: 'FRAGMENTS', price: 600, rentalDays: 0,  shape: 'tide',          coreColor: '#4A9FD4', accentColor: '#C8E8FF', glowColor: 'rgba(74,159,212,0.45)',  motion: 'none' },

  // ── RARE — 70 cristais, 30 dias ──
  badge_meteoro:         { id: 'badge_meteoro',         costKey: 'BADGE_METEORO',         title: 'Meteoro',         meaning: 'Intenso e rápido — prefere o que arde ao que dura',   rarity: 'RARE', currency: 'CRYSTALS', price: 70, rentalDays: 30, shape: 'meteor',     coreColor: '#FFC24A', accentColor: '#FFE9B8', glowColor: 'rgba(255,194,74,0.6)',  motion: 'breathe' },
  badge_pulsar:          { id: 'badge_pulsar',          costKey: 'BADGE_PULSAR',          title: 'Pulsar',          meaning: 'Direto — manda sinal e espera resposta',              rarity: 'RARE', currency: 'CRYSTALS', price: 70, rentalDays: 30, shape: 'pulsar',     coreColor: '#7BE0FF', accentColor: '#CFF6FF', glowColor: 'rgba(123,224,255,0.6)', motion: 'breathe' },
  badge_bussola:         { id: 'badge_bussola',         costKey: 'BADGE_BUSSOLA',         title: 'Bússola',         meaning: 'Sabe exatamente o que procura',                       rarity: 'RARE', currency: 'CRYSTALS', price: 70, rentalDays: 30, shape: 'compass',    coreColor: '#D4AF37', accentColor: '#FFF0C0', glowColor: 'rgba(212,175,55,0.6)',  motion: 'breathe' },
  badge_farol:           { id: 'badge_farol',           costKey: 'BADGE_FAROL',           title: 'Farol',           meaning: 'Aqui para quem precisa de porto seguro',              rarity: 'RARE', currency: 'CRYSTALS', price: 70, rentalDays: 30, shape: 'lighthouse', coreColor: '#FFE9A8', accentColor: '#FFFFFF', glowColor: 'rgba(255,233,168,0.6)', motion: 'breathe' },
  badge_andarilho:       { id: 'badge_andarilho',       costKey: 'BADGE_ANDARILHO',       title: 'Andarilho',       meaning: 'Só de passagem, sem promessas',                       rarity: 'RARE', currency: 'CRYSTALS', price: 70, rentalDays: 30, shape: 'wanderer',   coreColor: '#9B8FA8', accentColor: '#E0D8E8', glowColor: 'rgba(155,143,168,0.6)', motion: 'breathe' },
  badge_estufa:          { id: 'badge_estufa',          costKey: 'BADGE_ESTUFA',          title: 'Estufa',          meaning: 'Amizade primeiro — o resto se vê',                    rarity: 'RARE', currency: 'CRYSTALS', price: 70, rentalDays: 30, shape: 'greenhouse', coreColor: '#5FD48A', accentColor: '#C8FFDC', glowColor: 'rgba(95,212,138,0.6)',  motion: 'breathe' },

  // ── EPIC — 100 cristais, 30 dias ──
  badge_anel_gelo:       { id: 'badge_anel_gelo',       costKey: 'BADGE_ANEL_GELO',       title: 'Anel de Gelo',    meaning: 'Difícil de alcançar — quem chegar vai ter merecido',  rarity: 'EPIC', currency: 'CRYSTALS', price: 100, rentalDays: 30, shape: 'ice_ring',       coreColor: '#A8E6FF', accentColor: '#FFFFFF', glowColor: 'rgba(168,230,255,0.7)', motion: 'rotate' },
  badge_poeira_estelar:  { id: 'badge_poeira_estelar',  costKey: 'BADGE_POEIRA_ESTELAR',  title: 'Poeira Estelar',  meaning: 'Aberto ao acaso — deixa acontecer',                   rarity: 'EPIC', currency: 'CRYSTALS', price: 100, rentalDays: 30, shape: 'stardust',       coreColor: '#C89BFF', accentColor: '#F0E0FF', glowColor: 'rgba(200,155,255,0.7)', motion: 'rotate' },
  badge_coroa_solar:     { id: 'badge_coroa_solar',     costKey: 'BADGE_COROA_SOLAR',     title: 'Coroa Solar',     meaning: 'Reservado por fora, incandescente por dentro',        rarity: 'EPIC', currency: 'CRYSTALS', price: 100, rentalDays: 30, shape: 'solar_crown',    coreColor: '#1A1A2E', accentColor: '#FFB347', glowColor: 'rgba(255,179,71,0.7)',  motion: 'rotate' },
  badge_nebulosa_carmim: { id: 'badge_nebulosa_carmim', costKey: 'BADGE_NEBULOSA_CARMIM', title: 'Nebulosa Carmim', meaning: 'Romântico sem medo de ser — quer história',            rarity: 'EPIC', currency: 'CRYSTALS', price: 100, rentalDays: 30, shape: 'crimson_nebula', coreColor: '#FF6B8A', accentColor: '#FFD0DC', glowColor: 'rgba(255,107,138,0.7)', motion: 'rotate' },
  badge_eclipse:         { id: 'badge_eclipse',         costKey: 'BADGE_ECLIPSE',         title: 'Eclipse',         meaning: 'Discreto — prefere o que ninguém vê',                 rarity: 'EPIC', currency: 'CRYSTALS', price: 100, rentalDays: 30, shape: 'eclipse',        coreColor: '#14141F', accentColor: '#E8D8A8', glowColor: 'rgba(232,216,168,0.7)', motion: 'rotate' },
  badge_cristal:         { id: 'badge_cristal',         costKey: 'BADGE_CRISTAL',         title: 'Cristal',         meaning: 'Transparente demais — fala o que pensa',              rarity: 'EPIC', currency: 'CRYSTALS', price: 100, rentalDays: 30, shape: 'prism',          coreColor: '#D8F0FF', accentColor: '#8FD4FF', glowColor: 'rgba(216,240,255,0.7)', motion: 'rotate' },

  // ── LEGENDARY — 150 cristais, 30 dias ──
  badge_quasar:          { id: 'badge_quasar',          costKey: 'BADGE_QUASAR',          title: 'Quasar',          meaning: 'Impossível de ignorar — sabe o que tem e o que quer', rarity: 'LEGENDARY', currency: 'CRYSTALS', price: 150, rentalDays: 30, shape: 'quasar',      coreColor: '#FFFFFF', accentColor: '#7B2FBE', glowColor: 'rgba(123,47,190,0.85)', motion: 'orbit_particles' },
  badge_singularidade:   { id: 'badge_singularidade',   costKey: 'BADGE_SINGULARIDADE',   title: 'Singularidade',   meaning: 'Lobo solitário — mas quem entrar, entra sem volta',   rarity: 'LEGENDARY', currency: 'CRYSTALS', price: 150, rentalDays: 30, shape: 'singularity', coreColor: '#0A0A14', accentColor: '#FFD700', glowColor: 'rgba(255,215,0,0.85)',  motion: 'orbit_particles' },
  badge_genese:          { id: 'badge_genese',          costKey: 'BADGE_GENESE',          title: 'Gênese',          meaning: 'Pronto para recomeçar — página em branco',            rarity: 'LEGENDARY', currency: 'CRYSTALS', price: 150, rentalDays: 30, shape: 'genesis',     coreColor: '#FFFFFF', accentColor: '#FFE9B8', glowColor: 'rgba(255,255,255,0.9)', motion: 'orbit_particles' },
  badge_via_lactea:      { id: 'badge_via_lactea',      costKey: 'BADGE_VIA_LACTEA',      title: 'Via Láctea',      meaning: 'Vasto demais para um só — e honesto sobre isso',      rarity: 'LEGENDARY', currency: 'CRYSTALS', price: 150, rentalDays: 30, shape: 'milky_way',   coreColor: '#FFF4D0', accentColor: '#B57BEE', glowColor: 'rgba(255,244,208,0.85)', motion: 'orbit_particles' },
};

export const FRAGMENT_BADGES: BadgeLook[] =
  Object.values(BADGES).filter(b => b.currency === 'FRAGMENTS');

export const CRYSTAL_BADGES: BadgeLook[] =
  Object.values(BADGES).filter(b => b.currency === 'CRYSTALS');

// Aparência de fallback para badges de CONQUISTA, que não estão
// no catálogo da loja — derivada da raridade.
const ACHIEVEMENT_LOOK: Record<string, {
  shape: BadgeShape; coreColor: string; accentColor: string;
  glowColor: string; motion: BadgeMotion;
}> = {
  COMMON:    { shape: 'spark',       coreColor: '#8FA3C8', accentColor: '#D6E0F5', glowColor: 'rgba(143,163,200,0.4)', motion: 'none' },
  RARE:      { shape: 'orbit',       coreColor: '#56CCF2', accentColor: '#CFF0FF', glowColor: 'rgba(86,204,242,0.5)',  motion: 'breathe' },
  EPIC:      { shape: 'pulsar',      coreColor: '#B57BEE', accentColor: '#E8D4FF', glowColor: 'rgba(181,123,238,0.6)', motion: 'breathe' },
  LEGENDARY: { shape: 'solar_crown', coreColor: '#2A2018', accentColor: '#FFD700', glowColor: 'rgba(255,215,0,0.7)',   motion: 'rotate' },
  MYTHIC:    { shape: 'genesis',     coreColor: '#FFFFFF', accentColor: '#FFD700', glowColor: 'rgba(255,215,0,0.85)',  motion: 'orbit_particles' },
};

export function badgeAppearanceById(
  badgeId: string | null | undefined,
  fallbackRarity: Rarity = 'COMMON',
) {
  if (!badgeId) return null;
  const def = BADGES[badgeId];
  if (def) {
    return {
      shape:       def.shape,
      coreColor:   def.coreColor,
      accentColor: def.accentColor,
      glowColor:   def.glowColor,
      motion:      def.motion,
    };
  }
  // Badge de conquista — não está no catálogo da loja.
  return ACHIEVEMENT_LOOK[fallbackRarity] ?? ACHIEVEMENT_LOOK.COMMON;
}

/** Significado do badge, para exibir no card. null se não for da loja. */
export function badgeMeaningById(badgeId: string | null | undefined): string | null {
  if (!badgeId) return null;
  return BADGES[badgeId]?.meaning ?? null;
}