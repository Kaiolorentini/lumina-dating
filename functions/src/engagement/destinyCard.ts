// ============================================
// LUMINA — CARTA DO DESTINO v6.2
// functions/src/engagement/destinyCard.ts
//
// v6.2 — ATOMICIDADE E POOL ALEATÓRIO.
//
// Cinco defeitos corrigidos, todos encontrados em auditoria e
// nenhum visível em uso normal:
//
// R2 CRÍTICO — `limit(50)` sem `orderBy` devolve sempre os
//   MESMOS documentos, na ordem de __name__. Todo usuário do
//   app recebia cartas tiradas do mesmo punhado de perfis, e
//   depois de 8 pessoas vistas (`seenUids` acumula) a Carta
//   nunca mais entregava ninguém. O cabeçalho da v6.0 dizia
//   que isso estava corrigido; não estava. Agora o recorte é
//   uma faixa aleatória de `randomSeed`, com wrap-around.
//
// R3 ALTO — `drawsUsed` era lido fora de transaction e
//   gravado como valor absoluto (`drawsUsed + 1`). Dois toques
//   rápidos: as duas chamadas liam 1, as duas cobravam, as
//   duas gravavam 2. O usuário pagava dois preços por uma
//   troca, e `MAX_DRAWS` podia ser furado. A reserva agora é
//   parte da mesma transaction que cobra.
//
// R4 ALTO — se a gravação da carta falhasse DEPOIS da
//   cobrança, o dinheiro saía e não havia carta nem estorno.
//   Só o caminho "nenhum perfil" estornava. Agora há `catch`.
//
// R5 ALTO — o estorno eram dois `await` soltos: se o ledger
//   falhasse, o saldo voltava sem registro. É exatamente a
//   movimentação silenciosa que a v6.1 existiu para acabar.
//   Agora é uma transaction única.
//
// R6 ALTO — `pickProfiles` filtrava só `isBlocked`. Perfis com
//   verificação de idade pendente ou rejeitada entravam na
//   carta — uma porta lateral no gate de acesso.
//
// ── ÍNDICE NECESSÁRIO ──
//
// A query do pool combina `gender in [...]` com faixa e
// ordenação em `randomSeed`. Exige índice composto:
//   users: gender ASC, randomSeed ASC
// Sem ele, a chamada falha com FAILED_PRECONDITION e um link
// no log. Ver firestore.indexes.json abaixo.
//
// ── COMO FUNCIONA ──
//
// DUAS pessoas, a pessoa ESCOLHE UMA, e a escolha cria a
// conexão e libera a conversa. É o que separa a Carta da aba
// Sintonize, que é aleatória e sem privilégio.
//
// Uma escolha por dia. Quem não gostou de nenhuma paga para
// ver outras duas, até 3 vezes: 50, 70 e 90 cristais PREMIUM.
// Só premium — a Carta entrega uma conexão garantida, o bem
// mais valioso do app. Os gratuitos ficam para as revelações,
// os fragmentos para o Cofre e os badges.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { todayBr }    from '../utils/dateBr';
import { isGalaxiaPlusActive } from '../payments/activateGalaxiaPlus';
import { GALAXIA_PLUS } from '../config/economy';

const db = admin.firestore();

/** Quantos perfis por carta. Duas: é uma ESCOLHA, não uma
 *  vitrine. Com três, a decisão fica diluída. */
const PROFILES_PER_CARD = 2;

/** Grátis + 3 pagas = 4 tentativas por dia. */
const FREE_DRAWS = 1;
const MAX_DRAWS  = 4;

/**
 * Preço por troca, na ordem: 2ª, 3ª e 4ª carta do dia.
 *
 * Sobe a cada uma porque a primeira troca é um arrependimento
 * legítimo e a quarta é insistência — quem quer esgotar o dia
 * paga progressivamente mais.
 */
const DRAW_PRICES = [50, 70, 90] as const;

/** Preço da PRÓXIMA troca, dado quantas já foram usadas. */
function priceFor(drawsUsed: number): number {
  const index = Math.max(0, drawsUsed - FREE_DRAWS);
  return DRAW_PRICES[Math.min(index, DRAW_PRICES.length - 1)];
}

/** Quantos candidatos ler antes de calcular. */
const CANDIDATE_POOL = 50;

/**
 * Valor de `ageVerificationStatus` que libera o perfil para
 * aparecer na Carta.
 *
 * O filtro só exclui quem TEM o campo com outro valor: contas
 * criadas antes do gate não têm o campo e continuam visíveis,
 * porque escondê-las esvaziaria a base de uma vez.
 *
 * ⚠ CONFIRMAR contra o enum real do projeto. Se o valor
 * gravado for 'aprovado' em vez de 'approved', este filtro
 * remove TODO MUNDO que passou pelo gate — falha silenciosa,
 * a carta volta vazia.
 */
const VERIFICATION_APPROVED = 'approved';

/**
 * Preferência → gêneros que ela cobre.
 *
 * Os dois campos usam VOCABULÁRIOS DIFERENTES: a preferência
 * é 'homens'|'mulheres'|'trans'|'todos' e o gênero é
 * 'masculino'|'feminino'|'trans'|'nao-binario'. Comparar um
 * com o outro direto fazia `where('gender','in',['mulheres'])`
 * nunca casar com 'feminino', e a carta voltava SEMPRE VAZIA.
 */
const PREFERENCE_TO_GENDERS: Record<string, string[]> = {
  homens:   ['masculino'],
  mulheres: ['feminino'],
  trans:    ['trans'],
  todos:    ['masculino', 'feminino', 'trans', 'nao-binario'],
};

function gendersFromPreferences(preferences: string[]): string[] {
  const set = new Set<string>();
  for (const pref of preferences) {
    for (const g of PREFERENCE_TO_GENDERS[pref] ?? []) set.add(g);
  }
  return [...set];
}

interface DestinyProfile {
  uid:      string;
  name:     string;
  age:      number;
  photoURL: string;
  city:     string;
  sintonia: number;
}

/** Quanto foi cobrado, para o estorno devolver igual. */
interface Charge {
  crystals: number;
}

/** O que a transaction de reserva devolve. */
interface Reservation {
  /** Valor JÁ incrementado e gravado. */
  drawsUsed: number;
  charge:    Charge;
  isPaid:    boolean;
  seenUids:  string[];
}

/** Candidato lido do pool, antes de virar DestinyProfile. */
interface Candidate {
  uid:  string;
  data: Record<string, unknown>;
}

/**
 * Compatibilidade no servidor, para ESCOLHER quem mostrar.
 *
 * DÍVIDA: o cálculo do cliente considera interesses e bio, e
 * este não. Por isso a tela recalcula no cliente antes de
 * exibir — o número que a pessoa vê é o mesmo do perfil
 * aberto. Portar o calcularSintonia inteiro duplicaria ~100
 * linhas, e o projeto já sofreu com catálogos divergindo.
 */
function calcCompatibilidade(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): number {
  let score = 45;

  const prefA = (a.preferences as string[] | undefined) ?? [];
  const prefB = (b.preferences as string[] | undefined) ?? [];

  if (gendersFromPreferences(prefA).includes(b.gender as string)) score += 20;
  if (gendersFromPreferences(prefB).includes(a.gender as string)) score += 15;

  const ageA = (a.age as number | undefined) ?? 25;
  const ageB = (b.age as number | undefined) ?? 25;
  const ageDiff = Math.abs(ageA - ageB);
  if (ageDiff <= 3)       score += 12;
  else if (ageDiff <= 7)  score += 7;
  else if (ageDiff <= 12) score += 3;

  if (a.regiaoId && b.regiaoId && a.regiaoId === b.regiaoId) score += 10;
  else if (a.state && b.state && a.state === b.state) score += 4;

  return Math.min(Math.max(score, 30), 99);
}

// ── Estado da carta do dia ──
export const getDestinyCard = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const todayStr = todayBr();

    const [snap, isPlus] = await Promise.all([
      db.collection('destinyCards').doc(uid).get(),
      isGalaxiaPlusActive(uid),
    ]);

    const data = snap.data() ?? {};

    // Dia novo: o documento anterior não vale mais. Checar a
    // data em vez de confiar no contador é o que conserta o
    // bug do increment acumulando de ontem.
    const isToday   = data.date === todayStr;
    const drawsUsed = isToday ? (data.drawsUsed as number) ?? 0 : 0;

    // Galáxia Plus: as 4 cartas do dia são TODAS grátis. Sem
    // assinatura, é 1 grátis e 3 pagas.
    const freeDraws = isPlus ? GALAXIA_PLUS.DESTINY_CARDS_PER_DAY : FREE_DRAWS;

    return {
      profiles:  isToday ? (data.profiles as DestinyProfile[]) ?? [] : [],
      drawsUsed,
      maxDraws:  MAX_DRAWS,
      freeDraws,
      /** Preço da PRÓXIMA troca — a tela mostra sem calcular. */
      nextPrice: priceFor(drawsUsed),
      chosenUid: isToday ? (data.chosenUid as string) ?? null : null,
      isGalaxiaPlus: isPlus,
      date:      todayStr,
    };
  },
);

// ── Sortear (ou re-sortear) a carta ──
export const drawDestinyCard = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const todayStr = todayBr();
    const cardRef  = db.collection('destinyCards').doc(uid);

    const [userSnap, isPlus] = await Promise.all([
      db.collection('users').doc(uid).get(),
      isGalaxiaPlusActive(uid),
    ]);

    const userData = userSnap.data() ?? {};

    // Com Galáxia Plus as 4 do dia são grátis.
    const freeDraws = isPlus ? GALAXIA_PLUS.DESTINY_CARDS_PER_DAY : FREE_DRAWS;

    // R3: validação, cobrança e reserva da troca no MESMO
    // ponto atômico. Nada entre ler o contador e gravá-lo.
    const reservation = await reserveDraw(uid, todayStr, freeDraws);

    let profiles: DestinyProfile[];
    try {
      profiles = await pickProfiles(
        uid,
        userData,
        new Set(reservation.seenUids),
      );
    } catch (error) {
      // R4: a busca explodiu depois de cobrar.
      await releaseDraw(uid, reservation, 'Falha ao buscar perfis');
      throw error;
    }

    if (profiles.length === 0) {
      await releaseDraw(uid, reservation, 'Nenhum perfil compatível disponível');
      throw new functions.HttpsError(
        'not-found',
        'Não há novas pessoas para mostrar agora. Isso acontece quando você já viu ou já se conectou com quem estava disponível — volte amanhã.',
      );
    }

    try {
      await cardRef.set({
        uid,
        profiles,
        seenUids:  [...reservation.seenUids, ...profiles.map(p => p.uid)],
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      // R4: dinheiro saiu, carta não gravou.
      await releaseDraw(uid, reservation, 'Falha ao gravar a carta');
      throw new functions.HttpsError(
        'internal',
        'Não foi possível abrir a carta. Seus cristais foram devolvidos.',
      );
    }

    // Conta o uso para a tela da Galáxia Plus mostrar o que a
    // assinatura já rendeu. Fire-and-forget: é estatística.
    if (isPlus) {
      db.collection('galaxiaPlus').doc(uid).set({
        cardsDrawnTotal: FieldValue.increment(1),
      }, { merge: true }).catch(() => {});
    }

    return {
      profiles,
      drawsUsed: reservation.drawsUsed,
      maxDraws:  MAX_DRAWS,
      nextPrice: priceFor(reservation.drawsUsed),
      wasPaid:   reservation.isPaid,
      isGalaxiaPlus: isPlus,
    };
  },
);

// ── Escolher uma das duas ──
export const chooseDestinyProfile = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const { targetUid } = (request.data ?? {}) as { targetUid?: string };
    if (!targetUid || typeof targetUid !== 'string') {
      throw new functions.HttpsError('invalid-argument', 'targetUid obrigatório.');
    }

    const todayStr = todayBr();
    const cardRef  = db.collection('destinyCards').doc(uid);

    // A escolha é gravada em transaction pelo mesmo motivo da
    // reserva: dois toques criariam duas conexões e o dia
    // ficaria com duas escolhas.
    await db.runTransaction(async (t) => {
      const snap = await t.get(cardRef);
      const data = snap.data() ?? {};

      if (data.date !== todayStr) {
        throw new functions.HttpsError('failed-precondition', 'Nenhuma carta aberta hoje.');
      }
      if (data.chosenUid) {
        throw new functions.HttpsError('failed-precondition', 'Você já escolheu hoje.');
      }

      // A escolha tem que ser um dos perfis DESTA carta: sem
      // isto, um app modificado pediria conexão com qualquer
      // pessoa da base.
      const profiles = (data.profiles as DestinyProfile[]) ?? [];
      if (!profiles.some(p => p.uid === targetUid)) {
        throw new functions.HttpsError(
          'permission-denied',
          'Este perfil não está na sua carta de hoje.',
        );
      }

      t.set(cardRef, {
        chosenUid: targetUid,
        chosenAt:  FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    await createConnection(uid, targetUid);

    return { success: true, targetUid };
  },
);

// ============================================
// COBRANÇA E RESERVA
// ============================================

/**
 * Valida, cobra e RESERVA a troca, tudo numa transaction.
 *
 * R3: antes, o contador era lido fora e gravado como valor
 * absoluto. Duas chamadas simultâneas liam o mesmo número,
 * cobravam as duas e gravavam o mesmo resultado — o usuário
 * pagava dois preços por uma troca, e MAX_DRAWS era furável.
 * Agora o contador é lido e gravado no mesmo ponto atômico: a
 * segunda chamada já lê o valor incrementado e é barrada.
 *
 * Cobra em cristais PREMIUM e não gratuitos: a Carta entrega
 * uma conexão garantida. Os gratuitos ficam para as
 * revelações.
 */
async function reserveDraw(
  uid:       string,
  todayStr:  string,
  freeDraws: number,
): Promise<Reservation> {
  const cardRef   = db.collection('destinyCards').doc(uid);
  const walletRef = db.collection('wallets').doc(uid);

  return db.runTransaction(async (t) => {
    // Os dois gets antes de qualquer write: exigência do
    // Firestore, e a ordem importa para o retry.
    const [cardSnap, walletSnap] = await Promise.all([
      t.get(cardRef),
      t.get(walletRef),
    ]);

    const cardData = cardSnap.data() ?? {};
    const isToday  = cardData.date === todayStr;

    const drawsUsed = isToday ? (cardData.drawsUsed as number) ?? 0 : 0;
    const chosenUid = isToday ? (cardData.chosenUid as string) ?? null : null;
    const seenUids  = isToday ? (cardData.seenUids as string[]) ?? [] : [];

    if (chosenUid) {
      throw new functions.HttpsError(
        'failed-precondition',
        'Você já fez sua escolha hoje. Amanhã a carta traz novas pessoas.',
      );
    }

    if (drawsUsed >= MAX_DRAWS) {
      throw new functions.HttpsError(
        'resource-exhausted',
        'Você já viu todas as cartas de hoje.',
      );
    }

    const isPaid = drawsUsed >= freeDraws;
    let charge: Charge = { crystals: 0 };

    if (isPaid) {
      const price   = priceFor(drawsUsed);
      const wallet  = walletSnap.data() ?? {};
      const premium = (wallet.coinsPremium as number) ?? 0;

      if (premium < price) {
        throw new functions.HttpsError(
          'failed-precondition',
          `Você precisa de ${price} cristais premium e tem ${premium}.`,
        );
      }

      t.set(walletRef, {
        coinsPremium: FieldValue.increment(-price),
        totalSpent:   FieldValue.increment(price),
        updatedAt:    FieldValue.serverTimestamp(),
      }, { merge: true });

      t.set(db.collection('economyLedger').doc(), {
        uid,
        tipo:        'CARTA_DESTINO',
        origem:      'drawDestinyCard',
        cristais:    -price,
        premium:     -price,
        saldoAntes:  premium,
        saldoDepois: premium - price,
        timestamp:   FieldValue.serverTimestamp(),
        imutavel:    true,
      });

      charge = { crystals: price };
    }

    // A reserva. `date` e `seenUids` são reescritos aqui para
    // o caso de virada de dia — assim o documento de ontem
    // não contamina o de hoje.
    t.set(cardRef, {
      uid,
      date:      todayStr,
      drawsUsed: drawsUsed + 1,
      seenUids,
      chosenUid: null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { drawsUsed: drawsUsed + 1, charge, isPaid, seenUids };
  });
}

/**
 * Desfaz a reserva: devolve o premium E o contador.
 *
 * R5: o estorno antigo eram dois `await` soltos — se o ledger
 * falhasse, o saldo voltava sem registro. Agora é uma
 * transaction: saldo, contador e ledger juntos ou nenhum.
 *
 * O contador só volta se a reserva ainda for a NOSSA. Se outra
 * chamada já avançou o dia, mexer no número tiraria uma troca
 * legítima de alguém.
 */
async function releaseDraw(
  uid:         string,
  reservation:  Reservation,
  motivo:      string,
): Promise<void> {
  const cardRef   = db.collection('destinyCards').doc(uid);
  const walletRef = db.collection('wallets').doc(uid);

  try {
    await db.runTransaction(async (t) => {
      const cardSnap = await t.get(cardRef);
      const current  = (cardSnap.data()?.drawsUsed as number) ?? 0;

      if (current === reservation.drawsUsed) {
        t.set(cardRef, {
          drawsUsed: reservation.drawsUsed - 1,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      if (reservation.charge.crystals > 0) {
        t.set(walletRef, {
          coinsPremium: FieldValue.increment(reservation.charge.crystals),
          totalSpent:   FieldValue.increment(-reservation.charge.crystals),
          updatedAt:    FieldValue.serverTimestamp(),
        }, { merge: true });

        t.set(db.collection('economyLedger').doc(), {
          uid,
          tipo:      'CARTA_DESTINO_ESTORNO',
          origem:    'drawDestinyCard',
          cristais:  reservation.charge.crystals,
          premium:   reservation.charge.crystals,
          motivo,
          timestamp: FieldValue.serverTimestamp(),
          imutavel:  true,
        });
      }
    });
  } catch (error) {
    // Falha no estorno não pode esconder o erro original.
    console.error('[destinyCard] Estorno falhou para', uid, motivo, error);
  }
}

// ============================================
// SELEÇÃO
// ============================================

/**
 * Lê o pool de candidatos numa FAIXA ALEATÓRIA de randomSeed.
 *
 * R2: `limit(50)` sem `orderBy` devolve sempre os mesmos
 * documentos, em ordem de __name__. O app inteiro tirava
 * cartas do mesmo punhado de perfis, e o usuário secava o
 * próprio pool em 8 pessoas.
 *
 * Wrap-around: a faixa a partir de um seed alto pode não
 * encher o pool, então completa desde o começo. Sem isso,
 * quem sorteasse 0.98 leria quase nada.
 *
 * Fallback sem ordenação: contas criadas antes do randomSeed
 * não têm o campo e são invisíveis para a query ordenada. Se
 * a faixa vier vazia nas duas passadas, vale ler sem ordem —
 * pior que aleatório é não ter carta.
 */
async function fetchCandidatePool(genders: string[]): Promise<Candidate[]> {
  const filtered = genders.length > 0 && genders.length < 4;

  function base(): admin.firestore.Query {
    const col = db.collection('users');
    return filtered ? col.where('gender', 'in', genders) : col;
  }

  const seed = Math.random();
  const out  = new Map<string, Candidate>();

  function absorb(snap: admin.firestore.QuerySnapshot): void {
    for (const doc of snap.docs) {
      out.set(doc.id, { uid: doc.id, data: doc.data() });
    }
  }

  absorb(await base()
    .where('randomSeed', '>=', seed)
    .orderBy('randomSeed')
    .limit(CANDIDATE_POOL)
    .get());

  if (out.size < CANDIDATE_POOL) {
    absorb(await base()
      .where('randomSeed', '<', seed)
      .orderBy('randomSeed')
      .limit(CANDIDATE_POOL - out.size)
      .get());
  }

  if (out.size === 0) {
    console.warn('[destinyCard] Pool por randomSeed vazio — fallback sem ordem.');
    absorb(await base().limit(CANDIDATE_POOL).get());
  }

  return [...out.values()];
}

async function pickProfiles(
  uid: string,
  userData: Record<string, unknown>,
  seen: Set<string>,
): Promise<DestinyProfile[]> {
  const preferences = (userData.preferences as string[] | undefined) ?? [];
  const genders     = gendersFromPreferences(preferences);

  // Sem preferência, ou com 'todos', não filtra — melhor
  // mostrar alguém que ninguém.
  const [pool, connected] = await Promise.all([
    fetchCandidatePool(genders),
    // Quem já tem conexão não entra: pagar para "desbloquear"
    // alguém com quem já dá para conversar seria roubo.
    connectedUids(uid),
  ]);

  const candidates: DestinyProfile[] = [];

  for (const { uid: candidateUid, data: p } of pool) {
    if (candidateUid === uid)        continue;
    if (seen.has(candidateUid))      continue;
    if (connected.has(candidateUid)) continue;
    if (p.isBlocked === true)        continue;
    if (!p.name || !p.age || !p.photoURL) continue;

    // R6: o gate de acesso vale aqui também. Quem não passou
    // pela verificação de idade não aparece na Carta.
    const verification = p.ageVerificationStatus as string | undefined;
    if (verification !== undefined && verification !== VERIFICATION_APPROVED) continue;

    candidates.push({
      uid:      candidateUid,
      name:     p.name as string,
      age:      p.age as number,
      photoURL: p.photoURL as string,
      city:     (p.city as string) ?? '',
      sintonia: calcCompatibilidade(userData, p),
    });
  }

  candidates.sort((a, b) => b.sintonia - a.sintonia);
  return candidates.slice(0, PROFILES_PER_CARD);
}

/** Uids com quem já existe conexão aceita, nos dois sentidos. */
async function connectedUids(uid: string): Promise<Set<string>> {
  const [from, to] = await Promise.all([
    db.collection('connectionRequests')
      .where('fromUserId', '==', uid)
      .where('status', '==', 'accepted')
      .get(),
    db.collection('connectionRequests')
      .where('toUserId', '==', uid)
      .where('status', '==', 'accepted')
      .get(),
  ]);

  const set = new Set<string>();
  from.docs.forEach(d => set.add(d.data().toUserId as string));
  to.docs.forEach(d => set.add(d.data().fromUserId as string));
  return set;
}

/**
 * Cria a conexão aceita. Id determinístico pela mesma razão do
 * MatchService: id gerado pelo Firestore criaria duplicatas e
 * a pessoa apareceria duas vezes na lista.
 */
async function createConnection(uid: string, targetUid: string): Promise<void> {
  const id  = `carta_${[uid, targetUid].sort().join('_')}`;
  const ref = db.collection('connectionRequests').doc(id);

  const fromSnap = await db.collection('users').doc(uid).get();
  const fromData = fromSnap.data() ?? {};

  await ref.set({
    fromUserId:    uid,
    toUserId:      targetUid,
    fromUserName:  (fromData.name as string) ?? '',
    fromUserPhoto: (fromData.photoURL as string) ?? '',
    status:        'accepted',
    origem:        'carta_destino',
    timestamp:     FieldValue.serverTimestamp(),
  }, { merge: true });
}