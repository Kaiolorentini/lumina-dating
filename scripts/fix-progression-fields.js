// ============================================
// LUMINA — MIGRAÇÃO DE CAMPOS progression.*
// scripts/fix-progression-fields.js
//
// Move campos LITERAIS (nome contendo pontos, criados por
// t.set() com chave "a.b.c") para o caminho aninhado correto,
// e remove o literal.
//
// ATENÇÃO: para apagar um campo cujo NOME contém pontos é
// obrigatório FieldPath. Passar a string crua ao update() faz
// o Firestore tratá-la como caminho aninhado — apagando o
// campo certo em vez do lixo.
//
// USO:
//   node scripts/fix-progression-fields.js --dry-run
//   node scripts/fix-progression-fields.js
// ============================================

const admin = require('firebase-admin');
const { FieldPath, FieldValue, Timestamp } = require('firebase-admin/firestore');
admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
const db = admin.firestore();
const DRY_RUN = process.argv.includes('--dry-run');

function nest(path, value) {
  const parts = path.split('.');
  const root = {};
  let cur = root;
  parts.forEach((p, i) => {
    if (i === parts.length - 1) cur[p] = value;
    else { cur[p] = {}; cur = cur[p]; }
  });
  return root;
}

function deepMerge(target, source) {
  for (const k of Object.keys(source)) {
    const v = source[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Timestamp)) {
      target[k] = deepMerge(target[k] ?? {}, v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

function fixKey(path) {
  return path.replace('unlockedItems.badge_badge_', 'unlockedItems.badge_');
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== APLICANDO ===');

  const snap = await db.collection('users').get();
  let touched = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const literals = Object.keys(data).filter(k => k.startsWith('progression.'));
    if (literals.length === 0) continue;

    let merged = {};
    literals.forEach(k => { merged = deepMerge(merged, nest(fixKey(k), data[k])); });

    console.log(`\n${doc.id}`);
    literals.forEach(k => console.log(`  ${k}  ->  ${fixKey(k)}`));

    if (DRY_RUN) { touched++; continue; }

    // 1. Remove os literais PRIMEIRO, um a um, via FieldPath.
    //    Fazer isso antes evita que a remoção apague o aninhado.
    for (const k of literals) {
      await doc.ref.update(new FieldPath(k), FieldValue.delete());
    }

    // 2. Só então grava o aninhado.
    await doc.ref.set(merged, { merge: true });

    touched++;
  }

  console.log(`\n${DRY_RUN ? 'Seriam alterados' : 'Alterados'}: ${touched} documento(s).`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });