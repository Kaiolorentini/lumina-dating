// ============================================
// PUSH ADMIN SERVICE (cliente)
//
// Espelha o functions/src/utils/notifyAdmins.ts: a lista de
// superadmins vem de appSettings/adminConfig.superAdmins.
//
// Antes eram dois UIDs hardcoded no código. Promover alguém a
// superadmin não fazia ele receber nada, e remover alguém não
// parava de notificá-lo — divergência silenciosa com o backend,
// que já lia do adminConfig.
//
// Usado por: productService (produto submetido), creatorService,
// WithdrawalScreen.
// ============================================

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { COLLECTIONS } from '../../core/constants';

// appSettings tem `allow read: if true` nas rules — leitura
// segura do cliente, e é onde o backend já busca.
async function getSuperAdminUids(): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, 'appSettings', 'adminConfig'));
    const uids = snap.data()?.superAdmins;
    if (Array.isArray(uids)) {
      return uids.filter((u): u is string => typeof u === 'string' && u.length > 0);
    }
    return [];
  } catch (error) {
    console.warn('[pushAdminService] Erro ao ler adminConfig:', error);
    return [];
  }
}

export async function notifySuperAdmins(
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  try {
    const uids = await getSuperAdminUids();
    if (uids.length === 0) {
      console.warn('[pushAdminService] Nenhum superadmin configurado em appSettings/adminConfig');
      return;
    }

    const snapshots = await Promise.all(
      uids.map(uid => getDoc(doc(db, COLLECTIONS.USERS, uid)))
    );

    const tokens = snapshots
      .filter(snap => snap.exists())
      .map(snap => snap.data()?.pushToken)
      .filter((token): token is string => typeof token === 'string' && token.length > 0);

    if (tokens.length === 0) {
      console.warn('[pushAdminService] Nenhum pushToken de superadmin encontrado');
      return;
    }

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        tokens.map(token => ({
          to: token,
          title,
          body,
          data,
          sound: 'default',
          priority: 'high',
        }))
      ),
    });

    console.log(`[pushAdminService] Push enviado para ${tokens.length} superadmin(s)`);
  } catch (error) {
    // Falha silenciosa — não bloqueia o fluxo principal
    console.warn('[pushAdminService] Erro ao enviar push:', error);
  }
}