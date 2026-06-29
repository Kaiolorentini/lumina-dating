// ============================================
// LUMINA — EMOTIONAL TRIGGERS SERVICE v1.0
// functions/src/engagement/EmotionalTriggersService.ts
//
// RESPONSABILIDADE ÚNICA: lógica dos gatilhos emocionais.
// Separado do trigger do Firestore para facilitar testes.
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

function calcCompatibilidade(
  userA: Record<string, unknown>,
  userB: Record<string, unknown>
): number {
  let score = 50;
  const prefsA = userA.preferences as string[] | undefined;
  const prefsB = userB.preferences as string[] | undefined;
  if (prefsA?.includes(userB.gender as string)) score += 20;
  if (prefsB?.includes(userA.gender as string)) score += 10;
  const ageDiff = Math.abs(((userA.age as number) ?? 25) - ((userB.age as number) ?? 25));
  if (ageDiff <= 3) score += 15;
  else if (ageDiff <= 7) score += 8;
  else if (ageDiff <= 12) score += 3;
  if (userA.city && userA.city === userB.city) score += 5;
  return Math.min(Math.max(score, 30), 99);
}

async function criarNotificacao(
  userId:   string,
  tipo:     string,
  titulo:   string,
  mensagem: string,
  dados?:   Record<string, unknown>
): Promise<void> {
  await db.collection('notifications').add({
    userId, type: tipo, title: titulo, message: mensagem,
    read: false, dados: dados ?? {}, timestamp: FieldValue.serverTimestamp(),
  });
}

export const EmotionalTriggersService = {
  async runProfileVisitTriggers(visitorId: string, profileId: string): Promise<void> {
    const todayStr = new Date().toISOString().slice(0, 10);

    const [visitorDoc, profileDoc] = await Promise.all([
      db.collection('users').doc(visitorId).get(),
      db.collection('users').doc(profileId).get(),
    ]);

    if (!visitorDoc.exists || !profileDoc.exists) return;

    const sintonia   = calcCompatibilidade(profileDoc.data()!, visitorDoc.data()!);
    const controlRef = db.collection('triggerControl').doc(`${profileId}_${todayStr}`);
    const controlDoc = await controlRef.get();
    const control    = controlDoc.data() ?? {};

    // Quase Sintonia
    if (sintonia >= 85 && !control[`quase_${visitorId}`]) {
      await Promise.all([
        criarNotificacao(profileId, 'quase_sintonia', '💜 Quase Sintonia',
          `Alguém com ${sintonia}% de compatibilidade viu seu perfil!`,
          { visitorId, sintonia, borrado: true }),
        controlRef.set({ [`quase_${visitorId}`]: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
      ]);
    }

    // Pensou em Você
    const visitCountKey = `visits_${visitorId}`;
    const newCount      = (control[visitCountKey] ?? 0) + 1;
    await controlRef.set({ [visitCountKey]: newCount, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (newCount === 3) {
      await criarNotificacao(profileId, 'pensou_em_voce', '✨ Pensou em Você',
        'Alguém visitou seu perfil 3 vezes hoje.',
        { visitorId, sintonia, borrado: true });
    }

    // Sintonia Perdida (pendente)
    const perdidaKey = `perdida_${visitorId}`;
    if (!control[perdidaKey] && (control.perdidaCount ?? 0) < 3) {
      await db.collection('pendingLostSintonia').add({
        profileId, visitorId, sintonia,
        visitTime:  FieldValue.serverTimestamp(),
        checkAfter: new Date(Date.now() + 24 * 3600000),
        processed:  false, date: todayStr,
      });
    }
  },
};
