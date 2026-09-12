// scripts/backfill-snapshot.js
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
const db = admin.firestore();

const DATE = process.argv[2]; // node scripts/backfill-snapshot.js 2026-09-12

function startOfDay(d) { return admin.firestore.Timestamp.fromDate(new Date(`${d}T00:00:00-03:00`)); }
function endOfDay(d)   { return admin.firestore.Timestamp.fromDate(new Date(`${d}T23:59:59.999-03:00`)); }

async function main() {
  if (!DATE) { console.error('Uso: node scripts/backfill-snapshot.js YYYY-MM-DD'); process.exit(1); }

  const logs = await db.collection('walletAuditLogs')
    .where('createdAt', '>=', startOfDay(DATE))
    .where('createdAt', '<=', endOfDay(DATE))
    .get();

  let cg = 0, cp = 0, spent = 0, purchased = 0;
  const users = new Set(), sources = {}, sinks = {};

  logs.forEach(doc => {
    const d = doc.data();
    const val = Math.abs(d.valor ?? 0);
    const tipo = d.tipo ?? 'DESCONHECIDO';
    if (d.uid) users.add(d.uid);
    if (d.valor > 0) {
      if (tipo === 'COMPRA_ASAAS' || tipo === 'GALAXIA_PLUS_MENSAL') { cp += val; purchased += val; }
      else cg += val;
      sources[tipo] = (sources[tipo] ?? 0) + val;
    } else if (d.valor < 0) {
      spent += val;
      sinks[tipo] = (sinks[tipo] ?? 0) + val;
    }
  });

  let newWallets = 0;
  try {
    const w = await db.collection('wallets')
      .where('createdAt', '>=', startOfDay(DATE))
      .where('createdAt', '<=', endOfDay(DATE)).count().get();
    newWallets = w.data().count;
  } catch {}

  const created = cg + cp;
  const ratio = created > 0 ? spent / created : 0;

  const snapshot = {
    date: DATE,
    cristaisCreatedGratuitos: cg,
    cristaisCreatedPremium: cp,
    cristaisSpent: spent,
    cristaisPurchased: purchased,
    netFlow: spent - created,
    ratioSpentToCreated: Math.round(ratio * 100) / 100,
    activeUsers: users.size,
    totalTransactions: logs.size,
    newWallets,
    topSources: sources,
    topSinks: sinks,
    alertSent: false,
  };

  await db.collection('economySnapshots').doc(DATE).set(snapshot);
  console.log(`${DATE} | criado: ${created} | gasto: ${spent} | tx: ${logs.size}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });