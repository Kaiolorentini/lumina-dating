// ============================================
// LUMINA — PREENCHER randomSeed
// scripts/backfill-random-seed.js
//
// O campo passou a ser gravado na criação do perfil, mas as
// contas anteriores não o têm — e documentos SEM o campo são
// invisíveis para `orderBy('randomSeed')`. Sem este script,
// quem se cadastrou antes some do feed.
//
// Contas admin/superadmin NÃO entram no feed: não recebem seed
// e, se já tiverem um, ele é REMOVIDO. Sem seed, o documento
// fica fora das consultas por faixa (Home, Sintonize, Carta).
//
// Idempotente: rodar de novo não altera nada.
//
// USO:
//   node scripts/backfill-random-seed.js
//
// Requer serviceAccountKey.json na raiz. APAGAR A CHAVE
// DEPOIS DE USAR — no disco E no Google Cloud Console.
// ============================================

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

const STAFF_ROLES = ['admin', 'superadmin'];
const BATCH_LIMIT = 450; // o batch do Firestore aceita 500 operações

async function main() {
  const snap = await db.collection('users').get();

  let seeded = 0;
  let staffRemoved = 0;
  let skipped = 0;
  let batch = db.batch();
  let inBatch = 0;

  async function flushIfFull() {
    if (inBatch < BATCH_LIMIT) return;
    await batch.commit();
    batch = db.batch();
    inBatch = 0;
    console.log(`  ... ${seeded} com seed novo, ${staffRemoved} admins removidos do feed`);
  }

  for (const doc of snap.docs) {
    const data = doc.data();
    const isStaff = STAFF_ROLES.includes(data.role);

    if (isStaff) {
      if ('randomSeed' in data) {
        batch.update(doc.ref, { randomSeed: admin.firestore.FieldValue.delete() });
        staffRemoved++;
        inBatch++;
        await flushIfFull();
      } else {
        skipped++;
      }
      continue;
    }

    // Substitui também valor inválido (string, null) gravado
    // antes da validação das rules.
    if (typeof data.randomSeed === 'number') {
      skipped++;
      continue;
    }

    batch.update(doc.ref, { randomSeed: Math.random() });
    seeded++;
    inBatch++;
    await flushIfFull();
  }

  if (inBatch > 0) await batch.commit();

  console.log(
    `\nConcluído: ${seeded} com seed novo, ${staffRemoved} admins removidos do feed, ${skipped} sem alteração.`
  );
  process.exit(0);
}

main().catch((error) => {
  console.error('Falhou:', error);
  process.exit(1);
});