// ============================================
// LUMINA — CARTA DO DESTINO CLOUD FUNCTION v5.1
// functions/src/engagement/destinyCard.ts
//
// REGRAS ANTIFRAUDE:
// 1. Nenhum dado sensível gerado client-side
// 2. Idempotência: uid + data — mesma carta o dia todo
// 3. serverTimestamp() obrigatório
// 4. Gratuito: 1 carta/dia | Premium (Galáxia Plus): 10/dia
// 5. Perfis selecionados server-side por compatibilidade real
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

interface DestinyProfile {
  uid:         string;
  name:        string;
  age:         number;
  photoURL:    string;
  city:        string;
  sintonia:    number; // % compatibilidade calculada server-side
  isPrimary:   boolean;
}

// Calcula score de compatibilidade simples server-side
function calcCompatibilidade(userA: any, userB: any): number {
  let score = 50;

  // Preferências de gênero
  if (userA.preferences?.includes(userB.gender)) score += 20;
  if (userB.preferences?.includes(userA.gender)) score += 10;

  // Faixa etária próxima
  const ageDiff = Math.abs((userA.age ?? 25) - (userB.age ?? 25));
  if (ageDiff <= 3)  score += 15;
  else if (ageDiff <= 7)  score += 8;
  else if (ageDiff <= 12) score += 3;

  // Mesma cidade
  if (userA.city && userB.city && userA.city === userB.city) score += 5;

  return Math.min(Math.max(score, 30), 99);
}

// ── Buscar Carta do Destino ──
export const getDestinyCard = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new functions.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const todayStr   = new Date().toISOString().slice(0, 10);
    const cardRef    = db.collection('destinyCards').doc(uid);
    const userRef    = db.collection('users').doc(uid);
    const walletRef  = db.collection('wallets').doc(uid);

    // Verifica se já existe carta para hoje (idempotência)
    const [cardDoc, userDoc, walletDoc] = await Promise.all([
      cardRef.get(),
      userRef.get(),
      walletRef.get(),
    ]);

    const cardData   = cardDoc.data() ?? {};
    const userData   = userDoc.data() ?? {};
    const walletData = walletDoc.data() ?? {};

    // Galáxia Plus = 10 cartas/dia, gratuito = 1
    const isGalaxiaPlus = walletData.galaxiaPlus?.ativo === true;
    const maxCartas     = isGalaxiaPlus ? 10 : 1;

    // Se já tem carta de hoje → retorna a mesma (idempotência)
    if (cardData.date === todayStr && cardData.profiles?.length > 0) {
      return {
        profiles:    cardData.profiles as DestinyProfile[],
        cartasHoje:  cardData.cartasHoje ?? 1,
        maxCartas,
        isGalaxiaPlus,
        fromCache:   true,
      };
    }

    // Limite diário atingido
    if (cardData.date === todayStr && (cardData.cartasHoje ?? 0) >= maxCartas) {
      throw new functions.HttpsError(
        'resource-exhausted',
        `Limite de ${maxCartas} carta(s) por dia atingido.`
      );
    }

    // Busca perfis compatíveis
    const preferences = userData.preferences ?? [];

    // Busca usuários do gênero preferido
    let query = db.collection('users')
      .where('uid', '!=', uid)
      .limit(50);

    if (preferences.length > 0) {
      query = query.where('gender', 'in', preferences) as any;
    }

    const usersSnap = await query.get();
    const candidates: DestinyProfile[] = [];

    for (const doc of usersSnap.docs) {
      const p = doc.data();
      if (!p.name || !p.age || !p.photoURL) continue;

      const sintonia = calcCompatibilidade(userData, p);
      if (sintonia < 60) continue; // só mostra compatibilidade relevante

      candidates.push({
        uid:       p.uid || doc.id,
        name:      p.name,
        age:       p.age,
        photoURL:  p.photoURL,
        city:      p.city ?? '',
        sintonia,
        isPrimary: false,
      });
    }

    // Ordena por compatibilidade e pega top 3
    candidates.sort((a, b) => b.sintonia - a.sintonia);
    const top3 = candidates.slice(0, 3);

    if (top3.length === 0) {
      throw new functions.HttpsError(
        'not-found',
        'Nenhum perfil compatível encontrado para hoje.'
      );
    }

    // Marca o principal
    top3[0].isPrimary = true;

    // Salva no Firestore (idempotência para o dia)
    await cardRef.set({
      uid,
      date:       todayStr,
      profiles:   top3,
      cartasHoje: FieldValue.increment(1),
      maxCartas,
      isGalaxiaPlus,
      createdAt:  FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      profiles: top3,
      cartasHoje: (cardData.cartasHoje ?? 0) + 1,
      maxCartas,
      isGalaxiaPlus,
      fromCache: false,
    };
  }
);

// ── Marcar carta como visualizada ──
export const markDestinyCardViewed = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new functions.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const cardRef = db.collection('destinyCards').doc(uid);
    await cardRef.set({
      visualizado: true,
      visualizadoAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { success: true };
  }
);