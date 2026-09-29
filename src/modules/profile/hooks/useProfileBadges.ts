// ============================================
// LUMINA — BALÕES DO PERFIL
// src/modules/profile/hooks/useProfileBadges.ts
//
// Tudo em tempo real e sem consulta nova cara:
//  • solicitações pendentes (a mesma escuta que já existia)
//  • notificações não lidas, agrupadas por área
//  • Cofre liberado (a carteira já chega inteira pelo onSnapshot)
//  • suporte respondeu (um chamado com unreadForUser)
//
// `total` alimenta o balão da aba Perfil. Notificações gerais não
// entram nele: já têm o balão do sino na aba Descobrir.
// ============================================

import { useEffect, useState } from 'react';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { useCoins } from '../../../context/CoinsContext';
import { listenToRequests } from '../services/requestsService';
import { listenToNotifications } from '../../notifications/services/notificationService';

export const BADGE_TYPES = {
  purchases: ['refund_processed', 'purchase_confirmed'],
  products:  ['product_approved', 'product_rejected', 'creator_approved'],
  earnings:  ['sale_completed', 'sale_refunded', 'withdrawal_approved', 'withdrawal_paid', 'withdrawal_rejected'],
} as const;

export interface ProfileBadges {
  requests:      number;
  notifications: number;
  purchases:     number;
  products:      number;
  earnings:      number;
  support:       boolean;
  vaultReady:    boolean;
  total:         number;
}

interface VaultFields {
  vaultFragments?: number;
  vaultUnlockAt?:  { toDate?: () => Date } | null;
}

export function useProfileBadges(uid: string | undefined): ProfileBadges {
  const { wallet } = useCoins();
  const [requests, setRequests] = useState(0);
  const [unread, setUnread]     = useState({ all: 0, purchases: 0, products: 0, earnings: 0 });
  const [support, setSupport]   = useState(false);
  const [now, setNow]           = useState(Date.now());

  useEffect(() => {
    if (!uid) return;
    const unsubRequests = listenToRequests(uid, list => setRequests(list.length));
    const unsubNotifs   = listenToNotifications(uid, list => {
      const pending = list.filter(n => !n.read);
      const count = (types: readonly string[]) => pending.filter(n => types.includes(n.type)).length;
      setUnread({
        all:       pending.length,
        purchases: count(BADGE_TYPES.purchases),
        products:  count(BADGE_TYPES.products),
        earnings:  count(BADGE_TYPES.earnings),
      });
    });
    const unsubSupport = onSnapshot(
      query(collection(db, 'supportTickets'), where('uid', '==', uid), where('unreadForUser', '==', true), limit(1)),
      snap => setSupport(!snap.empty),
      () => setSupport(false),
    );
    return () => { unsubRequests(); unsubNotifs(); unsubSupport(); };
  }, [uid]);

  // Cofre: liberado quando tem fragmentos e o prazo do ciclo passou.
  // Se o prazo ainda vai vencer, reavalia no instante exato.
  const vault = wallet as (typeof wallet & VaultFields) | null;
  const unlockAt = vault?.vaultUnlockAt?.toDate?.()?.getTime() ?? null;
  const vaultReady = (vault?.vaultFragments ?? 0) > 0 && (unlockAt === null || unlockAt <= now);

  useEffect(() => {
    if (unlockAt === null || unlockAt <= Date.now()) return;
    const timer = setTimeout(() => setNow(Date.now()), unlockAt - Date.now() + 500);
    return () => clearTimeout(timer);
  }, [unlockAt]);

  const total = requests + unread.purchases + unread.products + unread.earnings
    + (support ? 1 : 0) + (vaultReady ? 1 : 0);

  return {
    requests,
    notifications: unread.all,
    purchases:     unread.purchases,
    products:      unread.products,
    earnings:      unread.earnings,
    support,
    vaultReady,
    total,
  };
}