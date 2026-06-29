// ============================================
// LUMINA — REWARD SERVICE v5.2
// functions/src/services/rewardService.ts
//
// REGRA 21: XP nunca conhece Cristais.
// Recompensas fluem: earnXP → LEVEL_UP → RewardService → WalletService
// Cada sistema independente.
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { TreeStageDef } from '../config/treeTable';

const db = admin.firestore();

// Credita recompensa de estágio da árvore (REGRA 21)
export async function grantTreeStageReward(
  t:     FirebaseFirestore.Transaction,
  uid:   string,
  stage: TreeStageDef
): Promise<void> {
  const { reward } = stage;

  if (reward.type === 'crystals' && typeof reward.value === 'number') {
    const walletRef = db.collection('wallets').doc(uid);
    const walletDoc = await t.get(walletRef);
    const wallet    = walletDoc.data() ?? {};
    const prevGrat  = wallet.coinsGratuitos ?? 0;

    t.set(walletRef, {
      coinsGratuitos: FieldValue.increment(reward.value),
      updatedAt:      FieldValue.serverTimestamp(),
    }, { merge: true });

    // Economy Ledger imutável
    t.set(db.collection('economyLedger').doc(), {
      uid,
      tipo:        'ARVORE_RECOMPENSA',
      origem:      'rewardService',
      stage:       stage.stage,
      stageName:   stage.name,
      cristais:    reward.value,
      saldoAntes:  prevGrat,
      saldoDepois: prevGrat + reward.value,
      timestamp:   FieldValue.serverTimestamp(),
      imutavel:    true,
    });
  }
  // badge e frame: armazenados no perfil do usuário
  else if (reward.type === 'badge' || reward.type === 'frame') {
    t.set(db.collection('users').doc(uid), {
      [`progression.unlockedItems.${reward.type}_${reward.value}`]: true,
    }, { merge: true });
  }
  // animation: flag de desbloqueio
  else if (reward.type === 'animation') {
    t.set(db.collection('users').doc(uid), {
      [`progression.unlockedAnimations.${reward.value}`]: true,
    }, { merge: true });
  }
}