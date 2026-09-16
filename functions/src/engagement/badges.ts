// ============================================
// LUMINA — BADGES DE PERFIL v1.0
// functions/src/engagement/badges.ts
//
// FASE 6 — equipar e listar badges.
//
// TRÊS ORIGENS DE POSSE, uma leitura só:
//   unlockedItems.badge_* = true      → conquista OU loja/fragmentos
//   badgeRentals.badge_*  = Timestamp → loja/cristais, 30 dias
//
// FASE 8: os badges de FRAGMENTOS passaram a ser permanentes e
// gravam em unlockedItems, o mesmo campo dos de conquista. A
// distinção entre eles é feita pelo catálogo de origem, não pelo
// campo: se o id está em BADGES_CATALOG é da loja; se está no
// índice de conquistas, é conquistado.
//
// Os badges de conquista vêm do achievementsCatalog e do
// collectionsCatalog (19 no total) e NÃO estão no badgesCatalog —
// aquele é só a linha vendável. Por isso a leitura cruza os três
// catálogos.
//
// Espelha frames.ts. Molduras e badges são campos separados: o
// usuário equipa uma de cada ao mesmo tempo.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { BADGES_CATALOG }        from '../config/badgesCatalog';
import { ACHIEVEMENTS_CATALOG }  from '../config/achievementsCatalog';
import { COLLECTIONS_CATALOG }   from '../config/collectionsCatalog';

const db = admin.firestore();

interface OwnedBadge {
  id:          string;
  title:       string;
  description: string;
  rarity:      string;
  source:      'SHOP' | 'ACHIEVEMENT';
  // Direção visual — só os da loja têm; os de conquista são
  // desenhados pelo cliente a partir da raridade.
  shape:       string | null;
  coreColor:   string | null;
  accentColor: string | null;
  glowColor:   string | null;
  motion:      string | null;
  permanent:   boolean;
  expiresAt:   string | null;
  expired:     boolean;
}

// Índice dos badges de conquista: id do badge → título e raridade
// da conquista/coleção que o concede. Montado uma vez por
// invocação, não por usuário.
function buildAchievementBadgeIndex(): Record<string, { title: string; description: string; rarity: string }> {
  const index: Record<string, { title: string; description: string; rarity: string }> = {};

  for (const ach of Object.values(ACHIEVEMENTS_CATALOG)) {
    if (ach.reward.badge) {
      index[ach.reward.badge] = {
        title:       ach.title,
        description: ach.description,
        rarity:      ach.rarity,
      };
    }
  }
  for (const col of Object.values(COLLECTIONS_CATALOG)) {
    if (col.reward.badge) {
      index[col.reward.badge] = {
        title:       col.title,
        description: col.description,
        rarity:      col.tier === 'GOLD' ? 'LEGENDARY' : col.tier === 'SILVER' ? 'EPIC' : 'RARE',
      };
    }
  }
  return index;
}

function buildOwnedBadges(userData: Record<string, any>): OwnedBadge[] {
  const unlocked = userData.progression?.unlockedItems ?? {};
  const rentals  = userData.progression?.badgeRentals  ?? {};
  const now      = Date.now();
  const achIndex = buildAchievementBadgeIndex();
  const owned: OwnedBadge[] = [];

  // ── Badges da loja ──
  // Dois regimes no mesmo laço: os de fragmentos são permanentes
  // e vivem em unlockedItems; os de cristais são aluguel e vivem
  // em badgeRentals. Sem este tratamento, os quatro de fragmentos
  // ficariam invisíveis — o laço de conquista abaixo só reconhece
  // ids que estão no índice dos catálogos de conquista.
  for (const def of Object.values(BADGES_CATALOG)) {
    const isPermanent = def.rentalDays === 0;
    const rentalDate  = rentals[def.id]?.toDate?.() ?? null;
    const ownsPermanent = unlocked[def.id] === true;

    if (isPermanent ? !ownsPermanent : !rentalDate) continue;

    owned.push({
      id:          def.id,
      title:       def.title,
      description: def.meaning,
      rarity:      def.rarity,
      source:      'SHOP',
      shape:       def.shape,
      coreColor:   def.coreColor,
      accentColor: def.accentColor,
      glowColor:   def.glowColor,
      motion:      def.motion,
      permanent:   isPermanent,
      expiresAt:   isPermanent ? null : rentalDate!.toISOString(),
      expired:     isPermanent ? false : rentalDate!.getTime() <= now,
    });
  }

  // ── Badges de conquista (permanentes) ──
  for (const [badgeId, meta] of Object.entries(achIndex)) {
    if (unlocked[badgeId] !== true) continue;
    // Um id presente nos dois catálogos entraria duas vezes na
    // lista. Não há colisão hoje; o guard protege adições futuras.
    if (BADGES_CATALOG[badgeId]) continue;

    owned.push({
      id:          badgeId,
      title:       meta.title,
      description: meta.description,
      rarity:      meta.rarity,
      source:      'ACHIEVEMENT',
      shape:       null,
      coreColor:   null,
      accentColor: null,
      glowColor:   null,
      motion:      null,
      permanent:   true,
      expiresAt:   null,
      expired:     false,
    });
  }

  return owned;
}

// ── 1. Equipar badge ──
export const equipBadge = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const { badgeId } = request.data as { badgeId: string | null };

    const userRef = db.collection('users').doc(uid);

    // null = desequipar. Caminho legítimo, sem validação de posse.
    if (badgeId === null) {
      await userRef.set({
        progression: { equippedBadge: null, equippedBadgeUntil: null },
      }, { merge: true });
      return { success: true, equippedBadge: null };
    }

    if (!badgeId) {
      throw new functions.HttpsError('invalid-argument', 'Badge inválido.');
    }

    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw new functions.HttpsError('not-found', 'Usuário não encontrado.');
    }

    const owned = buildOwnedBadges(userDoc.data() ?? {});
    const match = owned.find(b => b.id === badgeId);

    if (!match) {
      throw new functions.HttpsError('permission-denied', 'Você não possui este badge.');
    }
    if (match.expired) {
      throw new functions.HttpsError(
        'failed-precondition',
        'Este badge expirou. Adquira novamente na loja.'
      );
    }

    // Ver comentário equivalente em frames.ts: quem vê o perfil
    // alheio precisa da validade no próprio documento.
    // equippedBadgeRarity acompanha porque badges de CONQUISTA não
    // estão no catálogo da loja — sem a raridade, o visualizador
    // não saberia qual aparência desenhar.
    await userRef.set({
      progression: {
        equippedBadge:       badgeId,
        equippedBadgeAt:     FieldValue.serverTimestamp(),
        equippedBadgeRarity: match.rarity,
        equippedBadgeUntil:  match.permanent || !match.expiresAt
          ? null
          : admin.firestore.Timestamp.fromDate(new Date(match.expiresAt)),
      },
    }, { merge: true });

    return { success: true, equippedBadge: badgeId };
  }
);

// ── 2. Status — o que o usuário tem e o que está usando ──
export const getBadgesStatus = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const userDoc  = await db.collection('users').doc(uid).get();
    const userData = userDoc.data() ?? {};

    const owned = buildOwnedBadges(userData);
    let equipped: string | null = userData.progression?.equippedBadge ?? null;

    // Badge equipado que expirou sai sozinho, sem job agendado:
    // a limpeza acontece na primeira leitura depois do vencimento.
    if (equipped) {
      const active = owned.find(b => b.id === equipped && !b.expired);
      if (!active) {
        equipped = null;
        await db.collection('users').doc(uid).set({
          progression: { equippedBadge: null, equippedBadgeUntil: null },
        }, { merge: true });
      }
    }

    return {
      owned:         owned.filter(b => !b.expired),
      expired:       owned.filter(b =>  b.expired),
      equippedBadge: equipped,
    };
  }
);