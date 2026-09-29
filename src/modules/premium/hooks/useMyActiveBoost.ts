// ============================================
// LUMINA — MEU IMPULSO ATIVO
// src/modules/premium/hooks/useMyActiveBoost.ts
//
// Para o chip da Home: qual impulso está ativo e quanto falta.
// Escuta o próprio users/{uid} — o SDK compartilha a escuta com
// as que já existem nesse documento (useUserPermissions,
// EngagementInitializer), então não custa leitura extra.
// ============================================

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { BoostType } from '../../../components/BoostBadge';

const TICK_MS = 30 * 1000;
const TYPES: ReadonlySet<string> = new Set(['impulso', 'turbo', 'destaque']);

export interface MyActiveBoost {
  type:        BoostType;
  remainingMs: number;
}

export function useMyActiveBoost(uid: string | undefined): MyActiveBoost | null {
  const [boost, setBoost] = useState<{ type: BoostType; until: number } | null>(null);
  const [now,   setNow]   = useState(Date.now());

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, 'users', uid),
      snap => {
        const data  = snap.data() ?? {};
        const until = (data.boostActiveUntil as { toDate?: () => Date } | undefined)?.toDate?.()?.getTime() ?? 0;
        const type  = data.boostType as string | undefined;
        setNow(Date.now());
        setBoost(until > Date.now() && type && TYPES.has(type) ? { type: type as BoostType, until } : null);
      },
      error => console.warn('[useMyActiveBoost]', error),
    );
  }, [uid]);

  useEffect(() => {
    if (!boost) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [boost]);

  if (!boost) return null;
  const remainingMs = boost.until - now;
  return remainingMs > 0 ? { type: boost.type, remainingMs } : null;
}