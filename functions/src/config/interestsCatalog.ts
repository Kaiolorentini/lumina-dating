// ============================================
// LUMINA — CATÁLOGO DE INTERESSES (SERVIDOR)
// functions/src/config/interestsCatalog.ts
//
// Lista FECHADA (12/10/2026): texto livre faria "trilha" e "trilhas"
// contarem como interesses diferentes e abriria espaço para contato
// externo e palavrão. Ficam de fora assuntos sensíveis da LGPD
// (art. 11): religião, política, saúde e sexualidade.
// Espelho idêntico no app (src/config/sintonia/interestsCatalog.ts). A lista de ids também está nas regras
// do Firestore (users.interests) — ao mudar, troque nos três lugares.
// ============================================

export interface InterestGroup {
  id: string;
  title: string;
  items: ReadonlyArray<{ id: string; label: string }>;
}

export const INTEREST_GROUPS: readonly InterestGroup[] = [
  {
    id: "musica", title: "🎵 Música",
    items: [
      { id: "sertanejo", label: "Sertanejo" },
      { id: "pop", label: "Pop" },
      { id: "rock", label: "Rock" },
      { id: "funk", label: "Funk" },
      { id: "pagode_samba", label: "Pagode e samba" },
      { id: "mpb", label: "MPB" },
      { id: "eletronica", label: "Eletrônica" },
      { id: "rap_trap", label: "Rap e trap" },
    ],
  },
  {
    id: "esportes", title: "⚽ Esportes e movimento",
    items: [
      { id: "academia", label: "Academia" },
      { id: "futebol", label: "Futebol" },
      { id: "corrida", label: "Corrida" },
      { id: "ciclismo", label: "Ciclismo" },
      { id: "lutas", label: "Lutas" },
      { id: "danca", label: "Dança" },
      { id: "yoga", label: "Yoga" },
    ],
  },
  {
    id: "viagens", title: "✈️ Viagens",
    items: [
      { id: "praia", label: "Praia" },
      { id: "montanha", label: "Montanha e serra" },
      { id: "mochilao", label: "Mochilão" },
      { id: "viagem_internacional", label: "Viagem internacional" },
      { id: "roadtrip", label: "Pegar a estrada" },
    ],
  },
  {
    id: "telas", title: "🎬 Filmes, séries e games",
    items: [
      { id: "filmes", label: "Filmes" },
      { id: "series", label: "Séries" },
      { id: "anime", label: "Anime" },
      { id: "documentarios", label: "Documentários" },
      { id: "games", label: "Games" },
      { id: "jogos_tabuleiro", label: "Jogos de tabuleiro" },
    ],
  },
  {
    id: "gastronomia", title: "🍳 Comida e bebida",
    items: [
      { id: "cozinhar", label: "Cozinhar" },
      { id: "cafe", label: "Café" },
      { id: "churrasco", label: "Churrasco" },
      { id: "vinho", label: "Vinho" },
      { id: "cerveja_artesanal", label: "Cerveja artesanal" },
      { id: "restaurantes", label: "Conhecer restaurantes" },
    ],
  },
  {
    id: "natureza", title: "🌿 Natureza e pets",
    items: [
      { id: "trilhas", label: "Trilhas" },
      { id: "camping", label: "Camping" },
      { id: "pesca", label: "Pesca" },
      { id: "cachorros", label: "Cachorros" },
      { id: "gatos", label: "Gatos" },
    ],
  },
  {
    id: "cultura", title: "🎨 Arte e cultura",
    items: [
      { id: "fotografia", label: "Fotografia" },
      { id: "leitura", label: "Leitura" },
      { id: "arte", label: "Desenho e pintura" },
      { id: "teatro", label: "Teatro" },
      { id: "moda", label: "Moda" },
      { id: "tecnologia", label: "Tecnologia" },
    ],
  },
  {
    id: "social", title: "🎉 Rolês",
    items: [
      { id: "barzinho", label: "Barzinho" },
      { id: "baladas", label: "Baladas" },
      { id: "shows", label: "Shows e festivais" },
      { id: "karaoke", label: "Karaokê" },
      { id: "noite_em_casa", label: "Noite em casa" },
    ],
  },
];

export const INTEREST_IDS: readonly string[] = INTEREST_GROUPS.flatMap(g => g.items.map(i => i.id));

const LABELS: Record<string, string> = Object.fromEntries(
  INTEREST_GROUPS.flatMap(g => g.items.map(i => [i.id, i.label] as const)),
);

export function interestLabel(id: string): string {
  return LABELS[id] ?? id;
}

/** Só ids do catálogo, sem repetição, no máximo 10. */
export function sanitizeInterests(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && INTEREST_IDS.includes(item) && !out.includes(item)) out.push(item);
    if (out.length >= 10) break;
  }
  return out;
}
