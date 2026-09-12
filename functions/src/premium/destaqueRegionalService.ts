// ============================================
// LUMINA — DESTAQUE REGIONAL v1.1
// functions/src/premium/destaqueRegionalService.ts
//
// v1.1 — REGIÃO POR CÓDIGO IBGE
// Antes: normalizeRegion(city, state) gerava um slug de texto,
// duplicado aqui e no usersService. Se as duas implementações
// divergissem, o comprador pagava e não aparecia para ninguém,
// sem erro nenhum no log.
// Agora: regiaoId = código IBGE do município (7 dígitos), gravado
// no cadastro a partir da API oficial. Uma fonte, sem string
// matching, sem duplicação.
//
// GANHOS:
// - where('regiaoId','==',X) usa índice de CAMPO ÚNICO
//   (o índice composto city+state deixa de ser necessário)
// - Imune a acento, caixa e grafia
// - Os 2 primeiros dígitos são o código do estado → validação
//   de coerência sem consultar tabela
//
// REGRA GLOBAL PREMIUM:
// ✗ Nunca gera Cristais/Fragmentos/Prestígio
// ✗ Não afeta Ranking, Cofre, Conquistas
// ✓ +boostScore na Home por 4h, SÓ para quem é da mesma região
// ✓ Transaction única: Wallet → Ativa → Ledger → UsageLog → Audit
// ✓ Exclusivo com Turbo e Impulso (assertSingleBoost)
//
// CDC Art. 36: o slot é PAGO e identificado por badge visível
// na Home. Não remover a identificação.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { COSTS }      from '../config/economy';
import { auditLogFinanceiro } from '../utils/auditLogFinanceiro';
import { assertSingleBoost }  from './utils/assertSingleBoost';
import {
  PREMIUM_FLAGS,
  PREMIUM_DURATIONS,
  PREMIUM_VERSIONS,
  DESTAQUE_MIN_USERS_IN_REGION,
} from './config/premiumFlags';

const db = admin.firestore();

// boostScore do Destaque — entre Impulso (120) e Turbo (180).
// Dentro da região é forte; fora dela vale zero.
const DESTAQUE_BOOST_SCORE = 150;

// ============================================
// VALIDAÇÃO DE REGIÃO
//
// Código IBGE de município tem 7 dígitos e começa com os 2
// dígitos do estado. Ex.: 4118501 (Palotina) → 41 (PR).
//
// ⚠️ Isto valida INTEGRIDADE, não impede fraude: regiaoId e
// estadoId vêm ambos do cliente. Elimina lixo e incoerência,
// não um usuário determinado a se destacar em outra praça.
// O custo em cristais e o limite de uma região por vez são o
// que torna o spoof pouco atrativo. Se virar problema real,
// a resposta é cooldown para troca de região — não mais
// validação de formato.
// ============================================
function isRegiaoIdCoerente(regiaoId: unknown, estadoId: unknown): boolean {
  if (typeof regiaoId !== 'string' || !/^\d{7}$/.test(regiaoId)) return false;
  if (typeof estadoId !== 'number' || !Number.isInteger(estadoId)) return false;
  return regiaoId.slice(0, 2) === String(estadoId).padStart(2, '0');
}

// ============================================
// CONTAGEM DE USUÁRIOS NA REGIÃO
//
// Fora da transaction de propósito: aggregation queries não são
// permitidas dentro de runTransaction, e isto é pré-condição de
// produto, não invariante financeiro.
//
// count() é cobrado como leitura de índice — muito mais barato
// que baixar os documentos.
//
// ÍNDICE: campo único em users.regiaoId (criado automaticamente
// pelo Firestore). Não precisa de índice composto.
// ============================================
async function countUsersInRegion(regiaoId: string): Promise<number> {
  const snapshot = await db
    .collection('users')
    .where('regiaoId', '==', regiaoId)
    .count()
    .get();

  return snapshot.data().count;
}
// ============================================
// CONTAGEM COM CACHE — para exibição ao usuário
//
// getDestaqueRegionalStatus roda a cada abertura da loja. Contar
// a região toda vez seria uma query de agregação por usuário por
// abertura — barato sozinho, caro em volume.
//
// Cache de 6h no próprio documento do usuário: 1 count a cada 6h
// por pessoa. Regiões não mudam de tamanho em minutos.
//
// ⚠️ NUNCA usar este cache no guard de ativação. Lá a contagem
// precisa ser fresca — é ela que decide se a venda acontece.
// ============================================
const REGION_COUNT_CACHE_HOURS = 6;

async function getCachedRegionCount(
  uid: string,
  regiaoId: string,
  cached: any,
): Promise<number> {
  const cachedAt: Date | null = cached?.updatedAt?.toDate?.() ?? null;

  const isFresh =
    cached?.regiaoId === regiaoId &&
    typeof cached?.count === 'number' &&
    cachedAt !== null &&
    Date.now() - cachedAt.getTime() < REGION_COUNT_CACHE_HOURS * 3600000;

  if (isFresh) return cached.count;

  const count = await countUsersInRegion(regiaoId);

  await db.collection('users').doc(uid).set({
    regionCount: { regiaoId, count, updatedAt: FieldValue.serverTimestamp() },
  }, { merge: true });

  return count;
}
// ── Ativar Destaque Regional ──
export const activateDestaqueRegional = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    if (!PREMIUM_FLAGS.PREMIUM_DESTAQUE_ENABLED) {
      throw new functions.HttpsError(
        'unavailable',
        'Destaque Regional temporariamente indisponível.',
      );
    }

    const cost      = COSTS.DESTAQUE_REGIONAL;
    const walletRef = db.collection('wallets').doc(uid);
    const userRef   = db.collection('users').doc(uid);
    const logRef    = db.collection('premiumUsageLog');
    const ledgerRef = db.collection('economyLedger');

    // ── Pré-condições de região (fora da transaction) ──
    const preUserDoc = await userRef.get();
    const preUser    = preUserDoc.data() ?? {};

    const regiaoId = preUser.regiaoId;
    const estadoId = preUser.estadoId;
    const city     = (preUser.city  ?? '').trim();
    const state    = (preUser.state ?? '').trim();

    // Perfis criados antes do seletor IBGE não têm regiaoId.
    // Mensagem orienta a ação exata em vez de "erro genérico".
    if (!regiaoId || !estadoId) {
      throw new functions.HttpsError(
        'failed-precondition',
        'Atualize seu perfil e selecione estado e cidade nas listas para ativar o Destaque Regional.',
      );
    }

    if (!isRegiaoIdCoerente(regiaoId, estadoId)) {
      throw new functions.HttpsError(
        'failed-precondition',
        'Sua cidade e estado não combinam. Selecione novamente no perfil.',
      );
    }

    const usersInRegion = await countUsersInRegion(regiaoId);
    if (usersInRegion < DESTAQUE_MIN_USERS_IN_REGION) {
      throw new functions.HttpsError(
        'failed-precondition',
        'Sua região ainda não tem gente suficiente para o Destaque valer a pena. ' +
          'Avisamos você assim que abrir.',
      );
    }

    // ── Transaction financeira ──
    const result = await db.runTransaction(async (t) => {
      const [walletDoc, userDoc] = await Promise.all([
        t.get(walletRef),
        t.get(userRef),
      ]);

      const wallet = walletDoc.data() ?? {};
      const user   = userDoc.data()   ?? {};

      const gratuitos = wallet.coinsGratuitos ?? 0;
      const premium   = wallet.coinsPremium   ?? 0;
      const total     = gratuitos + premium;

      if (total < cost) {
        throw new functions.HttpsError(
          'failed-precondition',
          `Saldo insuficiente. Necessário: ${cost}. Disponível: ${total}.`,
        );
      }

      const now = new Date();

      // Exclusividade: Turbo, Impulso e Destaque não coexistem
      assertSingleBoost(user, now, 'destaqueRegional');

      // Cooldown entre ativações
      const lastDestaque = user.destaqueRegional?.lastActivatedAt?.toDate?.() ?? null;
      if (lastDestaque) {
        const secsSince = (now.getTime() - lastDestaque.getTime()) / 1000;
        if (secsSince < PREMIUM_DURATIONS.DESTAQUE_COOLDOWN_SECS) {
          const waitMin = Math.ceil(
            (PREMIUM_DURATIONS.DESTAQUE_COOLDOWN_SECS - secsSince) / 60,
          );
          throw new functions.HttpsError(
            'failed-precondition',
            `Aguarde ${waitMin} min antes de ativar outro Destaque.`,
          );
        }
      }

      // R19: Gratuitos primeiro, Premium depois
      const spentFromGratuitos = Math.min(cost, gratuitos);
      const spentFromPremium   = cost - spentFromGratuitos;
      const newGratuitos = gratuitos - spentFromGratuitos;
      const newPremium   = premium   - spentFromPremium;

      if (newGratuitos < 0 || newPremium < 0) {
        throw new functions.HttpsError('failed-precondition', 'Saldo insuficiente.');
      }

      const expiresAt = new Date(
        now.getTime() + PREMIUM_DURATIONS.DESTAQUE_HOURS * 3600000,
      );

      // 1. Debita a carteira
      t.update(walletRef, {
        coinsGratuitos: newGratuitos,
        coinsPremium:   newPremium,
        totalSpent:     FieldValue.increment(cost),
        updatedAt:      FieldValue.serverTimestamp(),
      });

      // 2. Ativa o Destaque no user
      // boostActiveUntil/boostType no TOPO: a Home consulta esse
      // campo para achar quem tem boost ativo (o Firestore não faz
      // OR eficiente entre turbo/impulso/destaqueRegional).
      // regiaoId é congelado aqui: se o comprador mudar de cidade
      // durante as 4h, o destaque continua valendo onde ele pagou.
      t.set(userRef, {
        boostActiveUntil: admin.firestore.Timestamp.fromDate(expiresAt),
        boostType:        'destaque',
        destaqueRegional: {
          boostScore:      DESTAQUE_BOOST_SCORE,
          regiaoId,
          estadoId,
          city,
          state,
          expiresAt:       admin.firestore.Timestamp.fromDate(expiresAt),
          activatedAt:     FieldValue.serverTimestamp(),
          lastActivatedAt: FieldValue.serverTimestamp(),
          usersInRegion,   // prova do que foi vendido
          version:         PREMIUM_VERSIONS.DESTAQUE,
        },
      }, { merge: true });

      // 3. Economy Ledger
      t.set(ledgerRef.doc(), {
        uid,
        tipo:                 'SPEND_DESTAQUE_REGIONAL',
        feature:              'DESTAQUE_REGIONAL',
        cristaisGratuitos:    -spentFromGratuitos,
        cristaisPremium:      -spentFromPremium,
        saldoAntesGratuito:    gratuitos,
        saldoAntesPremium:     premium,
        saldoDepoisGratuito:   newGratuitos,
        saldoDepoisPremium:    newPremium,
        regiaoId,
        usersInRegion,
        expiresAt:            admin.firestore.Timestamp.fromDate(expiresAt),
        timestamp:            FieldValue.serverTimestamp(),
        imutavel:             true,
      });

      // 4. Premium Usage Log
      const usageId = `destaque_${uid}_${Date.now()}`;
      t.set(logRef.doc(usageId), {
        usageId,
        uid,
        featureType: 'DESTAQUE_REGIONAL',
        purchaseId:  usageId,
        activatedAt: FieldValue.serverTimestamp(),
        expiresAt:   admin.firestore.Timestamp.fromDate(expiresAt),
        status:      'ACTIVE',
        version:     PREMIUM_VERSIONS.DESTAQUE,
        cost,
        regiaoId,
      });

      // 5. Audit log financeiro (R20)
      auditLogFinanceiro({
        uid,
        tipo:                   'SPEND_DESTAQUE_REGIONAL',
        coinTipo:               spentFromPremium > 0 ? 'mixed' : 'gratuito',
        valor:                  -cost,
        origem:                 'activateDestaqueRegional',
        saldoAnteriorGratuito:  gratuitos,
        saldoAnteriorPremium:   premium,
        saldoPosteriorGratuito: newGratuitos,
        saldoPosteriorPremium:  newPremium,
        metadata: {
          spentFromGratuitos,
          spentFromPremium,
          boostScore: DESTAQUE_BOOST_SCORE,
          regiaoId,
          usersInRegion,
          expiresAt: expiresAt.toISOString(),
        },
      }, t);

      return {
        expiresAt:           expiresAt.toISOString(),
        remainingMs:         expiresAt.getTime() - now.getTime(),
        boostScore:          DESTAQUE_BOOST_SCORE,
        regiaoId,
        city,
        state,
        usersInRegion,
        crystalsSpent:       cost,
        spentFromGratuitos,
        spentFromPremium,
        newBalanceGratuitos: newGratuitos,
        newBalancePremium:   newPremium,
      };
    });

    return { success: true, ...result };
  },
);

// ── Status do Destaque Regional ──
export const getDestaqueRegionalStatus = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const [userDoc, walletDoc] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('wallets').doc(uid).get(),
    ]);

    const user   = userDoc.data()   ?? {};
    const wallet = walletDoc.data() ?? {};
    const now    = new Date();

    const destaque       = user.destaqueRegional ?? {};
    const destaqueExpiry = destaque.expiresAt?.toDate?.()       ?? null;
    const lastDestaque   = destaque.lastActivatedAt?.toDate?.() ?? null;

    const gratuitos = wallet.coinsGratuitos ?? 0;
    const premium   = wallet.coinsPremium   ?? 0;
    const total     = gratuitos + premium;
    const cost      = COSTS.DESTAQUE_REGIONAL;

    const temRegiao = isRegiaoIdCoerente(user.regiaoId, user.estadoId);

    // Número real da região, para o usuário decidir informado.
    // Falha aqui não pode derrubar a loja — o diálogo apenas
    // omite a audiência.
    let usersInRegion: number | null = null;
    if (temRegiao) {
      try {
        usersInRegion = await getCachedRegionCount(uid, user.regiaoId, user.regionCount);
      } catch (error) {
        console.error('[destaqueRegional] getCachedRegionCount:', error);
      }
    }

    let status: string = 'READY';
    let remainingMs = 0;

    if (destaqueExpiry && destaqueExpiry > now) {
      status      = 'ACTIVE';
      remainingMs = destaqueExpiry.getTime() - now.getTime();
    } else if (!temRegiao) {
      // Sem região válida não há o que vender.
      status = 'LOCKED';
    } else if (lastDestaque) {
      const secsSince = (now.getTime() - lastDestaque.getTime()) / 1000;
      if (secsSince < PREMIUM_DURATIONS.DESTAQUE_COOLDOWN_SECS) {
        status      = 'COOLDOWN';
        remainingMs = (PREMIUM_DURATIONS.DESTAQUE_COOLDOWN_SECS - secsSince) * 1000;
      } else if (total < cost) {
        status = 'LOCKED';
      }
    } else if (total < cost) {
      status = 'LOCKED';
    }

    return {
      status,
      remainingMs,
      cost,
      boostScore:       DESTAQUE_BOOST_SCORE,
      durationHours:    PREMIUM_DURATIONS.DESTAQUE_HOURS,
      regiaoId:         destaque.regiaoId ?? user.regiaoId ?? null,
      city:             destaque.city  ?? user.city  ?? null,
      state:            destaque.state ?? user.state ?? null,
      hasValidRegion:   temRegiao,
      usersInRegion:    usersInRegion ?? destaque.usersInRegion ?? null,
      minUsersInRegion: DESTAQUE_MIN_USERS_IN_REGION,
      coinsGratuitos:   gratuitos,
      coinsPremium:     premium,
      enabled:          PREMIUM_FLAGS.PREMIUM_DESTAQUE_ENABLED,
    };
  },
);