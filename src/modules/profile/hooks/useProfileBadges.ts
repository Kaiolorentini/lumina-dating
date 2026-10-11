// ============================================
// LUMINA — BALÕES DO PERFIL
// src/modules/profile/hooks/useProfileBadges.ts
//
// Tudo em tempo real e sem consulta nova cara:
//  • solicitações pendentes (a mesma escuta que já existia)
//  • notificações não lidas, agrupadas por área
//  • Cofre liberado (a carteira já chega inteira pelo onSnapshot)
//  • suporte respondeu (um chamado com unreadForUser)
//  • coleções para coletar (wallets.collectionsToClaim, gravado só
//    pelo servidor — chega no mesmo onSnapshot da carteira)
//
// `total` alimenta o balão da aba Perfil. Notificações gerais não
// entram nele: já têm o balão do sino na aba Descobrir.
//
// 09/10/2026: compras, produtos e ganhos saíram do Perfil para a
// aba Painel. Os balões deles somam em `panel` (balão da aba
// Painel) e deixaram de entrar em `total` — senão o Perfil
// mostraria um número que não aparece em lugar nenhum dele.
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
  // Pedido de criador recusado (onRejectCreator). A aprovação já
  // acende "Meus Produtos" (creator_approved, em products).
  creator:   ['creator_rejected'],
} as const;

export interface ProfileBadges {
  requests:      number;
  notifications: number;
  purchases:     number;
  products:      number;
  earnings:      number;
  /** Pedido de criador recusado, ainda não visto. */
  creator:       number;
  support:       boolean;
  vaultReady:    boolean;
  /** Coleções completas com fragmentos ainda não coletados. */
  collectionsToClaim: number;
  /** Balão da aba Perfil: só o que está no Perfil. */
  total:         number;
  /** Balão da aba Painel: compras, produtos e ganhos. */
  panel:         number;
}

interface VaultFields {
  vaultFragments?: number;
  vaultUnlockAt?:  { toDate?: () => Date } | null;
  collectionsToClaim?: unknown;
}

export function useProfileBadges(uid: string | undefined): ProfileBadges {
  const { wallet } = useCoins();
  const [requests, setRequests] = useState(0);
  const [unread, setUnread]     = useState({ all: 0, purchases: 0, products: 0, earnings: 0, creator: 0 });
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
        creator:   count(BADGE_TYPES.creator),
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

  // Coleções para coletar: lista mantida pelo servidor na carteira.
  const toClaim = vault?.collectionsToClaim;
  const collectionsToClaim = Array.isArray(toClaim)
    ? toClaim.filter((id): id is string => typeof id === 'string').length
    : 0;

  const total = requests + (support ? 1 : 0) + (vaultReady ? 1 : 0) + collectionsToClaim;
  const panel = unread.purchases + unread.products + unread.earnings + unread.creator;

  return {
    requests,
    notifications: unread.all,
    purchases:     unread.purchases,
    products:      unread.products,
    earnings:      unread.earnings,
    creator:       unread.creator,
    support,
    vaultReady,
    collectionsToClaim,
    total,
    panel,
  };
}
