// ============================================
// LUMINA — LIMPEZA DE CPF EM users/
// scripts/cleanup-cpf.js
//
// Remove o campo `cpf` de todos os documentos de `users`.
//
// MOTIVO: firestore.rules permite `allow list` em users
// (necessário para o feed da Home), o que tornava o CPF de
// toda a base legível por qualquer conta autenticada.
// Desde a v5.4 o CPF é pedido no checkout e enviado direto
// ao Asaas, sem passar pelo Firestore — o campo armazenado
// não tem mais função e é risco puro.
// LGPD, minimização (Art. 6º, III) e eliminação (Art. 16).
//
// USO:
//   node scripts/cleanup-cpf.js --dry-run   (só conta)
//   node scripts/cleanup-cpf.js             (apaga)
// ============================================

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 400; // limite do Firestore é 500

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN — nada será apagado ===' : '=== APAGANDO campo cpf ===');

  const snapshot = await db.collection('users').get();
  console.log(`Documentos em users: ${snapshot.size}`);

  const withCpf = snapshot.docs.filter(d => d.data().cpf !== undefined);
  console.log(`Documentos com campo cpf: ${withCpf.length}`);

  if (withCpf.length === 0) {
    console.log('Nada a fazer.');
    return;
  }

  if (DRY_RUN) {
    console.log('Dry run concluído. Rode sem --dry-run para apagar.');
    return;
  }

  let processed = 0;
  for (let i = 0; i < withCpf.length; i += BATCH_SIZE) {
    const chunk = withCpf.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    chunk.forEach(doc => {
      batch.update(doc.ref, { cpf: admin.firestore.FieldValue.delete() });
    });

    await batch.commit();
    processed += chunk.length;
    console.log(`  ${processed}/${withCpf.length}`);
  }

  console.log(`Concluído. ${processed} documentos limpos.`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('ERRO:', err);
    process.exit(1);
  });