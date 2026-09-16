// ============================================
// LUMINA — MOLDURAS DE PERFIL v1.0
// functions/src/engagement/frames.ts
//
// FASE 5 — equipar e listar molduras.
//
// A posse vive em dois lugares e a leitura é unificada:
//   progression.unlockedItems.{id} = true       → permanente
//   progression.frameRentals.{id}  = Timestamp  → aluguel 30 dias
//
// equipFrame NUNCA confia no cliente: valida posse e validade
// no servidor. A rule de users já bloqueia o cliente de escrever
// em progression, então este é o único caminho.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { COSMETICS_CATALOG } from '../config/cosmeticsCatalog';

const db = admin.firestore();

interface OwnedFrame {
  id:          string;
  title:       string;
  description: string;
  rarity:      string;
  borderColor: string;
  glowColor:   string;
  borderWidth: number;
  animated:    boolean;
  permanent:   boolean;
  expiresAt:   string | null;  // ISO; null se permanente
  expired:     boolean;
}

// Monta a lista de molduras que o usuário possui, já resolvendo
// expiração. Usado pelo equip (validação) e pelo status (tela).
function buildOwnedFrames(userData: Record<string, any>): OwnedFrame[] {
  const unlocked = userData.progression?.unlockedItems ?? {};
  const rentals  = userData.progression?.frameRentals  ?? {};
  const now      = Date.now();
  const owned: OwnedFrame[] = [];

  for (const def of Object.values(COSMETICS_CATALOG)) {
    const isPermanent = unlocked[def.id] === true;
    const rentalDate  = rentals[def.id]?.toDate?.() ?? null;
    const hasRental   = rentalDate !== null;

    if (!isPermanent && !hasRental) continue;

    const expired = !isPermanent && hasRental && rentalDate.getTime() <= now;

    owned.push({
      id:          def.id,
      title:       def.title,
      description: def.description,
      rarity:      def.rarity,
      borderColor: def.borderColor,
      glowColor:   def.glowColor,
      borderWidth: def.borderWidth,
      animated:    def.animated,
      permanent:   isPermanent,
      expiresAt:   isPermanent ? null : rentalDate?.toISOString() ?? null,
      expired,
    });
  }

  return owned;
}

// ── 1. Equipar moldura ──
export const equipFrame = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const { frameId } = request.data as { frameId: string | null };

    const userRef = db.collection('users').doc(uid);

    // null = desequipar. Caminho legítimo, sem validação de posse.
    if (frameId === null) {
      await userRef.set({
        progression: { equippedFrame: null, equippedFrameUntil: null },
      }, { merge: true });
      return { success: true, equippedFrame: null };
    }

    if (!frameId || !COSMETICS_CATALOG[frameId]) {
      throw new functions.HttpsError('invalid-argument', 'Moldura inválida.');
    }

    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw new functions.HttpsError('not-found', 'Usuário não encontrado.');
    }

    const owned = buildOwnedFrames(userDoc.data() ?? {});
    const match = owned.find(f => f.id === frameId);

    if (!match) {
      throw new functions.HttpsError('permission-denied', 'Você não possui esta moldura.');
    }
    if (match.expired) {
      throw new functions.HttpsError(
        'failed-precondition',
        'Esta moldura expirou. Adquira novamente na loja.'
      );
    }

    // equippedFrameUntil é gravado junto porque QUEM VÊ o perfil
    // alheio lê esses campos direto do documento e não tem como
    // saber se o aluguel venceu. A limpeza do getFramesStatus só
    // roda quando o próprio dono abre o app.
    await userRef.set({
      progression: {
        equippedFrame:      frameId,
        equippedFrameAt:    FieldValue.serverTimestamp(),
        equippedFrameUntil: match.permanent || !match.expiresAt
          ? null
          : admin.firestore.Timestamp.fromDate(new Date(match.expiresAt)),
      },
    }, { merge: true });

    return { success: true, equippedFrame: frameId };
  }
);

// ── 2. Status — o que o usuário tem e o que está usando ──
export const getFramesStatus = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const userDoc  = await db.collection('users').doc(uid).get();
    const userData = userDoc.data() ?? {};

    const owned = buildOwnedFrames(userData);
    let equipped: string | null = userData.progression?.equippedFrame ?? null;

    // Moldura equipada que expirou sai sozinha, sem job agendado:
    // a limpeza acontece na primeira leitura depois do vencimento.
    if (equipped) {
      const active = owned.find(f => f.id === equipped && !f.expired);
      if (!active) {
        equipped = null;
        await db.collection('users').doc(uid).set({
          progression: { equippedFrame: null, equippedFrameUntil: null },
        }, { merge: true });
      }
    }

    return {
      owned:         owned.filter(f => !f.expired),
      expired:       owned.filter(f =>  f.expired),
      equippedFrame: equipped,
    };
  }
);