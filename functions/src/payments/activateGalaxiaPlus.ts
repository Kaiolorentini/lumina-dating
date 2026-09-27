// ============================================
// LUMINA — ATIVAÇÃO DA GALÁXIA PLUS
// functions/src/payments/activateGalaxiaPlus.ts
//
// Chamado pelo webhook quando o Pix de uma venda marcada com
// `isSubscription` é confirmado.
//
// ── ACESSO DE 30 DIAS, NÃO ASSINATURA ──
//
// Não há cobrança recorrente: a pessoa paga e tem 30 dias.
// Comprar de novo SOMA ao prazo que resta, em vez de
// substituir — quem renova antes de expirar não perde o que
// sobrou.
//
// ── O QUE FICA QUANDO EXPIRA ──
//
// Cristais, fragmentos, Turbos e o badge são DEFINITIVOS: já
// foram entregues. O que para são os benefícios contínuos —
// as 4 cartas grátis, o bônus da Faísca, os visitantes e o
// saque imediato.
//
// ── PRIMEIRA VEZ vs RENOVAÇÃO ──
//
// O badge Constelação Guia é concedido UMA vez. Nas renovações
// vêm 20 fragmentos no lugar, porque o badge já é da pessoa e
// receber nada seria uma renovação mais pobre que a primeira.
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { GALAXIA_PLUS } from '../config/economy';

const db = admin.firestore();

export interface ActivationResult {
  /** Quando o acesso termina, já somado ao que restava. */
  expiresAt:      Date;
  /** true na primeira ativação da conta. */
  isFirstTime:    boolean;
  crystals:       number;
  turbos:         number;
  fragments:      number;
  badgeGranted:   boolean;
}

/**
 * Ativa ou renova o acesso. Idempotente pelo saleId: o webhook
 * pode ser reentregue pelo Asaas, e sem isto a mesma compra
 * daria 30 dias duas vezes.
 */
export async function activateGalaxiaPlus(
  uid: string,
  saleId: string,
): Promise<ActivationResult | null> {
  const userRef   = db.collection('users').doc(uid);
  const walletRef = db.collection('wallets').doc(uid);
  const subRef    = db.collection('galaxiaPlus').doc(uid);

  return db.runTransaction(async (t) => {
    const [subSnap, userSnap, walletSnap] = await Promise.all([
      t.get(subRef),
      t.get(userRef),
      t.get(walletRef),
    ]);

    const sub    = subSnap.data() ?? {};
    const user   = userSnap.data() ?? {};
    const wallet = walletSnap.data() ?? {};

    // Idempotência: esta venda já foi processada.
    const processed: string[] = sub.processedSales ?? [];
    if (processed.includes(saleId)) {
      console.log('[galaxiaPlus] Venda já processada:', saleId);
      return null;
    }

    // SOMA ao que resta, em vez de substituir. Quem renova no
    // dia 25 fica com 35 dias, não com 30.
    const now       = Date.now();
    const currentMs = (sub.expiresAt as admin.firestore.Timestamp | undefined)
      ?.toDate?.().getTime() ?? 0;
    const base      = Math.max(now, currentMs);
    const expiresAt = new Date(base + GALAXIA_PLUS.DURATION_DAYS * 24 * 3600 * 1000);

    // O badge é UMA vez por conta, não por ativação.
    const unlocked = (user.progression?.unlockedItems ?? {}) as Record<string, boolean>;
    const hasBadge = unlocked[GALAXIA_PLUS.BADGE_ID] === true;
    const isFirstTime = !hasBadge && !sub.activatedAt;

    const fragments = isFirstTime ? 0 : GALAXIA_PLUS.RENEWAL_FRAGMENTS;

    // ── A assinatura ──
    t.set(subRef, {
      uid,
      active:         true,
      expiresAt:      admin.firestore.Timestamp.fromDate(expiresAt),
      activatedAt:    sub.activatedAt ?? FieldValue.serverTimestamp(),
      lastRenewalAt:  FieldValue.serverTimestamp(),
      totalRenewals:  FieldValue.increment(1),
      processedSales: FieldValue.arrayUnion(saleId),

      // Turbos ficam AQUI e não na wallet: são um benefício da
      // assinatura, com origem rastreável, e o usuário precisa
      // ver quantos usou na tela da Galáxia Plus.
      turbosGranted:  FieldValue.increment(GALAXIA_PLUS.TURBOS_ON_ACTIVATION),

      // Contadores de uso, para a tela mostrar o consumo.
      // Iniciados só na primeira vez; a renovação preserva o
      // histórico.
      ...(isFirstTime && {
        turbosUsed:        0,
        visitorsRevealed:  0,
        instantWithdraws:  0,
        faiscaBonusTotal:  0,
        cardsDrawnTotal:   0,
      }),
    }, { merge: true });

    // ── Cristais premium ──
    t.set(walletRef, {
      coinsPremium: FieldValue.increment(GALAXIA_PLUS.CRYSTALS_ON_ACTIVATION),
      ...(fragments > 0 && { fragments: FieldValue.increment(fragments) }),
      updatedAt:    FieldValue.serverTimestamp(),
    }, { merge: true });

    // ── Badge, só na primeira vez ──
    if (isFirstTime) {
      t.set(userRef, {
        progression: {
          unlockedItems: { [GALAXIA_PLUS.BADGE_ID]: true },
          // Revela o badge na próxima abertura do app, como as
          // conquistas fazem.
          pendingCosmeticReveal: GALAXIA_PLUS.BADGE_ID,
        },
      }, { merge: true });
    }

    // ── Ledger ──
    t.set(db.collection('economyLedger').doc(), {
      uid,
      tipo:        isFirstTime ? 'GALAXIA_PLUS_ATIVACAO' : 'GALAXIA_PLUS_RENOVACAO',
      origem:      'activateGalaxiaPlus',
      saleId,
      cristais:    GALAXIA_PLUS.CRYSTALS_ON_ACTIVATION,
      premium:     GALAXIA_PLUS.CRYSTALS_ON_ACTIVATION,
      fragmentos:  fragments,
      turbos:      GALAXIA_PLUS.TURBOS_ON_ACTIVATION,
      badge:       isFirstTime ? GALAXIA_PLUS.BADGE_ID : null,
      expiresAt:   admin.firestore.Timestamp.fromDate(expiresAt),
      saldoAntes:  (wallet.coinsPremium as number) ?? 0,
      saldoDepois: ((wallet.coinsPremium as number) ?? 0) + GALAXIA_PLUS.CRYSTALS_ON_ACTIVATION,
      timestamp:   FieldValue.serverTimestamp(),
      imutavel:    true,
    });

    return {
      expiresAt,
      isFirstTime,
      crystals:     GALAXIA_PLUS.CRYSTALS_ON_ACTIVATION,
      turbos:       GALAXIA_PLUS.TURBOS_ON_ACTIVATION,
      fragments,
      badgeGranted: isFirstTime,
    };
  });
}

/**
 * O acesso está ativo agora?
 *
 * Usado por todos os benefícios. Uma leitura — o documento é
 * pequeno e vale a pena não confiar num campo espelhado no
 * `users`, que poderia ficar desatualizado.
 */
export async function isGalaxiaPlusActive(uid: string): Promise<boolean> {
  const snap = await db.collection('galaxiaPlus').doc(uid).get();
  if (!snap.exists) return false;

  const expiresAt = (snap.data()?.expiresAt as admin.firestore.Timestamp | undefined)
    ?.toDate?.();

  return expiresAt ? expiresAt.getTime() > Date.now() : false;
}