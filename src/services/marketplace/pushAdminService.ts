// ============================================
// PUSH ADMIN SERVICE
//
// Utilitário centralizado para enviar push
// notifications para superadmins.
// Usado por: creatorService, productService, WithdrawalScreen
// ============================================

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { COLLECTIONS } from '../../core/constants';

const SUPERADMIN_UIDS = [
  'DOoEhA9B2QZfTnJrIBJIUhNjuC23',
  '8DyoecyZiuPOwvCDoO9WekJkVkH3',
];

export async function notifySuperAdmins(
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  try {
    const snapshots = await Promise.all(
      SUPERADMIN_UIDS.map(uid => getDoc(doc(db, COLLECTIONS.USERS, uid)))
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