// ============================================
// LUMINA — AVISO DE COFRE LIBERADO
// functions/src/engagement/notifyVaultUnlocked.ts
//
// O Cofre libera o saque 48h depois de o ciclo abrir, e nada
// avisava — a pessoa só descobria abrindo a tela. O saque
// continua MANUAL, por decisão de produto: aqui só se avisa.
//
// De hora em hora, busca carteiras com o ciclo vencido e o aviso
// pendente. Cada ciclo avisa UMA vez: o pendente é gravado ao
// abrir o ciclo (VaultService, levelRewardService) e apagado
// aqui ou no saque.
//
// Só avisa quando há o mínimo para sacar (100 fragmentos = 1
// cristal) — "seu Cofre liberou 0 cristais" seria ruído.
//
// Índice obrigatório em wallets:
//   vaultUnlockNotifyPending ASC + vaultUnlockAt ASC
// ============================================

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin     from 'firebase-admin';
import { notifyUser } from '../utils/notifyUser';

const db = admin.firestore();

const PAGE_SIZE             = 200;
const MAX_PAGES_PER_RUN     = 5;   // até 1.000 cofres por hora
const FRAGMENTS_PER_CRYSTAL = 100;

export const notifyVaultUnlocked = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'America/Sao_Paulo',
    region:   'us-central1',
  },
  async () => {
    const now = admin.firestore.Timestamp.now();
    let checked  = 0;
    let notified = 0;

    for (let page = 0; page < MAX_PAGES_PER_RUN; page++) {
      const snap = await db.collection('wallets')
        .where('vaultUnlockNotifyPending', '==', true)
        .where('vaultUnlockAt', '<=', now)
        .limit(PAGE_SIZE)
        .get();

      if (snap.empty) break;

      await Promise.all(snap.docs.map(async (walletDoc) => {
        const fragments = (walletDoc.get('vaultFragments') as number | undefined) ?? 0;

        // Marca ANTES de avisar: se o push falhar, o aviso não é
        // reenviado a cada hora pelo resto do ciclo.
        await walletDoc.ref.update({ vaultUnlockNotifyPending: false });

        if (fragments < FRAGMENTS_PER_CRYSTAL) return;

        await notifyUser({
          userId: walletDoc.id, // wallets/{uid}
          title:  '🗝️ Seu Cofre está liberado',
          body:   `${fragments} fragmentos esperando por você. Toque para sacar.`,
          type:   'cofre_pronto',
        });
        notified++;
      }));

      checked += snap.size;
      if (snap.size < PAGE_SIZE) break;
    }

    console.log(`[notifyVaultUnlocked] ${checked} cofres verificados, ${notified} avisados`);
  },
);