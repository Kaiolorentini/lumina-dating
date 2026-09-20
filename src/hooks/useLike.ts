// ============================================
// LUMINA — USE LIKE
// src/hooks/useLike.ts
//
// Curtida em um lugar só. O RealProfileScreen e o ProfileCard
// usam este hook; duplicar a lógica repetiria o erro que o
// comentário do RealProfileScreen registra — gravar direto em
// 'likes' pelo cliente fazia o MatchService NUNCA rodar, e a
// árvore jamais evoluía.
//
// A ordem importa: onCreateMatch PRIMEIRO, porque é ele quem
// grava a curtida e responde se ela é nova. Só então a
// gamificação derivada dispara, toda sob o mesmo guard.
// ============================================

import { useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { todayBrUnderscore } from '../utils/dateBr';

const functions = getFunctions();

// Genéricos em tipos nomeados: httpsCallable< em fim de linha
// é corrompido ao colar.
type CreateMatchReq = { targetUid: string };
type CreateMatchRes = { success: boolean; isMutual: boolean; alreadyLiked: boolean };

type ProfileLikeReq = { likerUid: string; targetUid: string };
type MissionReq     = { missionIdParam: string; targetUid?: string };

export interface LikeResult {
  ok:       boolean;
  isMutual: boolean;
}

function notifyMission(missionType: string, targetUid?: string): void {
  const missionId = `daily_${todayBrUnderscore()}_${missionType}`;
  const fn = httpsCallable<MissionReq, unknown>(functions, 'progressMission');
  fn({ missionIdParam: missionId, targetUid }).catch(() => { /* silencioso */ });
}

export function useLike(likerUid: string | undefined) {
  const [liking, setLiking] = useState(false);

  const like = useCallback(async (targetUid: string): Promise<LikeResult> => {
    if (!likerUid || liking) return { ok: false, isMutual: false };

    setLiking(true);
    try {
      const createMatch = httpsCallable<CreateMatchReq, CreateMatchRes>(
        functions,
        'onCreateMatch',
      );
      const result = await createMatch({ targetUid });

      // Toda a gamificação derivada fica sob o mesmo guard.
      // Antes, só o earnXP checava `alreadyLiked`: missão, cofre
      // e onProfileLike rodavam de novo a cada reentrada na tela,
      // furando o limite diário de fragmentos e inflando a missão
      // like_profiles.
      if (!result.data.alreadyLiked) {
        httpsCallable<ProfileLikeReq, unknown>(functions, 'onProfileLike')({
          likerUid,
          targetUid,
        }).catch(err => {
          console.warn('[useLike] onProfileLike falhou:', err);
        });

        notifyMission('like_profiles', targetUid);
      }

      return { ok: true, isMutual: result.data.isMutual };
    } catch (error) {
      console.error('[useLike] Falha ao curtir:', error);
      return { ok: false, isMutual: false };
    } finally {
      setLiking(false);
    }
  }, [likerUid, liking]);

  return { like, liking };
}