// ============================================
// LUMINA — ACEITE DOS TERMOS
// functions/src/users/acceptAppTerms.ts
//
// Primeiro passo do onboarding: acontece ANTES do
// perfil existir (LGPD — consentimento antes da
// coleta de dados). Por isso a CF pode CRIAR o
// documento users, semeando role e isBlocked.
//
// Por que semear aqui: o saveProfile do cliente só
// adiciona role/isBlocked quando o documento NÃO
// existe. Como este aceite cria o documento antes,
// aquela condição nunca seria verdadeira e a conta
// ficaria sem os dois campos para sempre.
//
// São DOIS consentimentos separados, não um só:
// os Termos são contrato; a Política envolve
// documento de identidade e biometria facial, que
// a LGPD trata como dado sensível e exige
// consentimento específico e destacado (art. 11).
//
// O histórico em termsAcceptances é a PROVA de
// consentimento. Diferente do auditLog, a falha
// aqui NÃO é silenciosa: grava os dois ou nenhum.
// ============================================

import { onCall, HttpsError, Request } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated } from "../utils/adminGuard";
import { APP_TERMS_VERSION } from "../config/terms";

interface AcceptTermsPayload {
  /** Versão exibida ao usuário. Precisa ser a vigente. */
  version: string;
  /** Aceite do contrato de uso. */
  acceptedTerms: boolean;
  /** Consentimento específico para dado sensível (documento + selfie). */
  acceptedPrivacy: boolean;
}

interface AcceptTermsResult {
  success: boolean;
  version: string;
}

function extractIp(req: Request | undefined): string {
  if (!req) return "unknown";
  const forwarded = (req.headers["x-forwarded-for"] as string)
    ?.split(",")[0]
    ?.trim();
  return forwarded ?? req.ip ?? "unknown";
}

export const acceptAppTerms = onCall<AcceptTermsPayload, Promise<AcceptTermsResult>>(
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const uid: string = request.auth!.uid;

    const { version, acceptedTerms, acceptedPrivacy } = request.data ?? {};

    if (typeof version !== "string" || version !== APP_TERMS_VERSION) {
      // Cliente desatualizado exibiu um texto antigo: registrar
      // esse aceite seria uma prova falsa.
      throw new HttpsError(
        "failed-precondition",
        "Versão dos termos desatualizada. Atualize o aplicativo.",
      );
    }

    if (acceptedTerms !== true || acceptedPrivacy !== true) {
      throw new HttpsError(
        "invalid-argument",
        "É necessário aceitar os Termos de Uso e a Política de Privacidade.",
      );
    }

    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);

    // Id = versão: reaceitar a mesma versão sobrescreve o
    // próprio registro em vez de empilhar duplicatas, e cada
    // versão guarda sua própria prova.
    const historyRef = db
      .collection("termsAcceptances")
      .doc(uid)
      .collection("history")
      .doc(version);

    const ip = extractIp(request.rawRequest);
    const userAgent = (request.rawRequest?.headers["user-agent"] as string) ?? "unknown";
    const now = admin.firestore.FieldValue.serverTimestamp();

    const userSnap = await userRef.get();

    const userPatch: Record<string, unknown> = {
      acceptedAppTermsVersion: version,
      acceptedAppTermsAt: now,
    };

    // Documento inexistente: este é o primeiro write da conta.
    // Semeia os campos que o saveProfile deixaria de fora.
    if (!userSnap.exists) {
      userPatch.uid = uid;
      userPatch.role = "user";
      userPatch.isBlocked = false;
      userPatch.createdAt = now;
    }

    // Batch: o campo no usuário e a prova de consentimento
    // entram juntos ou não entram. Sem isto, uma falha no
    // histórico deixaria o aceite registrado sem prova.
    const batch = db.batch();
    batch.set(userRef, userPatch, { merge: true });
    batch.set(historyRef, {
      uid,
      version,
      acceptedTerms: true,
      acceptedPrivacy: true,
      ip,
      userAgent,
      acceptedAt: now,
    });

    await batch.commit();

    console.log(`[acceptAppTerms] Aceite registrado: ${uid} — versão ${version}`);

    return { success: true, version };
  }
);