// ============================================
// LUMINA — DESCARTE DAS IMAGENS
// functions/src/verification/deleteVerificationImages.ts
//
// Chamado na aprovação E na rejeição. Documento de
// identidade e biometria facial guardados indefinidamente
// são passivo, não ativo: se houver vazamento, o dano é
// proporcional ao que ainda está armazenado.
//
// Roda DEPOIS do commit da transação, nunca dentro: o
// Storage não participa de transação do Firestore, e uma
// falha ao apagar não pode desfazer uma aprovação válida.
//
// Falha é registrada e tolerada — a decisão já está
// gravada, e o retryDeleteOrphans varre o que sobrou.
// ============================================

import * as admin from "firebase-admin";
import { REQUIRED_FILES, storagePathFor } from "./constants";

export interface DeleteResult {
  deleted: number;
  failed: string[];
}

export async function deleteVerificationImages(uid: string): Promise<DeleteResult> {
  const bucket = admin.storage().bucket();
  const failed: string[] = [];
  let deleted = 0;

  await Promise.all(
    REQUIRED_FILES.map(async (file) => {
      const path = storagePathFor(uid, file);
      try {
        // ignoreNotFound: reprocessar uma decisão não deve
        // falhar só porque as imagens já foram apagadas.
        await bucket.file(path).delete({ ignoreNotFound: true });
        deleted++;
      } catch (error) {
        console.error(`[deleteVerificationImages] Falhou: ${path}`, error);
        failed.push(path);
      }
    }),
  );

  console.log(`[deleteVerificationImages] ${uid}: ${deleted} apagadas, ${failed.length} falhas`);

  return { deleted, failed };
}