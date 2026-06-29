// ============================================
// LUMINA — ASSET REGISTRY v5.1
// src/assets/index.ts
//
// Registro central de todos os assets visuais.
// NUNCA importar assets diretamente nas telas.
// Quando asset estiver pronto: substituir
// PLACEHOLDER pelo require() real.
// ============================================

const PLACEHOLDER = null;

// ------------------------------------------
// ECONOMIA — Hierarquia de Moedas
// ------------------------------------------
export const ECONOMY_ASSETS = {
  // Cristal Gratuito — Roxo Galáxia, brilho médio, sem partículas
  crystalGratuito:    PLACEHOLDER, // economy/crystal-sintonia-gratuito.png

  // Cristal Premium — Núcleo dourado, bordas roxas, partículas douradas, halo
  crystalPremium:     PLACEHOLDER, // economy/crystal-sintonia-premium.png

  // Fragmento — menor, lilás, sem brilho
  fragment:           PLACEHOLDER, // economy/fragment-sintonia.png

  // Núcleo de Sintonia — reservado para expansão futura
  nucleus:            PLACEHOLDER, // economy/nucleo-sintonia.png

  // Cofre de Sintonia (3 estados)
  vaultEmpty:         PLACEHOLDER, // economy/vault-empty.png
  vaultPartial:       PLACEHOLDER, // economy/vault-partial.png
  vaultFull:          PLACEHOLDER, // economy/vault-full.png (notificação de cheio)

  // Faísca do Destino (visual evolui com valor — lilás→dourado)
  faisca2:            PLACEHOLDER, // economy/faisca-2.png   (lilás)
  faisca5:            PLACEHOLDER, // economy/faisca-5.png   (lilás+brilho)
  faisca10:           PLACEHOLDER, // economy/faisca-10.png  (roxo+brilho)
  faisca20:           PLACEHOLDER, // economy/faisca-20.png  (dourado leve)
  faisca50:           PLACEHOLDER, // economy/faisca-50.png  (dourado+partículas)

  // Baú de Recompensa
  bauClosed:          PLACEHOLDER, // economy/bau-closed.png
  bauOpening:         PLACEHOLDER, // economy/bau-opening.png
  bauOpen:            PLACEHOLDER, // economy/bau-open.png
} as const;

export function getFaiscaAsset(value: number) {
  if (value >= 50) return ECONOMY_ASSETS.faisca50;
  if (value >= 20) return ECONOMY_ASSETS.faisca20;
  if (value >= 10) return ECONOMY_ASSETS.faisca10;
  if (value >= 5)  return ECONOMY_ASSETS.faisca5;
  return ECONOMY_ASSETS.faisca2;
}

// ------------------------------------------
// GATILHOS EMOCIONAIS
// ------------------------------------------
export const TRIGGER_ASSETS = {
  // Quase Sintonia — silhueta misteriosa + coração incompleto + aura roxa
  quaseSintonia:      PLACEHOLDER, // triggers/icon-quase-sintonia.png

  // Alguém Pensou em Você — perfil desfocado + estrela dourada + ondas de energia
  alguemPensou:       PLACEHOLDER, // triggers/icon-alguem-pensou.png

  // Sintonia Perdida — silhueta com X + aura vermelha esmaecendo
  sintoniaPerdida:    PLACEHOLDER, // triggers/icon-sintonia-perdida.png

  // Carta do Destino — carta cósmica + constelações + dourado + roxo galáxia
  destinyCard:        PLACEHOLDER, // triggers/destiny-card.png
  destinyCardBack:    PLACEHOLDER, // triggers/destiny-card-back.png
} as const;

// ------------------------------------------
// PROGRESSÃO — ÁRVORE DA SINTONIA
// ------------------------------------------
export const TREE_ASSETS = {
  broto:          PLACEHOLDER, // progression/tree-0-broto.png
  crescimento:    PLACEHOLDER, // progression/tree-1-crescimento.png
  florescimento:  PLACEHOLDER, // progression/tree-2-florescimento.png
  constelacao:    PLACEHOLDER, // progression/tree-3-constelacao.png
  galaxia:        PLACEHOLDER, // progression/tree-4-galaxia.png
  galaxiaLottie:  PLACEHOLDER, // progression/tree-4-galaxia.json (Lottie animado)
} as const;

export function getTreeAsset(stage: number) {
  const map = [
    TREE_ASSETS.broto,
    TREE_ASSETS.crescimento,
    TREE_ASSETS.florescimento,
    TREE_ASSETS.constelacao,
    TREE_ASSETS.galaxia,
  ];
  return map[Math.min(stage, 4)] ?? TREE_ASSETS.broto;
}

// ------------------------------------------
// MOLDURAS DE PERFIL
// A Moldura Galáxia é a mais importante para vender
// ------------------------------------------
export const FRAME_ASSETS = {
  comum:          null,       // sem moldura
  raro:           PLACEHOLDER, // frames/frame-raro.png    — anel prata fino
  epico:          PLACEHOLDER, // frames/frame-epico.png   — anel lilás + brilho suave
  lendario:       PLACEHOLDER, // frames/frame-lendario.png — anel dourado + partículas
  galaxia:        PLACEHOLDER, // frames/frame-galaxia.png  — nebulosa viva + estrelas orbitando + pulsação roxa + partículas douradas
  galaxiaLottie:  PLACEHOLDER, // frames/frame-galaxia.json (Lottie — versão animada obrigatória)
} as const;

export function getFrameAsset(tier: string) {
  const map: Record<string, unknown> = {
    comum:    FRAME_ASSETS.comum,
    raro:     FRAME_ASSETS.raro,
    epico:    FRAME_ASSETS.epico,
    lendario: FRAME_ASSETS.lendario,
    galaxia:  FRAME_ASSETS.galaxia,
  };
  return map[tier] ?? null;
}

// ------------------------------------------
// BADGES DE CONQUISTA
// ------------------------------------------
export const BADGE_ASSETS = {
  primeiraSintonia: PLACEHOLDER, // badges/badge-primeira-sintonia.svg
  explorador:       PLACEHOLDER, // badges/badge-explorador.svg
  conversador:      PLACEHOLDER, // badges/badge-conversador.svg
  colecionador:     PLACEHOLDER, // badges/badge-colecionador.svg
  constelacao:      PLACEHOLDER, // badges/badge-constelacao.svg
  mestreSintonias:  PLACEHOLDER, // badges/badge-mestre-sintonias.svg
  prestigio1:       PLACEHOLDER, // badges/badge-prestigio-1.svg  — escudo prata
  prestigio2:       PLACEHOLDER, // badges/badge-prestigio-2.svg  — escudo lilás
  prestigio3:       PLACEHOLDER, // badges/badge-prestigio-3.svg  — escudo dourado
  galaxiaPlus:      PLACEHOLDER, // badges/badge-galaxia-plus.svg
} as const;

// ------------------------------------------
// RANKING — Troféus
// ------------------------------------------
export const TROPHY_ASSETS = {
  explorador:  PLACEHOLDER, // trophies/trophy-explorador.png
  sintonias:   PLACEHOLDER, // trophies/trophy-sintonias.png
  constelacao: PLACEHOLDER, // trophies/trophy-constelacao.png
} as const;

export function getTrophyAsset(category: string) {
  const map: Record<string, unknown> = {
    EXPLORADORES: TROPHY_ASSETS.explorador,
    SINTONIAS:    TROPHY_ASSETS.sintonias,
    MISSOES:      TROPHY_ASSETS.constelacao,
  };
  return map[category] ?? null;
}

// ------------------------------------------
// PREMIUM — Os mais importantes para conversão
// ------------------------------------------
export const PREMIUM_ASSETS = {
  // Cartão Galáxia Plus — usado na loja, assinatura, banners (1080x1350)
  galaxiaPlusCard:  PLACEHOLDER, // premium/galaxia-plus-card.png

  // Badge e selos
  badgeGalaxiaPlus: PLACEHOLDER, // premium/badge-galaxia-plus.png
  seloVerificado:   PLACEHOLDER, // premium/selo-verificado.png

  // Ícones de features premium
  turboSintonia:    PLACEHOLDER, // premium/icon-turbo-sintonia.png    — raio roxo/dourado
  superDestaque:    PLACEHOLDER, // premium/icon-super-destaque.png    — estrela pulsante
  megaDestaque:     PLACEHOLDER, // premium/icon-mega-destaque.png     — supernova
  impulsoAtivo:     PLACEHOLDER, // premium/icon-impulso-ativo.png     — foguete cósmico
  perfilGalaxia:    PLACEHOLDER, // premium/icon-perfil-galaxia.png    — coroa galáxia (o mais importante)
  fertilizante:     PLACEHOLDER, // premium/icon-fertilizante.png      — árvore + partículas
} as const;

// ------------------------------------------
// PACOTES DE CRISTAIS — Caixas visuais
// Diferença visual deve ser gritante entre pacotes
// ------------------------------------------
export const PACK_ASSETS = {
  iniciante:  PLACEHOLDER, // packs/pack-iniciante.png  — caixinha simples, poucos cristais
  popular:    PLACEHOLDER, // packs/pack-popular.png    — caixa média, cristais saindo
  supremo:    PLACEHOLDER, // packs/pack-supremo.png    — caixa grande, efeito de luz
  galaxia:    PLACEHOLDER, // packs/pack-galaxia.png    — caixa épica, explosão cósmica
} as const;

export function getPackAsset(packageId: string) {
  const map: Record<string, unknown> = {
    starter: PACK_ASSETS.iniciante,
    popular: PACK_ASSETS.popular,
    supremo: PACK_ASSETS.supremo,
    galaxia: PACK_ASSETS.galaxia,
  };
  return map[packageId] ?? null;
}

// ------------------------------------------
// EVENTOS SEMANAIS
// ------------------------------------------
export const EVENT_ASSETS = {
  semanaSintonia:  PLACEHOLDER, // events/banner-semana-sintonia.png
  segundaMagica:   PLACEHOLDER, // events/banner-segunda-magica.png
  eventoPrestigio: PLACEHOLDER, // events/banner-evento-prestigio.png
  galaxiaWeekend:  PLACEHOLDER, // events/banner-galaxia-weekend.png
} as const;

export function getEventBanner(eventId: string) {
  const map: Record<string, unknown> = {
    semana_sintonia:  EVENT_ASSETS.semanaSintonia,
    segunda_magica:   EVENT_ASSETS.segundaMagica,
    evento_prestigio: EVENT_ASSETS.eventoPrestigio,
    galaxia_weekend:  EVENT_ASSETS.galaxiaWeekend,
  };
  return map[eventId] ?? null;
}

// ------------------------------------------
// ORDEM DE PRODUÇÃO DOS ASSETS
// (referência para o designer)
// ------------------------------------------
// Prioridade 1 — Aparecem em todo lugar
//   1. crystal-sintonia-gratuito.png
//   2. crystal-sintonia-premium.png
//   3. fragment-sintonia.png
//   4. vault-*.png (3 estados)
//   5. destiny-card.png
//   6. icon-quase-sintonia.png
//   7. icon-alguem-pensou.png
//
// Prioridade 2 — Vendem o produto
//   8.  frame-raro.png
//   9.  frame-epico.png
//   10. frame-lendario.png
//   11. frame-galaxia.png + frame-galaxia.json (ANIMADO)
//   12. icon-perfil-galaxia.png
//
// Prioridade 3 — Monetização direta
//   13. pack-iniciante.png até pack-galaxia.png
//   14. galaxia-plus-card.png (1080x1350)
//
// Prioridade 4 — Progressão e engajamento
//   15. tree-0-broto.png até tree-4-galaxia.json
//   16. Badges de conquista
//   17. Troféus de ranking
//   18. Banners de eventos