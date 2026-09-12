// ============================================
// LUMINA — USERS SERVICE v5.5
// src/services/usersService.ts
//
// v5.5 — REGIÃO POR CÓDIGO IBGE
// normalizeRegion() foi REMOVIDO. Ele existia duplicado aqui e
// no destaqueRegionalService; se as duas implementações
// divergissem, o comprador pagava e não aparecia para ninguém,
// sem erro no log. Agora a comparação é entre códigos IBGE
// (7 dígitos), gravados no cadastro a partir da API oficial.
//
// v5.4 — PAGINAÇÃO REAL
// A query anterior era query(collection(db,'users'), limit(50))
// SEM orderBy. O Firestore ordena por ID de documento nesse caso,
// então devolvia SEMPRE os mesmos 50 usuários, para todo mundo.
// Perfis fora desse conjunto nunca eram carregados — e nenhum
// boost pago os alcançava.
//
// ARQUITETURA — duas trilhas:
//
// A) PERFIS COM BOOST — fixados no topo, buscados só na 1ª página.
//    Usa boostActiveUntil (topo do documento), gravado pelas CFs
//    de ativação. O Firestore não faz OR eficiente entre
//    turbo.expiresAt / impulso.expiresAt / destaqueRegional.expiresAt.
//
// B) DEMAIS PERFIS — paginados por cursor real (startAfter),
//    orderBy('createdAt','desc').
//
// TRADE-OFF ACEITO:
// calcularSintonia roda no cliente; o Firestore não pode ordenar
// por ela. Logo a ordenação por Sintonia é DENTRO DE CADA PÁGINA,
// não global.
//
// PRE-REQUISITO: documentos sem createdAt NAO sao retornados por
// orderBy('createdAt'). Verificar cobertura (ver ORDER_FIELD).
// ============================================

import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '../types';
import { calcularSintonia } from '../utils/sintoniaEngine';

// ============================================
// CONFIGURAÇÃO
// ============================================

/** Perfis carregados por página. Equilibra leituras e fluidez do scroll. */
export const PROFILE_PAGE_SIZE = 20;

/** Teto de perfis com boost buscados na 1ª página. */
const BOOSTED_FETCH_LIMIT = 20;

/**
 * Campo de ordenação da trilha B.
 * Documentos SEM este campo são invisíveis para a query — se o
 * backfill de createdAt não cobrir 100% da base, trocar por
 * documentId() (sempre presente, ordem arbitrária mas completa).
 */
const ORDER_FIELD = 'createdAt';

// ============================================
// TIPOS
// ============================================

/**
 * Espelha BOOST_FIELDS em
 * functions/src/premium/utils/assertSingleBoost.ts
 * — manter os dois lados em sincronia ao adicionar um boost novo.
 */
export type BoostType = 'turbo' | 'destaque' | 'impulso';

export interface RealProfile extends UserProfile {
  sintonia: number;
  sintoniaLabel: string;
  boostScore: number;           // interno — nunca exibido para outros usuários
  boostType: BoostType | null;  // dirige o badge na Home
}

export interface ProfilePage {
  profiles: RealProfile[];
  /** Passar de volta em getCompatibleProfilesPage para a próxima página. */
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

interface ActiveBoost {
  score: number;
  type: BoostType | null;
}

const NO_BOOST: ActiveBoost = { score: 0, type: null };

// ============================================
// REGIÃO
//
// regiaoId = código IBGE do município, 7 dígitos (ex.: '4118501').
// Comparação exata de string — sem acento, sem caixa, sem grafia.
// Perfis antigos, cadastrados antes do seletor IBGE, não têm o
// campo: nesses casos a região é desconhecida e o Destaque
// simplesmente não se aplica (fail-closed).
// ============================================
function getRegiaoId(data: any): string | null {
  const id = data?.regiaoId;
  return typeof id === 'string' && /^\d{7}$/.test(id) ? id : null;
}

function isExpired(expiresAt: Date | null, now: Date): boolean {
  return !expiresAt || expiresAt <= now;
}

// ============================================
// BOOST ATIVO
//
// REGRA GLOBAL PREMIUM:
// ✗ Nunca garante aparecer — apenas aumenta chance
// ✓ Boost SOMA à sintonia, não substitui a ordenação
//
// Exclusividade é garantida no backend (assertSingleBoost).
// A ordem abaixo é só desempate defensivo para dado legado.
// ============================================
function getActiveBoostScore(
  data: any,
  viewerRegiaoId: string | null,
  now: Date,
): ActiveBoost {
  // Turbo Sintonia — global
  const turboExpiry: Date | null = data?.turbo?.expiresAt?.toDate?.() ?? null;
  if (!isExpired(turboExpiry, now)) {
    return { score: data.turbo.boostScore ?? 0, type: 'turbo' };
  }

  // Destaque Regional — SÓ vale na mesma região do espectador
  const destaqueExpiry: Date | null = data?.destaqueRegional?.expiresAt?.toDate?.() ?? null;
  if (!isExpired(destaqueExpiry, now)) {
    // O regiaoId gravado na ativação é a fonte: se o comprador
    // mudar de cidade durante as 4h, o destaque continua valendo
    // na região que ele pagou.
    const targetRegiaoId: string | null =
      getRegiaoId(data.destaqueRegional) ?? getRegiaoId(data);

    const sameRegion =
      viewerRegiaoId !== null &&
      targetRegiaoId !== null &&
      viewerRegiaoId === targetRegiaoId;

    if (sameRegion) {
      return { score: data.destaqueRegional.boostScore ?? 0, type: 'destaque' };
    }
    // Fora da região: sem boost e sem badge. Segue para Impulso.
  }

  // Impulso de Perfil — global
  const impulsoExpiry: Date | null = data?.impulso?.expiresAt?.toDate?.() ?? null;
  if (!isExpired(impulsoExpiry, now)) {
    return { score: data.impulso.boostScore ?? 0, type: 'impulso' };
  }

  return NO_BOOST;
}

// ============================================
// MONTAGEM DE PERFIL
// ============================================
function buildProfile(
  docSnap: QueryDocumentSnapshot<DocumentData>,
  currentUser: UserProfile,
  viewerRegiaoId: string | null,
  now: Date,
): RealProfile | null {
  const data = docSnap.data() as UserProfile;

  // Ignora o próprio usuário
  if (data.uid === currentUser.uid) return null;

  // Ignora perfis incompletos
  if (!data.name || !data.age || !data.gender) return null;

  // Ignora perfis bloqueados
  if ((data as any).isBlocked === true) return null;

  const sintoniaResult = calcularSintonia(currentUser, data);
  const boost = getActiveBoostScore(docSnap.data(), viewerRegiaoId, now);

  return {
    ...data,
    sintonia: sintoniaResult.score,
    sintoniaLabel: sintoniaResult.label,
    boostScore: boost.score,
    boostType: boost.type,
  };
}

function sortByScore(profiles: RealProfile[]): RealProfile[] {
  // Score final = sintonia + boost ativo. Boost eleva a posição
  // sem garantir topo absoluto: dois perfis com boost são
  // desempatados pela sintonia.
  return profiles.sort(
    (a, b) => (b.sintonia + b.boostScore) - (a.sintonia + a.boostScore),
  );
}

// ============================================
// TRILHA A — perfis com boost ativo
// Buscada apenas na primeira página.
// ============================================
async function fetchBoostedProfiles(
  currentUser: UserProfile,
  viewerRegiaoId: string | null,
  now: Date,
): Promise<RealProfile[]> {
  try {
    const q = query(
      collection(db, 'users'),
      where('boostActiveUntil', '>', Timestamp.fromDate(now)),
      orderBy('boostActiveUntil', 'desc'),
      limit(BOOSTED_FETCH_LIMIT),
    );

    const snapshot = await getDocs(q);
    const profiles: RealProfile[] = [];

    snapshot.docs.forEach(docSnap => {
      const profile = buildProfile(docSnap, currentUser, viewerRegiaoId, now);

      // boostType null aqui = Destaque Regional de outra região.
      // O perfil não é fixado no topo; aparecerá na trilha B.
      if (profile && profile.boostType !== null) profiles.push(profile);
    });

    return sortByScore(profiles);
  } catch (error) {
    // Falha na trilha A NÃO pode derrubar a Home. Sem boost,
    // o usuário ainda vê a listagem normal.
    console.error('[usersService] fetchBoostedProfiles:', error);
    return [];
  }
}

// ============================================
// PÁGINA DE PERFIS — API principal
// ============================================
export async function getCompatibleProfilesPage(
  currentUser: UserProfile,
  pageSize: number = PROFILE_PAGE_SIZE,
  cursor: QueryDocumentSnapshot<DocumentData> | null = null,
): Promise<ProfilePage> {
  try {
    const viewerRegiaoId = getRegiaoId(currentUser);
    // `now` estável para toda a página: senão um boost pode
    // expirar no meio da ordenação e produzir ordem inconsistente.
    const now = new Date();

    const isFirstPage = cursor === null;

    // Trilha A — só na primeira página
    const boosted = isFirstPage
      ? await fetchBoostedProfiles(currentUser, viewerRegiaoId, now)
      : [];
    const boostedIds = new Set(boosted.map(p => p.uid));

    // Trilha B — paginada por cursor
    const constraints = [
      orderBy(ORDER_FIELD, 'desc'),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(pageSize),
    ];

    const snapshot = await getDocs(query(collection(db, 'users'), ...constraints));

    const regular: RealProfile[] = [];
    snapshot.docs.forEach(docSnap => {
      const profile = buildProfile(docSnap, currentUser, viewerRegiaoId, now);
      if (!profile) return;
      // Deduplica: já veio fixado no topo pela trilha A
      if (boostedIds.has(profile.uid)) return;
      regular.push(profile);
    });

    // hasMore usa o tamanho BRUTO da página, não o filtrado:
    // uma página inteira de perfis incompletos ainda tem
    // continuação e não pode encerrar o scroll.
    const hasMore = snapshot.docs.length === pageSize;
    const nextCursor = snapshot.docs.length > 0
      ? snapshot.docs[snapshot.docs.length - 1]
      : null;

    return {
      profiles: [...boosted, ...sortByScore(regular)],
      cursor: nextCursor,
      hasMore,
    };
  } catch (error) {
    console.error('[usersService] getCompatibleProfilesPage:', error);
    return { profiles: [], cursor: null, hasMore: false };
  }
}

// ============================================
// COMPATIBILIDADE — assinatura antiga
// Mantida para não quebrar chamadores existentes.
// Equivale à primeira página.
// ============================================
export async function getCompatibleProfiles(
  currentUser: UserProfile,
  limitCount: number = PROFILE_PAGE_SIZE,
): Promise<RealProfile[]> {
  const page = await getCompatibleProfilesPage(currentUser, limitCount, null);
  return page.profiles;
}

// ============================================
// PERFIL INDIVIDUAL
// ============================================
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const ref = doc(db, 'users', userId);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data() as UserProfile;
    return null;
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    return null;
  }
}