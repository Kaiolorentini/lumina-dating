// ============================================
// LUMINA — SEGUNDA CHANCE
// functions/src/engagement/secondChance.ts
//
// Traz de volta um perfil passado no Sintonize nas últimas 24h.
// Paga sempre (decisão de produto): 15 cristais, gratuitos
// primeiro.
//
// Cobrança e remoção do descarte na MESMA transação: se uma falha,
// a outra não acontece. O descarte vive em
// progression.dismissedProfiles, protegido nas rules — por isso a CF.
//
// Descarte vencido (24h+) é recusado: a pessoa já voltou à fila
// sozinha, e cobrar por isso seria vender o que é de graça.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { COSTS }      from '../config/economy';
import { auditLogFinanceiro, AuditTipo } from '../utils/auditLogFinanceiro';

const db = admin.firestore();

const DISMISS_HOURS = 24;

/** uid do Firebase: letras, números, _ e -. Sem ponto (vira caminho no update). */
const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export const secondChance = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    const { targetUid } = (request.data ?? {}) as { targetUid?: unknown };
    if (typeof targetUid !== 'string' || !UID_PATTERN.test(targetUid) || targetUid === uid) {
      throw new HttpsError('invalid-argument', 'Perfil inválido.');
    }

    const cost      = COSTS.SEGUNDA_CHANCE;
    const userRef   = db.collection('users').doc(uid);
    const walletRef = db.collection('wallets').doc(uid);

    return db.runTransaction(async (t) => {
      const [userSnap, walletSnap] = await Promise.all([t.get(userRef), t.get(walletRef)]);

      const dismissed = (userSnap.data()?.progression?.dismissedProfiles ?? {}) as Record<string, unknown>;
      const at        = dismissed[targetUid];
      const cutoff    = Date.now() - DISMISS_HOURS * 3600 * 1000;

      if (typeof at !== 'number' || at <= cutoff) {
        throw new HttpsError(
          'failed-precondition',
          'Este perfil não está mais entre os passados de hoje — ele já voltou para a sua fila.',
        );
      }

      const wallet    = walletSnap.data() ?? {};
      const gratuitos = (wallet.coinsGratuitos as number) ?? 0;
      const premium   = (wallet.coinsPremium   as number) ?? 0;

      if (gratuitos + premium < cost) {
        throw new HttpsError(
          'failed-precondition',
          `Você precisa de ${cost} cristais e tem ${gratuitos + premium}.`,
        );
      }

      const spentFromGratuitos = Math.min(cost, gratuitos);
      const spentFromPremium   = cost - spentFromGratuitos;

      // Remove SÓ esta entrada do mapa.
      t.update(userRef, {
        [`progression.dismissedProfiles.${targetUid}`]: FieldValue.delete(),
      });

      t.set(walletRef, {
        coinsGratuitos: FieldValue.increment(-spentFromGratuitos),
        coinsPremium:   FieldValue.increment(-spentFromPremium),
        totalSpent:     FieldValue.increment(cost),
        updatedAt:      FieldValue.serverTimestamp(),
      }, { merge: true });

      t.set(db.collection('economyLedger').doc(), {
        uid,
        tipo:              'SPEND_SEGUNDA_CHANCE',
        feature:           'SEGUNDA_CHANCE',
        origem:            'secondChance',
        targetUid,
        cristaisGratuitos: -spentFromGratuitos,
        cristaisPremium:   -spentFromPremium,
        timestamp:         FieldValue.serverTimestamp(),
        imutavel:          true,
      });

      auditLogFinanceiro({
        uid,
        tipo:                   'SPEND_SEGUNDA_CHANCE' as AuditTipo,
        coinTipo:               spentFromPremium > 0 ? 'mixed' : 'gratuito',
        valor:                  -cost,
        origem:                 'secondChance',
        saldoAnteriorGratuito:  gratuitos,
        saldoAnteriorPremium:   premium,
        saldoPosteriorGratuito: gratuitos - spentFromGratuitos,
        saldoPosteriorPremium:  premium - spentFromPremium,
        metadata: { targetUid, spentFromGratuitos, spentFromPremium },
      }, t);

      return { success: true, cost, spentFromGratuitos, spentFromPremium };
    });
  },
);