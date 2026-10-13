// ============================================
// LUMINA — AUDITORIA DE CAMPOS SENSÍVEIS NO users
// functions/src/users/userFieldsAudit.ts
//
// 13/10/2026 (backlog item 6). O tipo UserProfile do app tinha um
// campo `cpf?`. As regras (lista branca A4) já impedem o app de
// gravar CPF desde 08/10, mas documentos antigos podem ter ficado com
// ele — dado sensível guardado sem necessidade (LGPD art. 6º III,
// necessidade). Esta tarefa conta e, se pedido, APAGA o campo.
//
// Rodada pelo Console: adminJobs/{id} com
//   { type: "auditUserFields" }                    → só conta
//   { type: "auditUserFields", removeCpf: true }   → conta e apaga
// O resultado vai para o próprio documento do job (sem o valor do
// CPF — só os uids, para conferência).
// ============================================

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/** Campos que nunca deveriam estar no users. */
const SENSITIVE_FIELDS = ['cpf', 'rg', 'documentNumber', 'cnh'] as const;

const PAGE = 300;
const MAX_UIDS_IN_REPORT = 50;

export interface UserFieldsAuditResult {
  scanned: number;
  found: Record<string, number>;
  uids: string[];
  removed: number;
}

export async function runUserFieldsAudit(removeSensitive: boolean): Promise<UserFieldsAuditResult> {
  const db = admin.firestore();
  const found: Record<string, number> = {};
  const uids: string[] = [];
  let scanned = 0;
  let removed = 0;
  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let query = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
    if (last) query = query.startAfter(last);
    const page = await query.get();
    if (page.empty) break;

    const batch = db.batch();
    let pending = 0;

    for (const doc of page.docs) {
      scanned++;
      const data = doc.data();
      const present = SENSITIVE_FIELDS.filter(field => field in data);
      if (present.length === 0) continue;

      present.forEach(field => { found[field] = (found[field] ?? 0) + 1; });
      if (uids.length < MAX_UIDS_IN_REPORT) uids.push(doc.id);

      if (removeSensitive) {
        const patch: Record<string, FirebaseFirestore.FieldValue> = {};
        present.forEach(field => { patch[field] = FieldValue.delete(); });
        batch.update(doc.ref, patch);
        pending++;
        removed++;
      }
    }

    if (pending > 0) await batch.commit();
    last = page.docs[page.docs.length - 1];
    if (page.size < PAGE) break;
  }

  console.log('[userFieldsAudit]', JSON.stringify({ scanned, found, removed }));
  return { scanned, found, uids, removed };
}
