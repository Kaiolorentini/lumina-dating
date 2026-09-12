// ============================================
// LUMINA — IMPULSO DE PERFIL v1.0
// functions/src/premium/impulsoService.ts
//
// REGRA GLOBAL PREMIUM:
// ✗ Nunca gera Cristais/Fragmentos/Prestígio
// ✗ Não afeta Ranking, Cofre, Conquistas
// ✓ Apenas +boostScore na ordenação da Home por 30 min
// ✓ Transaction única: Wallet → Ativa → Ledger → UsageLog
// ✓ Não acumula: bloqueia se já ativo
// ✓ Cooldown entre ativações
//
// DIFERENÇAS vs Turbo:
// - Aceita Gratuitos + Premium (R19: gratuitos primeiro)
// - boostScore fixo (não multiplica sintonia — só soma posição)
// - getActiveBoostScore no usersService já lê o campo 'impulso'
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { COSTS }      from '../config/economy';
import { auditLogFinanceiro } from '../utils/auditLogFinanceiro';
import { assertSingleBoost } from './utils/assertSingleBoost';
import {
  PREMIUM_FLAGS,
  PREMIUM_DURATIONS,
  PREMIUM_VERSIONS,
} from './config/premiumFlags';

const db = admin.firestore();

// boostScore do Impulso — menor que o Turbo (180).
// Coloca no topo mas o Turbo, sendo premium-only e mais caro,
// tem prioridade quando ambos estão ativos.
const IMPULSO_BOOST_SCORE = 120;

// ── Ativar Impulso ──
export const activateImpulso = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    if (!PREMIUM_FLAGS.PREMIUM_IMPULSO_ENABLED) {
      throw new functions.HttpsError('unavailable', 'Impulso temporariamente indisponível.');
    }

    const cost      = COSTS.IMPULSO_PERFIL;
    const walletRef = db.collection('wallets').doc(uid);
    const userRef   = db.collection('users').doc(uid);
    const logRef    = db.collection('premiumUsageLog');
    const ledgerRef = db.collection('economyLedger');

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
          `Saldo insuficiente. Necessário: ${cost}. Disponível: ${total}.`
        );
      }

      const now = new Date();

      // Exclusividade: Turbo, Impulso e Destaque não coexistem
      assertSingleBoost(user, now, 'impulso');

      // ── Cooldown entre ativações ──
      const lastImpulso = user.impulso?.lastActivatedAt?.toDate?.() ?? null;
      if (lastImpulso) {
        const secsSince = (now.getTime() - lastImpulso.getTime()) / 1000;
        if (secsSince < PREMIUM_DURATIONS.IMPULSO_COOLDOWN_SECS) {
          const waitMin = Math.ceil(
            (PREMIUM_DURATIONS.IMPULSO_COOLDOWN_SECS - secsSince) / 60
          );
          throw new functions.HttpsError(
            'failed-precondition',
            `Aguarde ${waitMin} min antes de ativar outro Impulso.`
          );
        }
      }

      // ── R19: Gratuitos primeiro, Premium depois ──
      const spentFromGratuitos = Math.min(cost, gratuitos);
      const spentFromPremium   = cost - spentFromGratuitos;
      const newGratuitos = gratuitos - spentFromGratuitos;
      const newPremium   = premium   - spentFromPremium;

      if (newGratuitos < 0 || newPremium < 0) {
        throw new functions.HttpsError('failed-precondition', 'Saldo insuficiente.');
      }

      const expiresAt = new Date(
        now.getTime() + PREMIUM_DURATIONS.IMPULSO_MINUTES * 60000
      );

      // 1. Debita a carteira
      t.update(walletRef, {
        coinsGratuitos: newGratuitos,
        coinsPremium:   newPremium,
        totalSpent:     FieldValue.increment(cost),
        updatedAt:      FieldValue.serverTimestamp(),
      });

      // 2. Ativa o Impulso no user (lido pelo getActiveBoostScore)
      t.set(userRef, {
        boostActiveUntil: admin.firestore.Timestamp.fromDate(expiresAt),
        boostType:        'impulso',
        impulso: {
          boostScore:      IMPULSO_BOOST_SCORE,
          expiresAt:       admin.firestore.Timestamp.fromDate(expiresAt),
          activatedAt:     FieldValue.serverTimestamp(),
          lastActivatedAt: FieldValue.serverTimestamp(),
          version:         PREMIUM_VERSIONS.IMPULSO,
        },
      }, { merge: true });

      // 3. Economy Ledger
      t.set(ledgerRef.doc(), {
        uid,
        tipo:                'SPEND_IMPULSO_PERFIL',
        feature:             'IMPULSO_PERFIL',
        cristaisGratuitos:   -spentFromGratuitos,
        cristaisPremium:     -spentFromPremium,
        saldoAntesGratuito:   gratuitos,
        saldoAntesPremium:    premium,
        saldoDepoisGratuito:  newGratuitos,
        saldoDepoisPremium:   newPremium,
        expiresAt:           admin.firestore.Timestamp.fromDate(expiresAt),
        timestamp:           FieldValue.serverTimestamp(),
        imutavel:            true,
      });

      // 4. Premium Usage Log
      const usageId = `impulso_${uid}_${Date.now()}`;
      t.set(logRef.doc(usageId), {
        usageId,
        uid,
        featureType: 'IMPULSO_PERFIL',
        purchaseId:  usageId,
        activatedAt: FieldValue.serverTimestamp(),
        expiresAt:   admin.firestore.Timestamp.fromDate(expiresAt),
        status:      'ACTIVE',
        version:     PREMIUM_VERSIONS.IMPULSO,
        cost,
      });

      // 5. Audit log financeiro
      auditLogFinanceiro({
        uid,
        tipo:                   'SPEND_IMPULSO_PERFIL',
        coinTipo:               spentFromPremium > 0 ? 'mixed' : 'gratuito',
        valor:                  -cost,
        origem:                 'activateImpulso',
        saldoAnteriorGratuito:  gratuitos,
        saldoAnteriorPremium:   premium,
        saldoPosteriorGratuito: newGratuitos,
        saldoPosteriorPremium:  newPremium,
        metadata: {
          spentFromGratuitos,
          spentFromPremium,
          boostScore: IMPULSO_BOOST_SCORE,
          expiresAt:  expiresAt.toISOString(),
        },
      }, t);

      return {
        expiresAt:           expiresAt.toISOString(),
        remainingMs:         expiresAt.getTime() - now.getTime(),
        boostScore:          IMPULSO_BOOST_SCORE,
        crystalsSpent:       cost,
        spentFromGratuitos,
        spentFromPremium,
        newBalanceGratuitos: newGratuitos,
        newBalancePremium:   newPremium,
      };
    });

    return { success: true, ...result };
  }
);

// ── Status do Impulso ──
export const getImpulsoStatus = functions.onCall(
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

    const impulsoExpiry = user.impulso?.expiresAt?.toDate?.()      ?? null;
    const lastImpulso   = user.impulso?.lastActivatedAt?.toDate?.() ?? null;

    const gratuitos = wallet.coinsGratuitos ?? 0;
    const premium   = wallet.coinsPremium   ?? 0;
    const total     = gratuitos + premium;
    const cost      = COSTS.IMPULSO_PERFIL;

    let status: string = 'READY';
    let remainingMs = 0;

    if (impulsoExpiry && impulsoExpiry > now) {
      status      = 'ACTIVE';
      remainingMs = impulsoExpiry.getTime() - now.getTime();
    } else if (lastImpulso) {
      const secsSince = (now.getTime() - lastImpulso.getTime()) / 1000;
      if (secsSince < PREMIUM_DURATIONS.IMPULSO_COOLDOWN_SECS) {
        status      = 'COOLDOWN';
        remainingMs = (PREMIUM_DURATIONS.IMPULSO_COOLDOWN_SECS - secsSince) * 1000;
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
      boostScore:     IMPULSO_BOOST_SCORE,
      coinsGratuitos: gratuitos,
      coinsPremium:   premium,
      enabled:        PREMIUM_FLAGS.PREMIUM_IMPULSO_ENABLED,
    };
  }
);