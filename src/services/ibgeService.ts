// ============================================
// LUMINA — IBGE LOCALIDADES v1.0
// src/services/ibgeService.ts
//
// Fonte oficial de estados e municípios brasileiros.
// API pública, sem chave, sem custo.
//
// POR QUE ISSO EXISTE:
// city/state eram texto livre. "São Paulo", "sao paulo" e "SP"
// viravam regiões diferentes — e o Destaque Regional, que compara
// região, entregava errado sem nenhum erro no log.
//
// regiaoId = CÓDIGO IBGE DO MUNICÍPIO (7 dígitos, ex.: 4118501).
// Vantagens sobre um slug de texto:
//   - Imune a acento, caixa e grafia
//   - Estável (não muda quando a cidade é renomeada)
//   - Os 2 primeiros dígitos são o código do ESTADO, o que permite
//     ao backend validar coerência sem consultar tabela alguma
//   - where('regiaoId','==',X) usa índice de campo único —
//     dispensa o índice composto city+state
//
// RISCO ACEITO: se a API do IBGE estiver fora do ar, o usuário
// não consegue selecionar cidade. Mitigado com cache em memória,
// timeout curto e error state com retry na tela.
// Evolução natural: persistir o cache em AsyncStorage.
// ============================================

const IBGE_BASE = 'https://servicodados.ibge.gov.br/api/v1/localidades';
const TIMEOUT_MS = 8000;

export interface Estado {
  /** Código IBGE do estado (ex.: 41) */
  id: number;
  /** Sigla (ex.: 'PR') */
  sigla: string;
  /** Nome por extenso (ex.: 'Paraná') */
  nome: string;
}

export interface Municipio {
  /** Código IBGE do município, 7 dígitos (ex.: 4118501) */
  id: number;
  /** Nome oficial (ex.: 'Palotina') */
  nome: string;
}

// Cache em memória — vive enquanto o app estiver aberto.
// Estados mudam praticamente nunca; municípios, a cada anos.
let estadosCache: Estado[] | null = null;
const municipiosCache = new Map<string, Municipio[]>();

// ============================================
// FETCH COM TIMEOUT
//
// Sem timeout, uma rede lenta trava o cadastro indefinidamente
// e o usuário não sabe se deve esperar ou desistir.
// ============================================
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`IBGE respondeu ${response.status}`);
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================
// ESTADOS
// ============================================
export async function fetchEstados(): Promise<Estado[]> {
  if (estadosCache) return estadosCache;

  const response = await fetchWithTimeout(`${IBGE_BASE}/estados?orderBy=nome`);
  const data = (await response.json()) as Estado[];

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Lista de estados vazia.');
  }

  estadosCache = data.map(e => ({ id: e.id, sigla: e.sigla, nome: e.nome }));
  return estadosCache;
}

// ============================================
// MUNICÍPIOS DE UM ESTADO
// ============================================
export async function fetchMunicipios(uf: string): Promise<Municipio[]> {
  const key = uf.toUpperCase();

  const cached = municipiosCache.get(key);
  if (cached) return cached;

  const response = await fetchWithTimeout(`${IBGE_BASE}/estados/${key}/municipios`);
  const data = (await response.json()) as Municipio[];

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Nenhum município encontrado para ${key}.`);
  }

  const municipios = data
    .map(m => ({ id: m.id, nome: m.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  municipiosCache.set(key, municipios);
  return municipios;
}

// ============================================
// BUSCA LOCAL
// Filtra o que já está em memória — sem chamada de rede
// a cada tecla digitada.
// ============================================
export function filtrarMunicipios(lista: Municipio[], termo: string): Municipio[] {
  const t = termo.trim().toLowerCase();
  if (!t) return lista;

  const normalizar = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const alvo = normalizar(t);
  return lista.filter(m => normalizar(m.nome).includes(alvo));
}

// ============================================
// VALIDAÇÃO DE COERÊNCIA
//
// Os 2 primeiros dígitos do código do município são o código
// do estado. Permite checar, sem tabela, que regiaoId e estado
// combinam — bloqueando alguém gravar cidade de uma UF com o
// regiaoId de outra para se destacar numa capital.
//
// ⚠️ O backend deve refazer esta validação. Checagem no cliente
// é conveniência, nunca garantia.
// ============================================
export function isRegiaoIdValida(regiaoId: string, estadoId: number): boolean {
  if (!/^\d{7}$/.test(regiaoId)) return false;
  return regiaoId.slice(0, 2) === String(estadoId).padStart(2, '0');
}

/** Limpa o cache — útil em pull-to-refresh após falha de rede. */
export function limparCacheIbge(): void {
  estadosCache = null;
  municipiosCache.clear();
}