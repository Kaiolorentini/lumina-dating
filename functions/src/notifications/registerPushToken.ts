// ============================================
// LUMINA — REGISTRO DO TOKEN DE PUSH
// functions/src/notifications/registerPushToken.ts
//
// O cliente não grava mais o token direto no documento: o
// campo users/{uid}.pushToken virou protegido nas rules,
// porque a coleção tem `allow list` aberto e qualquer conta
// logada lia o token de todo mundo.
//
// Aqui o token vai para users/{uid}/private/push, fechado
// nos dois sentidos. Só o Admin SDK acessa.
//
// Sem genérico no onCall: `onCall<` quebrado em duas linhas
// é lido como operador de comparação e o arquivo inteiro
// deixa de compilar. O padrão do projeto é validar o data em
// runtime, como o blockUser faz.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAuthenticated } from "../utils/adminGuard";
import { savePushToken } from "../utils/pushTokens";

// Formato do Expo: ExponentPushToken[xxxxxxxx] ou ExpoPushToken[...].
// Validar evita gravar lixo que só falharia no envio.
const EXPO_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export const registerPushToken = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  const { token } = (request.data ?? {}) as { token?: string };

  if (!token || typeof token !== "string") {
    throw new HttpsError("invalid-argument", "token obrigatório");
  }

  if (!EXPO_TOKEN_PATTERN.test(token)) {
    throw new HttpsError("invalid-argument", "Formato de token inválido");
  }

  await savePushToken(uid, token);

  console.log(`[registerPushToken] Token registrado para ${uid}`);

  return { success: true };
});