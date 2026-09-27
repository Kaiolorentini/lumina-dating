// ============================================
// LUMINA — REVELAR GATILHO EMOCIONAL
// functions/src/engagement/revealTrigger.ts
//
// Revela quem está por trás de uma notificação de gatilho, com
// cobrança e revelação na MESMA transação.
//
// Antes: o id de quem visitou já estava na notificação (legível
// pelo app), o app cobrava pelo spendCoins e depois buscava o
// perfil. A cobrança era só uma trava na tela; "Pensou em Você"
// mostrava 20 e cobrava 50; e se a busca falhasse, pagava-se por
// nada.
//
// Preços (economy.ts):
//   Quase Sintonia    25 — grátis com Galáxia Plus
//   Pensou em Você    20 — grátis com Galáxia Plus
//   Sintonia Perdida  35 PREMIUM — paga para todos
//
// Revelar de novo não cobra de novo. Perfil que não existe mais:
// nada é cobrado.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { COSTS }      from '../config/economy';
import { isGalaxiaPlusActive } from '../payments/activateGalaxiaPlus';
import { auditLogFinanceiro, AuditTipo } from '../utils/auditLogFinanceiro';

const db = admin.firestore();

const PAID_TRIGGERS: Record<string, {
  costKey:      keyof typeof COSTS;
  premiumOnly:  boolean;
  freeWithPlus: boolean;
}> = {
  quase_sintonia:   { costKey: 'REVEAL_QUASE_SINTONIA',   premiumOnly: false, freeWithPlus: true  },
  pensou_em_voce:   { costKey: 'REVEAL_PENSOU_EM_VOCE',   premiumOnly: false, freeWithPlus: true  },
  sintonia_perdida: { costKey: 'REVEAL_SINTONIA_PERDIDA', premiumOnly: true,  freeWithPlus: false },
};

interface RevealResult {
  uid:             string;
  name:            string;
  photoURL:        string;
  charged:         number;
  free:            boolean;
  alreadyRevealed: boolean;
}

export const revealTrigger = onCall(
  { region: 'us-central1' },
  async (request): Promise<RevealResult> => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    const { notificationId } = (request.data ?? {}) as { notificationId?: unknown };
    if (typeof notificationId !== 'string' || !notificationId || notificationId.includes('/')) {
      throw new HttpsError('invalid-argument', 'Notificação inválida.');
    }

    const notifRef  = db.collection('notifications').doc(notificationId);
    const secretRef = db.collection('triggerSecrets').doc(notificationId);
    const walletRef = db.collection('wallets').doc(uid);

    // Pré-leitura: descobrir QUEM é, para ler o perfil dentro da
    // transação e não cobrar por um perfil que não existe mais.
    const [preNotif, preSecret] = await Promise.all([notifRef.get(), secretRef.get()]);
    const preNotifData  = preNotif.data();
    const preSecretData = preSecret.data();

    if (!preNotifData || preNotifData.userId !== uid) {
      throw new HttpsError('not-found', 'Notificação não encontrada.');
    }

    const cfg = PAID_TRIGGERS[preNotifData.type as string];
    if (!cfg) throw new HttpsError('invalid-argument', 'Esta notificação não tem revelação.');

    // Notificações antigas (antes de 27/09) têm o id em dados.
    const visitorId =
      (preSecretData?.visitorId as string | undefined) ??
      (preNotifData.dados?.visitorId as string | undefined) ??
      null;

    if (!visitorId) {
      throw new HttpsError('failed-precondition', 'Esta notificação não pode ser revelada.');
    }

    const visitorRef = db.collection('users').doc(visitorId);
    const isPlus     = cfg.freeWithPlus ? await isGalaxiaPlusActive(uid) : false;

    const tx = await db.runTransaction(async (t) => {
      const [secretSnap, walletSnap, visitorSnap] = await Promise.all([
        t.get(secretRef),
        t.get(walletRef),
        t.get(visitorRef),
      ]);

      if (!visitorSnap.exists) {
        throw new HttpsError('not-found', 'Este perfil não está mais disponível. Nada foi cobrado.');
      }

      if (secretSnap.data()?.revealed === true) {
        return { charged: 0, free: false, alreadyRevealed: true, saved: 0 };
      }

      const free = cfg.freeWithPlus && isPlus;
      const cost = free ? 0 : COSTS[cfg.costKey];

      if (cost > 0) {
        const wallet    = walletSnap.data() ?? {};
        const gratuitos = (wallet.coinsGratuitos as number) ?? 0;
        const premium   = (wallet.coinsPremium   as number) ?? 0;

        let spentFromGratuitos = 0;
        let spentFromPremium   = 0;

        if (cfg.premiumOnly) {
          if (premium < cost) {
            throw new HttpsError(
              'failed-precondition',
              `Você precisa de ${cost} Cristais Premium e tem ${premium}.`,
            );
          }
          spentFromPremium = cost;
        } else {
          if (gratuitos + premium < cost) {
            throw new HttpsError(
              'failed-precondition',
              `Você precisa de ${cost} cristais e tem ${gratuitos + premium}.`,
            );
          }
          spentFromGratuitos = Math.min(cost, gratuitos);
          spentFromPremium   = cost - spentFromGratuitos;
        }

        t.set(walletRef, {
          coinsGratuitos: FieldValue.increment(-spentFromGratuitos),
          coinsPremium:   FieldValue.increment(-spentFromPremium),
          totalSpent:     FieldValue.increment(cost),
          updatedAt:      FieldValue.serverTimestamp(),
        }, { merge: true });

        t.set(db.collection('economyLedger').doc(), {
          uid,
          tipo:              `SPEND_${cfg.costKey}`,
          feature:           cfg.costKey,
          origem:            'revealTrigger',
          notificationId,
          cristaisGratuitos: -spentFromGratuitos,
          cristaisPremium:   -spentFromPremium,
          timestamp:         FieldValue.serverTimestamp(),
          imutavel:          true,
        });

        auditLogFinanceiro({
          uid,
          tipo:                   `SPEND_${cfg.costKey}` as AuditTipo,
          coinTipo:               cfg.premiumOnly ? 'premium' : 'mixed',
          valor:                  -cost,
          origem:                 'revealTrigger',
          saldoAnteriorGratuito:  gratuitos,
          saldoAnteriorPremium:   premium,
          saldoPosteriorGratuito: gratuitos - spentFromGratuitos,
          saldoPosteriorPremium:  premium - spentFromPremium,
          metadata: { notificationId, spentFromGratuitos, spentFromPremium },
        }, t);
      }

      t.set(secretRef, {
        userId:     uid,
        visitorId,
        type:       preNotifData.type,
        revealed:   true,
        revealedAt: FieldValue.serverTimestamp(),
        charged:    cost,
        free,
      }, { merge: true });

      t.set(notifRef, {
        read:       true,
        revealedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return { charged: cost, free, alreadyRevealed: false, saved: free ? COSTS[cfg.costKey] : 0 };
    });

    // Conta para a tela da Galáxia Plus o que a assinatura economizou.
    if (tx.free && tx.saved > 0) {
      db.collection('galaxiaPlus').doc(uid).set({
        visitorsRevealed:   FieldValue.increment(1),
        crystalsSavedTotal: FieldValue.increment(tx.saved),
      }, { merge: true }).catch(() => {});
    }

    const visitor = (await visitorRef.get()).data() ?? {};

    return {
      uid:             visitorId,
      name:            (visitor.name as string) ?? '',
      photoURL:        (visitor.photoURL as string) ?? '',
      charged:         tx.charged,
      free:            tx.free,
      alreadyRevealed: tx.alreadyRevealed,
    };
  },
);