// ============================================
// LUMINA — RESET PARA TESTES
// scripts/reset-firestore.js
//
// Apaga TODAS as coleções do Firestore e TODOS os arquivos
// do Storage, exceto:
//   - appSettings (adminConfig e config) — INTOCADO
//   - users/{uid} dos dois superadmins, reduzidos ao
//     essencial (role, isBlocked e perfil)
//
// IRREVERSÍVEL. Exige digitar o nome do projeto para rodar.
//
// Uso:
//   node scripts/reset-firestore.js
// ============================================

const admin = require('firebase-admin');
const readline = require('readline');
const serviceAccount = require('../serviceAccountKey.json');

const PROJECT_ID = 'lumina-ff667';

// Uids preservados. Documento reduzido ao essencial:
// progressão, XP, conquistas e carteira são zerados para
// os testes de gamificação começarem do zero.
const KEEP_UIDS = [
  'DOoEhA9B2QZfTnJrIBJIUhNjuC23',
  '8DyoecyZiuP0wvCDo09WekJkVkH3',
];

// NUNCA apagar: o adminConfig.superAdmins é metade da
// validação de superadmin (a outra é o role no users).
// Perder isso tranca o painel sem recuperação pelo app.
const PROTECTED_COLLECTIONS = ['appSettings'];

// Campos que sobrevivem no documento dos admins.
const KEEP_FIELDS = [
  'uid', 'email', 'name', 'age', 'city', 'state',
  'regiaoId', 'estadoId', 'gender', 'preferences', 'bio',
  'role', 'isBlocked', 'createdAt', 'pushToken',
];

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'lumina-ff667.firebasestorage.app',
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Apaga uma coleção em lotes, recursivamente (inclui
 * subcoleções). O recursiveDelete do Admin SDK faz isso,
 * mas documento por documento para podermos preservar os
 * dos admins.
 */
async function deleteDocRecursive(docRef) {
  const subcollections = await docRef.listCollections();
  for (const sub of subcollections) {
    await deleteCollection(sub);
  }
  await docRef.delete();
}

async function deleteCollection(collectionRef, keepUids = []) {
  let deleted = 0;
  let kept = 0;

  while (true) {
    const snap = await collectionRef.limit(200).get();
    if (snap.empty) break;

    let progressed = false;

    for (const doc of snap.docs) {
      if (keepUids.includes(doc.id)) {
        kept++;
        continue;
      }
      await deleteDocRecursive(doc.ref);
      deleted++;
      progressed = true;
    }

    // Sem isto, uma coleção que só tem documentos
    // preservados entraria em loop infinito.
    if (!progressed) break;
  }

  return { deleted, kept };
}

/** Reduz o documento do admin aos campos essenciais. */
async function trimAdminDoc(uid) {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    console.log(`  ⚠️  ${uid}: documento não existe — nada a reduzir`);
    return;
  }

  const data = snap.data();
  const removed = [];
  const patch = {};

  // Só campos de PRIMEIRO NÍVEL: o Firestore recusa um update
  // que cite 'xp' e 'xp.algo' no mesmo patch ("specified
  // multiple times"). Apagar o campo raiz já leva o objeto
  // inteiro junto.
  for (const key of Object.keys(data)) {
    if (KEEP_FIELDS.includes(key)) continue;
    if (key.includes('.')) continue;
    patch[key] = admin.firestore.FieldValue.delete();
    removed.push(key);
  }

  // A foto vai junto com o Storage: manter photoURL
  // apontando para arquivo apagado exibiria imagem quebrada.
  if (data.photoURL) {
    patch.photoURL = admin.firestore.FieldValue.delete();
    removed.push('photoURL');
  }

  // Subcoleções do usuário (transactions) também saem.
  const subs = await ref.listCollections();
  for (const sub of subs) {
    const result = await deleteCollection(sub);
    console.log(`  ${uid}/${sub.id}: ${result.deleted} apagados`);
  }

  if (removed.length > 0) {
    await ref.update(patch);
  }

  console.log(`  ✅ ${uid}: role=${data.role}, ${removed.length} campos removidos`);
  if (removed.length > 0) {
    console.log(`     ${removed.join(', ')}`);
  }
}

async function wipeStorage() {
  const [files] = await bucket.getFiles();
  if (files.length === 0) {
    console.log('  Storage já está vazio');
    return;
  }

  let deleted = 0;
  for (const file of files) {
    try {
      await file.delete();
      deleted++;
    } catch (error) {
      console.log(`  ⚠️  Falhou: ${file.name} — ${error.message}`);
    }
  }
  console.log(`  ✅ ${deleted} de ${files.length} arquivos apagados`);
}

async function main() {
  console.log('');
  console.log('============================================');
  console.log('  RESET DO FIRESTORE E STORAGE — LUMINA');
  console.log('============================================');
  console.log('');
  console.log(`Projeto:    ${PROJECT_ID}`);
  console.log(`Preservar:  appSettings (intocado)`);
  console.log(`            users/${KEEP_UIDS[0]}`);
  console.log(`            users/${KEEP_UIDS[1]}`);
  console.log(`            (reduzidos aos campos essenciais)`);
  console.log('');
  console.log('APAGA: todas as outras coleções, subcoleções');
  console.log('       e TODOS os arquivos do Storage.');
  console.log('');
  console.log('ISTO É IRREVERSÍVEL.');
  console.log('');

  const answer = await ask(`Digite "${PROJECT_ID}" para confirmar: `);
  if (answer !== PROJECT_ID) {
    console.log('\nCancelado — nada foi apagado.\n');
    process.exit(0);
  }

  console.log('\n--- FIRESTORE ---\n');

  const collections = await db.listCollections();
  console.log(`${collections.length} coleções encontradas\n`);

  for (const col of collections) {
    if (PROTECTED_COLLECTIONS.includes(col.id)) {
      console.log(`🔒 ${col.id}: PROTEGIDA, intocada`);
      continue;
    }

    if (col.id === 'users') {
      const result = await deleteCollection(col, KEEP_UIDS);
      console.log(`📁 users: ${result.deleted} apagados, ${result.kept} preservados`);
      continue;
    }

    const result = await deleteCollection(col);
    console.log(`📁 ${col.id}: ${result.deleted} apagados`);
  }

  console.log('\n--- DOCUMENTOS DOS ADMINS ---\n');
  for (const uid of KEEP_UIDS) {
    await trimAdminDoc(uid);
  }

  console.log('\n--- STORAGE ---\n');
  await wipeStorage();

  console.log('\n============================================');
  console.log('  CONCLUÍDO');
  console.log('============================================');
  console.log('');
  console.log('Próximos passos:');
  console.log('  1. Abra o app com uma conta de admin');
  console.log('  2. A carteira é recriada pelo initWallet');
  console.log('  3. Coloque a foto de perfil de novo');
  console.log('  4. Confira que o painel admin abre');
  console.log('');

  process.exit(0);
}

main().catch(error => {
  console.error('\n❌ ERRO:', error);
  process.exit(1);
});