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
//
// 13/10/2026: a falha devolve `message` — o texto do servidor quando
// ele explica (limite diário de curtidas, perfil indisponível) ou
// uma frase amigável. O ProfileCard mostra esse texto.
//
// 13/10/2026 (web D5): a resposta do servidor traz likesToday/likeLimit
// e o hook repassa ao contador "Curtidas hoje x/150" (likeQuota).
// Limite atingido marca a cota cheia. Nada muda no fluxo da curtida.
// ============================================

import { useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { friendlyErrorMessage } from '../utils/firebaseErrorMessage';
import { setLikeQuota, markLikeQuotaFull } from '../services/likeQuota';


const functions = getFunctions();

// Genéricos em tipos nomeados: httpsCallable< em fim de linha
// é corrompido ao colar.
type CreateMatchReq = { targetUid: string };
type CreateMatchRes = {
  success: boolean;
  isMutual: boolean;
  alreadyLiked: boolean;
  /** Servidor v2.2+: curtidas novas usadas hoje e o limite. */
  likesToday?: number;
  likeLimit?: number;
};

type ProfileLikeReq = { likerUid: string; targetUid: string };


export interface LikeResult {
  ok:       boolean;
  isMutual: boolean;
  /** Só na falha: o que mostrar para a pessoa. */
  message?: string;
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
      setLikeQuota(likerUid, result.data.likesToday, result.data.likeLimit);

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

        // Missão "Curtir 3 perfis": registrada pelo onCreateMatch,
        // no servidor, quando a curtida é nova.
      }

      return { ok: true, isMutual: result.data.isMutual };
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'functions/resource-exhausted') markLikeQuotaFull(likerUid);
      return { ok: false, isMutual: false, message: friendlyErrorMessage(error, 'like') };
    } finally {
      setLiking(false);
    }
  }, [likerUid, liking]);

  return { like, liking };
}

