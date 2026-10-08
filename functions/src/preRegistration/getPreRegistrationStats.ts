// ============================================
// LUMINA — PRÉ-CADASTRO DA LANDING
// functions/src/preRegistration/getPreRegistrationStats.ts
//
// Contador público do Programa Criadores Fundadores.
// Servido em /api/stats por uma rewrite do Firebase Hosting (mesma
// origem do site, sem CORS). Devolve só números agregados — nenhum
// dado pessoal. Cache de 60 s na CDN do Hosting: milhares de visitas
// por minuto custam uma leitura no Firestore por minuto.
// ============================================

import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';
import { CREATOR_FOUNDER_COUNTER_PATH, CREATOR_FOUNDER_LIMIT } from '../config/preRegistration';

export const getPreRegistrationStats = onRequest({ maxInstances: 5 }, async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.set('Allow', 'GET, HEAD');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try {
    const snap = await getFirestore().doc(CREATOR_FOUNDER_COUNTER_PATH).get();
    const taken = Math.min(Math.max(0, Number(snap.get('count')) || 0), CREATOR_FOUNDER_LIMIT);

    res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.status(200).json({ creatorFounders: { taken, limit: CREATOR_FOUNDER_LIMIT } });
  } catch (err) {
    logger.error('[getPreRegistrationStats] falha ao ler o contador', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.set('Cache-Control', 'no-store');
    res.status(500).json({ error: 'unavailable' });
  }
});