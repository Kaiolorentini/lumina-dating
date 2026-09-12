const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  const paymentIds = ['pay_c6ssjguq4ovcg4rn', 'pay_s2ct87i4a495mx61'];
  const externalRefs = ['T5hGTfWRyLN0RCkXfzXw', 'vnviKc64w2vnBeqCyaQR'];

  for (const pid of paymentIds) {
    const q = await db.collection('sales').where('asaasPaymentId', '==', pid).get();
    console.log(`asaasPaymentId=${pid} -> ${q.size} sale(s)`);
  }

  for (const ref of externalRefs) {
    const doc = await db.collection('sales').doc(ref).get();
    console.log(`sales/${ref} existe? ${doc.exists}`);
    if (doc.exists) console.log('  campos:', JSON.stringify(doc.data(), null, 2));
  }

  console.log('\n--- Últimas 5 sales ---');
  const recent = await db.collection('sales').orderBy('createdAt', 'desc').limit(5).get();
  recent.docs.forEach(d => {
    const s = d.data();
    console.log(`${d.id} | type=${s.type} | status=${s.status} | asaasPaymentId=${s.asaasPaymentId} | amount=${s.amount}`);
  });
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
