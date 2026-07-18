// ============================================
// LUMINA — INIT WALLET
// functions/src/economy/initWallet.ts
//
// v2: garante role/isBlocked no documento users/{uid}.
// Admin SDK ignora Firestore Rules — este é o lugar
// correto e seguro para inicializar campos protegidos.
// merge:true torna idempotente (não sobrescreve se já existir).
// ============================================

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REWARDS } from '../config/economy';
import { auditLogFinanceiro } from '../utils/auditLogFinanceiro';

export const initWallet = onCall(
  { maxInstances: 10, region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    const db        = admin.firestore();
    const walletRef = db.collection('wallets').doc(uid);
    const userRef   = db.collection('users').doc(uid);

    try {
      await db.runTransaction(async (t) => {
        const walletSnap = await t.get(walletRef);
        const userSnap   = await t.get(userRef);

        // Garante role/isBlocked SEMPRE — mesmo se a wallet já existe.
        // Só define se ainda não existirem (idempotente, não sobrescreve).
        const userData    = userSnap.exists ? userSnap.data() ?? {} : {};
        const roleFields: Record<string, unknown> = {};
        if (userData.role === undefined)      roleFields.role = 'user';
        if (userData.isBlocked === undefined) roleFields.isBlocked = false;

        if (Object.keys(roleFields).length > 0) {
          t.set(userRef, roleFields, { merge: true });
        }

        // Admin SDK: .exists é propriedade, não método
        if (walletSnap.exists) {
          return;
        }

        const now          = admin.firestore.FieldValue.serverTimestamp();
        const welcomeBonus = REWARDS.LOGIN_BASE;

        t.set(walletRef, {
          uid,
          coinsGratuitos:              welcomeBonus,
          coinsPremium:                0,
          fragments:                   0,
          totalEarned:                 welcomeBonus,
          totalSpent:                  0,
          cristaisGratuitosMensais:    welcomeBonus,
          mesAtual:                    new Date().toISOString().slice(0, 7),
          dailyCristaisGratuitos:      welcomeBonus,
          firstPurchaseDone:           false,
          vault: {
            saldo:              0,
            disponivelEm:       null,
            ultimaContribuicao: null,
          },
          createdAt: now,
          updatedAt: now,
        });

        t.set(userRef, {
          economy: {
            coinsGratuitos: welcomeBonus,
            coinsPremium:   0,
            fragments:      0,
          },
        }, { merge: true });

        auditLogFinanceiro({
          uid,
          tipo:                    'WELCOME_BONUS',
          coinTipo:                'gratuito',
          valor:                   welcomeBonus,
          origem:                  'initWallet',
          saldoAnteriorGratuito:   0,
          saldoAnteriorPremium:    0,
          saldoPosteriorGratuito:  welcomeBonus,
          saldoPosteriorPremium:   0,
        }, t);
      });

      return { success: true };
    } catch (error) {
      console.error('[initWallet] Erro:', error);
      throw new HttpsError('internal', 'Erro ao inicializar carteira.');
    }
  }
);