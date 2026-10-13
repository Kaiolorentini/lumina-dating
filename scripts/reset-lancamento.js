// ============================================
// LUMINA — LIMPEZA PARA O LANÇAMENTO PÚBLICO
// scripts/reset-lancamento.js
//
// Substitui o scripts/reset-firestore.js (11/10/2026). Zera os
// dados de teste antes de abrir o app ao público, e zera junto a
// contagem de Fundadores (app e landing).
//
// ── O QUE FICA (travado no código) ──
//   • appSettings, internalConfig, systemConfig — configuração e
//     lista de superadmins. Perder internalConfig/admins tranca o
//     painel admin sem recuperação pelo app.
//   • processedWebhooks — o Asaas já está em produção: sem esta
//     coleção um reenvio antigo do Asaas seria processado de novo.
//   • As 2 contas de KEEP_UIDS: login (Auth, com as claims),
//     users/{uid} reduzido a KEEP_USER_FIELDS, termsAcceptances e
//     ageVerifications delas, e os arquivos de verificação de idade
//     delas no Storage (o documento de verificação aponta para eles).
//   • Outros documentos de counters que não sejam de Fundador.
//   • Qualquer coleção que este script NÃO conhece: é só listada,
//     nunca apagada. Você decide depois.
//
// ── O QUE SAI ──
//   • Todos os logins do Auth, menos KEEP_UIDS (inclui os
//     pré-cadastros de teste da landing).
//   • As coleções de DELETE_ORDER (com subcoleções).
//   • users, termsAcceptances e ageVerifications das outras contas.
//   • counters/founders e counters/creatorFounders → Fundadores do
//     app e da landing voltam a 0.
//   • No users das contas mantidas: tudo fora de KEEP_USER_FIELDS
//     (XP, conquistas, carteira espelhada, galeria, photoURL,
//     founderNumber...), inclusive campos com ponto no nome, e
//     todas as subcoleções (o token de push volta sozinho quando o
//     app abre — registerPushToken).
//   • Storage inteiro, menos age_verification/{KEEP_UIDS}/ e o
//     backup em firestore-backups/.
//
// ── COMO RODA ──
//   node scripts/reset-lancamento.js              → SIMULAÇÃO (não grava)
//   node scripts/reset-lancamento.js --executar   → apaga de verdade,
//        depois de digitar a frase de confirmação
//
// Os gatilhos das Cloud Functions reagem às exclusões e podem
// recriar alguns documentos (creatorStats, chatAccess, métricas).
// Por isso a execução faz até 3 passadas, com 60 s entre elas, até
// não sobrar nada. O relatório final fica em scripts/reset-relatorios/.
//
// IRREVERSÍVEL. Faça o export do Firestore ANTES (ver instruções).
//
// ── CHAVE DE SERVIÇO (temporária) ──
// O script lê serviceAccountKey.json na RAIZ do projeto. Gere a chave
// só na hora do reset e APAGUE logo depois — no disco E no Console
// (Google Cloud → IAM → Contas de serviço → Chaves). O script lembra
// disso no final, mesmo se der erro.
//
// ── 13/10/2026 ── coleções novas reconhecidas:
//   • publicProfiles  → uma por conta (fica só a das contas mantidas;
//                       o gatilho regrava a partir do users reduzido)
//   • dailyLikeCounts, adminJobs, moderationRecords,
//     creatorAgreements (com o histórico) → apagadas
// ============================================

'use strict';

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');
const admin    = require('firebase-admin');
const { FieldPath, FieldValue } = require('firebase-admin/firestore');

const PROJECT_ID     = 'lumina-ff667';
const STORAGE_BUCKET = 'lumina-ff667.firebasestorage.app';
const KEY_PATH       = path.join(__dirname, '..', 'serviceAccountKey.json');
const CONFIRM_PHRASE = 'ZERAR LUMINA lumina-ff667';
const EXECUTE        = process.argv.includes('--executar');

const MAX_PASSES      = 3;
const PASS_WAIT_MS    = 60 * 1000;
const AUTH_PAGE       = 1000;

// Contas mantidas (decisão de Kaio, 11/10/2026: as duas).
const KEEP_UIDS = Object.freeze([
  'DOoEhA9B2QZfTnJrIBJIUhNjuC23',
  '8DyoecyZiuP0wvCDo09WekJkVkH3',
]);

// Nunca apagadas — nem com erro de configuração abaixo.
const PROTECTED_COLLECTIONS = Object.freeze(new Set([
  'appSettings',
  'internalConfig',
  'systemConfig',
  'processedWebhooks',
]));

// Coleções com um documento por conta: ficam só os de KEEP_UIDS.
const PER_ACCOUNT_COLLECTIONS = Object.freeze(new Set([
  'users',
  'termsAcceptances',
  'ageVerifications',
  // Espelho público do users (13/10/2026).
  'publicProfiles',
]));

// Só estes documentos de counters saem (Fundadores, item C).
const FOUNDER_COUNTER_DOCS = Object.freeze(['founders', 'creatorFounders']);

// Campos que ficam em users/{uid} das contas mantidas.
// Identidade + papel + termos aceitos + verificação de idade.
const KEEP_USER_FIELDS = Object.freeze(new Set([
  'uid', 'email', 'name', 'age', 'city', 'state', 'regiaoId', 'estadoId',
  'gender', 'preferences', 'bio', 'role', 'isBlocked', 'createdAt',
  // Ordem do feed (regra própria nas Rules) — sem ele o perfil some
  // da grade até ser regravado.
  'randomSeed',
  'acceptedAppTermsVersion', 'acceptedAppTermsAt',
  'ageVerified', 'ageVerifiedAt', 'ageVerifiedBy', 'verifiedAge',
  'birthDate', 'ageVerificationStatus',
]));

// Ordem importa: primeiro as coleções de ORIGEM (vendas, produtos,
// conexões), por último as DERIVADAS que os gatilhos regravam
// (estatísticas, métricas, notificações).
const DELETE_ORDER = Object.freeze([
  // Marketplace (origem)
  'sales', 'purchases', 'refundRequests', 'withdrawals', 'products',
  'productReviews', 'favorites', 'downloads', 'creatorRequests',
  'coupons', 'couponUses', 'contentAccessLogs', 'screenshotEvents',
  // Contrato do Criador + Declarações do Produto (13/10/2026). São de
  // contas de teste: o registro jurídico real começa no lançamento.
  'creatorAgreements',
  // Social e chat (origem)
  'connectionRequests', 'connections', 'blocks', 'likes', 'sintonias',
  'chats', 'profile_visits', 'mediaItems', 'unlockedContent', 'autoMessages',
  // Limite diário de curtidas (13/10/2026; também some sozinho pelo TTL).
  'dailyLikeCounts',
  // Pré-cadastro da landing (item C)
  'preRegistrations',
  // Gamificação
  'dailyRewards', 'dailyFaisca', 'dailyMissions', 'destinyCards',
  'achievementTriggers', 'achievementLog', 'achievementAnalytics',
  'xpLog', 'xpIdempotency', 'prestige', 'prestigeLog', 'prestigeAnalytics',
  'weeklyRanking', 'rankingCache', 'rankingSnapshots', 'rankingReview',
  'rankingAnalytics', 'eventLedger', 'eventHashIndex', 'eventDeadLetterQueue',
  'gamificationAnalytics', 'shadowComparisons', 'triggerControl',
  'triggerSecrets', 'vaultControl', 'pendingLostSintonia',
  'visitFarmControl', 'visitorsAccess',
  // Antifarm de curtidas e respostas (AntiFarmPolicy) — contadores de teste.
  'likeFarmControl', 'messageFarmControl',
  // Órfã: nenhum código lê nem grava (resto do weeklyRanking.ts antigo,
  // removido em 27/09). Conferido em 11/10/2026.
  'weeklyMeta',
  // Economia
  'wallets', 'transactions', 'economyLedger', 'walletAuditLogs',
  'spendIdempotency', 'earnIdempotency', 'coinsPurchases', 'galaxiaPlus',
  'premiumUsageLog', 'premiumAnalytics', 'destaqueWaitlist',
  'activeOffers', 'offerLog',
  // Criador
  'creatorWallets', 'creatorTransactions', 'creatorWalletLogs',
  // Contas e suporte
  'supportTickets', 'accountDeletions', 'accountDeletionLog',
  // Questionários de moderação dos testes (produto e idade, 12/10/2026)
  'moderationRecords',
  // Tarefas de manutenção do Console (rebuild, auditoria) — só registro
  'adminJobs',
  // DERIVADAS (gatilhos) — por último
  'saleMarks', 'ratingMarks', 'creatorStats', 'productAnalytics',
  'profile_visit_counts', 'chatAccess', 'fraudFlags', 'auditLogs', 'auditLog',
  'adminMetrics', 'adminReports', 'metricsHistory', 'economySnapshots',
  'notifications', 'pushRateLimit', '_health',
]);

// ── Travas de configuração ──
function assertConfig() {
  if (KEEP_UIDS.length === 0) throw new Error('KEEP_UIDS vazio: recusado.');
  for (const name of DELETE_ORDER) {
    if (PROTECTED_COLLECTIONS.has(name) || PER_ACCOUNT_COLLECTIONS.has(name) || name === 'counters') {
      throw new Error(`Configuração inválida: "${name}" não pode estar em DELETE_ORDER.`);
    }
  }
  if (!fs.existsSync(KEY_PATH)) throw new Error(`Chave de serviço não encontrada: ${KEY_PATH}`);
}

assertConfig();
const serviceAccount = require(KEY_PATH);
if (serviceAccount.project_id !== PROJECT_ID) {
  console.error(`❌ A chave é do projeto "${serviceAccount.project_id}", não de ${PROJECT_ID}. Recusado.`);
  process.exit(1);
}

admin.initializeApp({
  credential:    admin.credential.cert(serviceAccount),
  storageBucket: STORAGE_BUCKET,
});

const db     = admin.firestore();
const auth   = admin.auth();
const bucket = admin.storage().bucket();

const report = {
  projectId: PROJECT_ID,
  mode:      EXECUTE ? 'executar' : 'simulacao',
  startedAt: new Date().toISOString(),
  keepUids:  KEEP_UIDS,
  auth:      { total: 0, kept: 0, deleted: 0, failed: 0 },
  firestore: {},
  unknownCollections: [],
  protectedCollections: [],
  counters:  { deleted: [], kept: [] },
  keptUsers: {},
  storage:   { total: 0, kept: 0, deleted: 0, failed: 0 },
  passes:    [],
};

// ── utilidades ──
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

async function countDocs(ref) {
  const snap = await ref.count().get();
  return snap.data().count;
}

function newBulkWriter() {
  const writer = db.bulkWriter();
  writer.onWriteError((error) => {
    if (error.failedAttempts < 5) return true; // tenta de novo
    console.error(`  ⚠️  falhou: ${error.documentRef.path} — ${error.message}`);
    return false;
  });
  return writer;
}

// ── 1. Conferência das contas mantidas ──
async function checkKeptAccounts() {
  console.log('\n--- CONTAS MANTIDAS ---\n');
  for (const uid of KEEP_UIDS) {
    let authUser;
    try {
      authUser = await auth.getUser(uid);
    } catch {
      throw new Error(`Conta ${uid} não existe no Auth. Confira KEEP_UIDS — recusado.`);
    }
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
      throw new Error(`users/${uid} não existe. Confira KEEP_UIDS — recusado.`);
    }
    const data = userSnap.data();
    const claims = authUser.customClaims || {};
    console.log(`  👤 ${uid}`);
    console.log(`     e-mail: ${authUser.email || '—'} | role: ${data.role || '—'} | claim av: ${claims.av === true ? 'sim' : 'não'}`);
    if (data.role !== 'superadmin') {
      console.log(`     ⚠️  role não é superadmin (${data.role || 'vazio'}) — a conta fica mesmo assim.`);
    }

    const removed = Object.keys(data).filter((key) => !KEEP_USER_FIELDS.has(key));
    const kept    = Object.keys(data).filter((key) => KEEP_USER_FIELDS.has(key));
    const subs    = (await userSnap.ref.listCollections()).map((c) => c.id);
    console.log(`     campos que ficam (${kept.length}): ${kept.join(', ') || '—'}`);
    console.log(`     campos que saem  (${removed.length}): ${removed.join(', ') || '—'}`);
    console.log(`     subcoleções que saem: ${subs.join(', ') || '—'}`);
    report.keptUsers[uid] = { email: authUser.email || null, role: data.role || null, keptFields: kept, removedFields: removed, removedSubcollections: subs };
  }

  const adminsSnap = await db.collection('internalConfig').doc('admins').get();
  if (adminsSnap.exists) {
    console.log(`\n  🔒 internalConfig/admins existe e fica (campos: ${Object.keys(adminsSnap.data()).join(', ')})`);
  } else {
    console.log('\n  ⚠️  internalConfig/admins NÃO existe — confira de onde vem a lista de superadmins.');
  }
}

// ── 2. Auth ──
async function processAuth() {
  console.log('\n--- LOGINS (FIREBASE AUTH) ---\n');
  const toDelete = [];
  let pageToken;
  do {
    const page = await auth.listUsers(AUTH_PAGE, pageToken);
    for (const u of page.users) {
      report.auth.total++;
      if (KEEP_UIDS.includes(u.uid)) report.auth.kept++;
      else toDelete.push(u.uid);
    }
    pageToken = page.pageToken;
  } while (pageToken);

  console.log(`  ${report.auth.total} logins | ficam ${report.auth.kept} | saem ${toDelete.length}`);
  if (!EXECUTE) { report.auth.deleted = toDelete.length; return; }

  for (let i = 0; i < toDelete.length; i += AUTH_PAGE) {
    const chunk = toDelete.slice(i, i + AUTH_PAGE);
    const result = await auth.deleteUsers(chunk);
    report.auth.deleted += result.successCount;
    report.auth.failed  += result.failureCount;
    result.errors.forEach((e) => console.log(`  ⚠️  ${chunk[e.index]}: ${e.error.message}`));
  }
  console.log(`  ✅ ${report.auth.deleted} logins apagados (${report.auth.failed} falhas)`);
}

// ── 3. Firestore (uma passada) ──
async function firestorePass(passNumber) {
  const pass = { pass: passNumber, deleted: {} };
  const known = new Set([...DELETE_ORDER, ...PROTECTED_COLLECTIONS, ...PER_ACCOUNT_COLLECTIONS, 'counters']);
  const existing = (await db.listCollections()).map((c) => c.id);

  if (passNumber === 1) {
    report.protectedCollections = existing.filter((c) => PROTECTED_COLLECTIONS.has(c));
    report.unknownCollections   = existing.filter((c) => !known.has(c));
    report.protectedCollections.forEach((c) => console.log(`  🔒 ${c}: PROTEGIDA, intocada`));
    report.unknownCollections.forEach((c) => console.log(`  ❔ ${c}: DESCONHECIDA — não apagada (decidir depois)`));
  }

  const writer = EXECUTE ? newBulkWriter() : null;

  // Coleções inteiras, na ordem.
  for (const name of DELETE_ORDER) {
    if (!existing.includes(name)) continue;
    const ref = db.collection(name);
    const count = await countDocs(ref);
    if (count === 0) continue;
    pass.deleted[name] = count;
    console.log(`  📁 ${name}: ${count} documentos ${EXECUTE ? 'apagados' : 'seriam apagados'}`);
    if (EXECUTE) await db.recursiveDelete(ref, writer);
  }

  // Uma conta por documento: ficam só as de KEEP_UIDS.
  for (const name of PER_ACCOUNT_COLLECTIONS) {
    if (!existing.includes(name)) continue;
    const snap = await db.collection(name).select().get();
    const others = snap.docs.filter((d) => !KEEP_UIDS.includes(d.id));
    if (others.length === 0) continue;
    pass.deleted[name] = others.length;
    console.log(`  📁 ${name}: ${others.length} ${EXECUTE ? 'apagados' : 'seriam apagados'} (ficam ${snap.size - others.length})`);
    if (EXECUTE) {
      for (const d of others) await db.recursiveDelete(d.ref, writer);
    }
  }

  // Fundadores (item C).
  if (existing.includes('counters')) {
    const snap = await db.collection('counters').get();
    for (const d of snap.docs) {
      if (FOUNDER_COUNTER_DOCS.includes(d.id)) {
        console.log(`  🌟 counters/${d.id}: count ${d.get('count') ?? 0} → ${EXECUTE ? 'apagado (volta a 0)' : 'seria apagado (volta a 0)'}`);
        if (passNumber === 1) report.counters.deleted.push({ id: d.id, count: d.get('count') ?? 0 });
        if (EXECUTE) await db.recursiveDelete(d.ref, writer);
      } else if (passNumber === 1) {
        console.log(`  🔒 counters/${d.id}: não é de Fundador — fica`);
        report.counters.kept.push(d.id);
      }
    }
  }

  if (writer) await writer.close();
  report.passes.push(pass);
  return Object.values(pass.deleted).reduce((a, b) => a + b, 0);
}

// ── 4. Reduz o documento das contas mantidas ──
async function trimKeptUsers() {
  console.log('\n--- REDUZINDO AS CONTAS MANTIDAS ---\n');
  for (const uid of KEEP_UIDS) {
    const ref  = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) continue;

    // FieldPath por nome exato: apaga também os campos com ponto no
    // nome (ex.: "xp.xpRiskScore" literal), que o script antigo pulava.
    // updatedAt NÃO entra na lista de apagar: ele é regravado logo
    // abaixo, e o Firestore recusa o mesmo campo duas vezes no update.
    const args = [];
    let removedCount = 0;
    for (const key of Object.keys(snap.data())) {
      if (KEEP_USER_FIELDS.has(key) || key === 'updatedAt') continue;
      args.push(new FieldPath(key), FieldValue.delete());
      removedCount++;
    }
    args.push(new FieldPath('updatedAt'), FieldValue.serverTimestamp());

    for (const sub of await ref.listCollections()) {
      await db.recursiveDelete(sub);
    }
    await ref.update(...args);
    console.log(`  ✅ ${uid}: ${removedCount} campos e as subcoleções removidos`);
  }
}

// ── 5. Storage ──
// O export do Firestore (backup) vai para firestore-backups/ neste
// mesmo bucket — NUNCA apagar, senão a limpeza apaga o próprio backup.
const BACKUP_PREFIX = 'firestore-backups/';

function keepStorageFile(name) {
  if (name.startsWith(BACKUP_PREFIX)) return true;
  return KEEP_UIDS.some((uid) => name.startsWith(`age_verification/${uid}/`));
}

async function processStorage() {
  console.log('\n--- STORAGE ---\n');
  let pageToken;
  const toDelete = [];
  do {
    const [files, next] = await bucket.getFiles({ autoPaginate: false, maxResults: 1000, pageToken });
    for (const f of files) {
      report.storage.total++;
      if (keepStorageFile(f.name)) report.storage.kept++;
      else toDelete.push(f);
    }
    pageToken = next && next.pageToken;
  } while (pageToken);

  console.log(`  ${report.storage.total} arquivos | ficam ${report.storage.kept} | saem ${toDelete.length}`);
  if (!EXECUTE) { report.storage.deleted = toDelete.length; return; }

  for (const f of toDelete) {
    try {
      await f.delete();
      report.storage.deleted++;
    } catch (error) {
      report.storage.failed++;
      console.log(`  ⚠️  ${f.name}: ${error.message}`);
    }
  }
  console.log(`  ✅ ${report.storage.deleted} arquivos apagados (${report.storage.failed} falhas)`);
}

function remindKey() {
  console.log('🔑 LEMBRETE: apague a chave temporária AGORA:');
  console.log(`   1. Remove-Item "${KEY_PATH}"`);
  console.log('   2. Google Cloud → IAM → Contas de serviço → Chaves → excluir a chave usada\n');
}

function saveReport() {
  const dir = path.join(__dirname, 'reset-relatorios');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `reset-${report.mode}-${report.startedAt.replace(/[:.]/g, '-')}.json`);
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n📄 Relatório: ${file}`);
}

async function main() {
  console.log('\n============================================');
  console.log(`  LIMPEZA PARA O LANÇAMENTO — ${EXECUTE ? 'EXECUÇÃO REAL' : 'SIMULAÇÃO (nada é apagado)'}`);
  console.log('============================================');
  console.log(`  Projeto: ${PROJECT_ID}`);

  await checkKeptAccounts();

  if (EXECUTE) {
    console.log('\n⚠️  ISTO É IRREVERSÍVEL. Confirme que o export do Firestore terminou.');
    const answer = await ask(`\nDigite exatamente "${CONFIRM_PHRASE}" para apagar: `);
    if (answer !== CONFIRM_PHRASE) {
      console.log('\nCancelado — nada foi apagado.\n');
      remindKey();
      process.exit(0);
    }
  }

  // Auth primeiro: nenhuma conta de teste consegue entrar e gravar
  // durante a limpeza.
  await processAuth();

  console.log('\n--- FIRESTORE ---\n');
  let deleted = await firestorePass(1);
  if (EXECUTE) {
    for (let pass = 2; pass <= MAX_PASSES && deleted > 0; pass++) {
      console.log(`\n  ⏳ aguardando ${PASS_WAIT_MS / 1000}s os gatilhos terminarem (passada ${pass})...\n`);
      await sleep(PASS_WAIT_MS);
      deleted = await firestorePass(pass);
      if (deleted === 0) console.log('  ✅ nada recriado pelos gatilhos');
    }
    if (deleted > 0) console.log('\n  ⚠️  Ainda sobraram documentos recriados — rode a simulação de novo para ver.');
    await trimKeptUsers();
  }

  await processStorage();
  saveReport();

  console.log('\n============================================');
  console.log(EXECUTE ? '  CONCLUÍDO' : '  SIMULAÇÃO CONCLUÍDA — nada foi apagado');
  console.log('============================================\n');
  if (EXECUTE) {
    console.log('Próximos passos:');
    console.log('  1. Abra o app com a sua conta (a carteira é recriada pelo initWallet)');
    console.log('  2. Coloque a foto de perfil de novo');
    console.log('  3. Confira que o Painel Admin abre e que a landing mostra 0 / 2.000');
    console.log('  4. Rode a simulação de novo: tudo deve aparecer zerado\n');
  }
  remindKey();
  process.exit(0);
}

main().catch((error) => {
  console.error('\n❌ ERRO:', error.message || error);
  try { saveReport(); } catch { /* sem relatório */ }
  remindKey();
  process.exit(1);
});
