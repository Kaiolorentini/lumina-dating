// ============================================
// LUMINA — VER VISITANTES v1.0
// functions/src/premium/visitorsService.ts
//
// REGRAS ANTIFRAUDE APLICADAS:
// R1  — Nenhum débito client-side
// R2  — runTransaction() obrigatório
// R3  — Idempotência: visitorsAccess/{uid} é o lock
// R4  — Limite server-side: 1 acesso ativo por vez
// R5  — Race condition: if(acessoAtivo) throw DENTRO da transaction
// R6  — serverTimestamp() sempre
// R19 — Ordem de gasto: Gratuitos primeiro, Premium depois
// R20 — auditLog com saldo anterior e posterior
//
// SEGURANÇA DA LISTA:
// A lista de visitantes NUNCA é retornada sem acesso ativo.
// A verificação é server-side — o cliente não consegue burlar.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { COSTS }      from '../config/economy';
import { auditLogFinanceiro } from '../utils/auditLogFinanceiro';
import {
  PREMIUM_FLAGS,
  PREMIUM_DURATIONS,
  PREMIUM_VERSIONS,
} from './config/premiumFlags';

const db = admin.firestore();

const MAX_VISITORS_RETURNED = 50;

interface VisitorProfile {
  uid:        string;
  name:       string;
  age:        number | null;
  city:       string | null;
  photoURL:   string | null;
  visitedAt:  string;
  visitCount: number;
}

// ============================================
// 1. REVELAR VISITANTES — debita e libera 24h
// ============================================
export const revealVisitors = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    // Feature flag — permite desligar sem deploy do app
    if (!PREMIUM_FLAGS.PREMIUM_VISITORS_ENABLED) {
      throw new functions.HttpsError(
        'unavailable',
        'Ver Visitantes temporariamente indisponível.'
      );
    }

    const cost      = COSTS.REVEAL_VISITORS;
    const walletRef = db.collection('wallets').doc(uid);
    const accessRef = db.collection('visitorsAccess').doc(uid);
    const ledgerRef = db.collection('economyLedger');
    const logRef    = db.collection('premiumUsageLog');

    const result = await db.runTransaction(async (t) => {
      // ── Todas as leituras ANTES de qualquer escrita ──
      const [walletDoc, accessDoc] = await Promise.all([
        t.get(walletRef),
        t.get(accessRef),
      ]);

      if (!walletDoc.exists) {
        throw new functions.HttpsError('not-found', 'Carteira não encontrada.');
      }

      // ── R5: RACE CONDITION — verificação DENTRO da transaction ──
      // Duplo clique dispara 2 chamadas simultâneas. Se esta checagem
      // estivesse fora da transaction, as duas passariam e o usuário
      // pagaria 2x. Aqui o Firestore garante atomicidade: a segunda
      // chamada relê o estado já gravado e morre neste throw.
      const currentAccess = accessDoc.data();
      const currentExpiry = currentAccess?.expiresAt?.toDate?.() ?? null;

      if (currentExpiry && currentExpiry > new Date()) {
        const remainingHours = Math.ceil(
          (currentExpiry.getTime() - Date.now()) / 3600000
        );
        throw new functions.HttpsError(
          'already-exists',
          `Você já tem acesso ativo. Restam ${remainingHours}h.`
        );
      }

      const wallet    = walletDoc.data()!;
      const gratuitos = wallet.coinsGratuitos ?? 0;
      const premium   = wallet.coinsPremium   ?? 0;
      const total     = gratuitos + premium;

      if (total < cost) {
        throw new functions.HttpsError(
          'failed-precondition',
          `Saldo insuficiente. Necessário: ${cost}. Disponível: ${total}.`
        );
      }

      // ── R19: Gratuitos primeiro, Premium depois ──
      const spentFromGratuitos = Math.min(cost, gratuitos);
      const spentFromPremium   = cost - spentFromGratuitos;

      const newGratuitos = gratuitos - spentFromGratuitos;
      const newPremium   = premium   - spentFromPremium;

      // Dupla verificação — saldo nunca negativo
      if (newGratuitos < 0 || newPremium < 0) {
        throw new functions.HttpsError('failed-precondition', 'Saldo insuficiente.');
      }

      const expiresAt = new Date(
        Date.now() + PREMIUM_DURATIONS.VISITORS_HOURS * 3600000
      );

      // ── 1. Debita a carteira ──
      t.update(walletRef, {
        coinsGratuitos: newGratuitos,
        coinsPremium:   newPremium,
        totalSpent:     FieldValue.increment(cost),
        updatedAt:      FieldValue.serverTimestamp(),
      });

      // ── 2. Libera o acesso (este doc é o lock da R3/R5) ──
      t.set(accessRef, {
        uid,
        expiresAt:          admin.firestore.Timestamp.fromDate(expiresAt),
        purchasedAt:        FieldValue.serverTimestamp(),
        cost,
        spentFromGratuitos,
        spentFromPremium,
        version:            PREMIUM_VERSIONS.VISITORS,
      });

      // ── 3. Economy Ledger (imutável) ──
      t.set(ledgerRef.doc(), {
        uid,
        tipo:                'SPEND_REVEAL_VISITORS',
        feature:             'REVEAL_VISITORS',
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

      // ── 4. Premium Usage Log ──
      const usageId = `visitors_${uid}_${Date.now()}`;
      t.set(logRef.doc(usageId), {
        usageId,
        uid,
        featureType: 'REVEAL_VISITORS',
        purchaseId:  usageId,
        activatedAt: FieldValue.serverTimestamp(),
        expiresAt:   admin.firestore.Timestamp.fromDate(expiresAt),
        status:      'ACTIVE',
        version:     PREMIUM_VERSIONS.VISITORS,
        cost,
      });

      // ── 5. R20: auditLog financeiro completo ──
      auditLogFinanceiro({
        uid,
        tipo:                   'SPEND_REVEAL_VISITORS',
        coinTipo:               spentFromPremium > 0 ? 'mixed' : 'gratuito',
        valor:                  -cost,
        origem:                 'revealVisitors',
        saldoAnteriorGratuito:  gratuitos,
        saldoAnteriorPremium:   premium,
        saldoPosteriorGratuito: newGratuitos,
        saldoPosteriorPremium:  newPremium,
        metadata: {
          spentFromGratuitos,
          spentFromPremium,
          expiresAt: expiresAt.toISOString(),
        },
      }, t);

      return {
        expiresAt:           expiresAt.toISOString(),
        remainingMs:         expiresAt.getTime() - Date.now(),
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

// ============================================
// 2. STATUS + LISTA — lista só sai com acesso ativo
// ============================================
export const getVisitorsStatus = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const [accessDoc, walletDoc, countDoc] = await Promise.all([
      db.collection('visitorsAccess').doc(uid).get(),
      db.collection('wallets').doc(uid).get(),
      db.collection('profile_visit_counts').doc(uid).get(),
    ]);

    const access    = accessDoc.data();
    const expiresAt = access?.expiresAt?.toDate?.() ?? null;
    const isActive  = expiresAt ? expiresAt > new Date() : false;

    const wallet    = walletDoc.data() ?? {};
    const gratuitos = wallet.coinsGratuitos ?? 0;
    const premium   = wallet.coinsPremium   ?? 0;
    const total     = gratuitos + premium;
    const cost      = COSTS.REVEAL_VISITORS;

    // Status padronizado (LOCKED / READY / ACTIVE)
    let status: string = 'READY';
    if (isActive)          status = 'ACTIVE';
    else if (total < cost) status = 'LOCKED';

    // Contador é a "isca" — mostra o número mesmo sem acesso
    const totalVisits = countDoc.data()?.totalVisits ?? 0;
    const todayVisits = countDoc.data()?.todayVisits ?? 0;

    // ── SEGURANÇA: sem acesso ativo, lista volta vazia ──
    if (!isActive) {
      return {
        status,
        isActive:       false,
        expiresAt:      null,
        remainingMs:    0,
        cost,
        coinsGratuitos: gratuitos,
        coinsPremium:   premium,
        totalVisits,
        todayVisits,
        visitors:       [] as VisitorProfile[],
        enabled:        PREMIUM_FLAGS.PREMIUM_VISITORS_ENABLED,
      };
    }

    // ── Com acesso: monta a lista ──
    const visitsSnap = await db.collection('profile_visits')
      .where('profileId', '==', uid)
      .orderBy('timestamp', 'desc')
      .limit(200)
      .get();

    // Deduplica por visitante e conta quantas vezes visitou
    const seen = new Map<string, { visitedAt: Date; count: number }>();
    for (const doc of visitsSnap.docs) {
      const data      = doc.data();
      const visitorId = data.visitorId as string;
      if (!visitorId || visitorId === uid) continue;

      const visitedAt = data.timestamp?.toDate?.() ?? new Date(0);
      const existing  = seen.get(visitorId);

      if (existing) {
        existing.count += 1;
        if (visitedAt > existing.visitedAt) existing.visitedAt = visitedAt;
      } else {
        seen.set(visitorId, { visitedAt, count: 1 });
      }
    }

    const visitorIds = Array.from(seen.keys()).slice(0, MAX_VISITORS_RETURNED);

    // Busca perfis em lote (chunks de 10 — limite do 'in' do Firestore)
    const visitors: VisitorProfile[] = [];
    for (let i = 0; i < visitorIds.length; i += 10) {
      const chunk = visitorIds.slice(i, i + 10);
      const snap  = await db.collection('users')
        .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
        .get();

      for (const doc of snap.docs) {
        const u    = doc.data();
        const meta = seen.get(doc.id)!;

        // Não expõe perfis bloqueados
        if (u.isBlocked === true) continue;

        visitors.push({
          uid:        doc.id,
          name:       u.name ?? 'Usuário',
          age:        u.age ?? null,
          city:       u.city ?? null,
          photoURL:   u.photoURL ?? null,
          visitedAt:  meta.visitedAt.toISOString(),
          visitCount: meta.count,
        });
      }
    }

    // Mais recentes primeiro
    visitors.sort((a, b) => b.visitedAt.localeCompare(a.visitedAt));

    return {
      status,
      isActive:       true,
      expiresAt:      expiresAt!.toISOString(),
      remainingMs:    expiresAt!.getTime() - Date.now(),
      cost,
      coinsGratuitos: gratuitos,
      coinsPremium:   premium,
      totalVisits,
      todayVisits,
      visitors,
      enabled:        PREMIUM_FLAGS.PREMIUM_VISITORS_ENABLED,
    };
  }
);