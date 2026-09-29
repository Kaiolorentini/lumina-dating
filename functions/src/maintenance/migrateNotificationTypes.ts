// ============================================
// LUMINA — MIGRAÇÃO ÚNICA: TIPOS DE NOTIFICAÇÃO
// functions/src/maintenance/migrateNotificationTypes.ts
//
// Até 28/09 o webhook enviava venda, compra e avisos de admin com o
// tipo 'promocao', que abre a loja de cristais. Esta migração passa
// as notificações ANTIGAS para o tipo certo, identificando cada uma
// pela frase fixa do texto.
//
// Execução: forçar uma vez no Cloud Scheduler, conferir o log e
// APAGAR a função (remover o export e rodar functions:delete).
// O agendamento anual é só para existir no Scheduler.
// Rodar de novo é inofensivo: só lê o que ainda é 'promocao'.
// ============================================

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { FieldPath } from 'firebase-admin/firestore';

const PAGE = 400;

const RULES: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /foi vendido!/,                     type: 'sale_completed' },
  { pattern: /disponível na sua biblioteca/,     type: 'purchase_confirmed' },
  { pattern: /revertidos .* dívida/,             type: 'fraud_flag' },
  { pattern: /seller: |— uid: |pago R\$ .* esperado R\$|a ativação falhou/, type: 'admin_sale' },
];

function classify(message: string): string | null {
  return RULES.find(r => r.pattern.test(message))?.type ?? null;
}

export const migrateNotificationTypes = onSchedule(
  { schedule: '0 5 1 1 *', timeZone: 'America/Sao_Paulo', region: 'us-central1' },
  async () => {
    const db = admin.firestore();
    const counts: Record<string, number> = {};
    let read = 0;
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    for (;;) {
      let q = db.collection('notifications')
        .where('type', '==', 'promocao')
        .orderBy(FieldPath.documentId())
        .limit(PAGE);
      if (cursor) q = q.startAfter(cursor);

      const snap = await q.get();
      if (snap.empty) break;
      read += snap.size;

      const batch = db.batch();
      let changed = 0;
      snap.docs.forEach(doc => {
        const next = classify(String(doc.data().message ?? ''));
        if (!next) return;
        batch.update(doc.ref, { type: next, migratedFrom: 'promocao' });
        counts[next] = (counts[next] ?? 0) + 1;
        changed++;
      });
      if (changed > 0) await batch.commit();

      cursor = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE) break;
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`[migrateNotificationTypes] Lidas ${read} 'promocao' | Migradas ${total}:`, JSON.stringify(counts));
  },
);