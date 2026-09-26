// ============================================
// LUMINA — CONQUISTAS PÚBLICAS DE UM PERFIL
// functions/src/users/getPublicAchievements.ts
//
// O catálogo das conquistas vive só no backend, e duplicá-lo
// no cliente seria a terceira cópia de catálogo do projeto —
// as duas anteriores divergiram (preços e cosméticos).
//
// Devolve só as DESBLOQUEADAS: mostrar o que falta para outra
// pessoa não acrescenta nada e enche a tela.
//
// Conquistas ocultas (hidden) aparecem quando desbloqueadas —
// a máscara existe para não entregar o segredo de quem ainda
// não tem, e quem já tem exibe com orgulho.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated } from "../utils/adminGuard";
import { ACHIEVEMENTS_CATALOG } from "../config/achievementsCatalog";

const db = admin.firestore();

export const getPublicAchievements = onCall(
  { region: "us-central1" },
  async (request) => {
    assertAuthenticated(request.auth?.uid);

    const { userId } = (request.data ?? {}) as { userId?: string };

    if (!userId || typeof userId !== "string") {
      throw new HttpsError("invalid-argument", "userId obrigatório");
    }

    const snap = await db.collection("users").doc(userId).get();

    if (!snap.exists) {
      throw new HttpsError("not-found", "Perfil não encontrado");
    }

    const data = snap.data() ?? {};
    const unlocked: string[] = data.achievements?.unlocked ?? [];
    const unlockedAt: Record<string, admin.firestore.Timestamp> =
      data.achievements?.unlockedAt ?? {};

    const achievements = unlocked
      .map((id) => {
        const ach = ACHIEVEMENTS_CATALOG[id];
        if (!ach) return null;
        return {
          id:          ach.id,
          title:       ach.title,
          description: ach.description,
          icon:        ach.icon,
          category:    ach.category,
          rarity:      ach.rarity,
          unlockedAt:  unlockedAt[id]?.toDate?.()?.toISOString() ?? null,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    // Mais recentes primeiro — o que a pessoa conquistou por
    // último diz mais sobre ela agora.
    achievements.sort((a, b) => {
      if (!a.unlockedAt) return 1;
      if (!b.unlockedAt) return -1;
      return b.unlockedAt.localeCompare(a.unlockedAt);
    });

    return {
      achievements,
      totalUnlocked:  achievements.length,
      totalAvailable: Object.keys(ACHIEVEMENTS_CATALOG).length,
    };
  },
);