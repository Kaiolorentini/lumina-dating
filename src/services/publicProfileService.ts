// ============================================
// LUMINA — PERFIL PÚBLICO (APP)
// src/services/publicProfileService.ts
//
// 12/10/2026. Perfil de OUTRA pessoa sempre vem daqui, nunca de
// users/{uid} — as regras passaram a liberar users só para o dono e
// os admins (o documento tem e-mail, data de nascimento, moderação...).
//
// publicProfiles/{uid} é gravado pelo servidor (gatilho
// onUserWrittenPublicProfile) com a lista branca de campos, e só
// existe para perfis listáveis (idade verificada, conta ativa). Perfil
// que não aparece aqui não aparece em lugar nenhum do app.
//
// Os campos têm os MESMOS nomes do users, então o resto do app lê o
// resultado como UserProfile sem adaptação.
// ============================================

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../core/firebase';
import { UserProfile } from '../shared/types';

export const PUBLIC_PROFILES = 'publicProfiles';

/** Perfil público de outra pessoa (null se não existe ou não está listável). */
export async function getPublicProfile(uid: string): Promise<UserProfile | null> {
  if (!uid) return null;
  const snap = await getDoc(doc(db, PUBLIC_PROFILES, uid));
  if (!snap.exists()) return null;
  return { ...(snap.data() as UserProfile), uid: snap.id };
}

/** Nome e foto, para listas (chat, sintonias, denúncia). */
export async function getPublicNameAndPhoto(
  uid: string,
): Promise<{ name: string; photoURL: string; isBlocked: boolean } | null> {
  const profile = await getPublicProfile(uid);
  if (!profile) return null;
  return {
    name:      profile.name || 'Usuário',
    photoURL:  profile.photoURL || '',
    isBlocked: (profile as { isBlocked?: boolean }).isBlocked === true,
  };
}
