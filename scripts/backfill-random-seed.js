// ============================================
// LUMINA — PREENCHER randomSeed
// scripts/backfill-random-seed.js
//
// O campo passou a ser gravado na criação do perfil, mas as
// contas anteriores não o têm — e documentos SEM o campo são
// invisíveis para `orderBy('randomSeed')`. Sem este script,
// quem se cadastrou antes some do feed.
//
// Idempotente: só grava em quem ainda não tem.
//
// USO:
//   node scripts/backfill-random-seed.js
//
// Requer serviceAccountKey.json na raiz. APAGAR A CHAVE
// DEPOIS DE USAR.
// ============================================

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

async function main() {
  const snap = await db.collection('users').get();

  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const doc of snap.docs) {
    if (typeof doc.data().randomSeed === 'number') {
      skipped++;
      continue;
    }

    batch.update(doc.ref, { randomSeed: Math.random() });
    updated++;
    inBatch++;

    // O batch do Firestore aceita 500 operações.
    if (inBatch === 450) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
      console.log(`  ... ${updated} atualizados`);
    }
  }

  if (inBatch > 0) await batch.commit();

  console.log(`\nConcluído: ${updated} atualizados, ${skipped} já tinham.`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Falhou:', error);
  process.exit(1);
});
