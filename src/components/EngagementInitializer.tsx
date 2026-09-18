// ============================================
// LUMINA — ENGAGEMENT INITIALIZER v5.7
// src/components/EngagementInitializer.tsx
//
// v5.7 — Restauração sob demanda do ban de marketplace.
// Se o ban temporário venceu, a CF devolve o papel de
// criador na abertura do app. O useUserPermissions escuta
// o documento com onSnapshot, então a aba Marketplace e as
// telas de criador voltam sozinhas, sem reiniciar o app.
// Silenciosa por natureza: nada a mostrar quando não há
// ban vencido, e o push de liberação vem do servidor.
//
// v5.6 — FASE 8: revelação de cosmético.
//
// Dois modais podem competir ao abrir o app. A ordem é:
// cosmético primeiro, recompensa diária depois que ele fechar.
// Ganhar a moldura de Criador é evento raro; a recompensa
// acontece todo dia e pode esperar trinta segundos.
//
// A flag progression.pendingCosmeticReveal vive no SERVIDOR e
// não em armazenamento local: quem concede é o backend, só ele
// sabe o que é novidade, e a flag sobrevive a reinstalação.
//
// v5.5 — CORREÇÕES DE ROBUSTEZ
//
// 1. FAIL-CLOSED no catch (era CRÍTICO)
//    Antes, qualquer falha (rede, cold start, permissão) caía num
//    fallback que ABRIA o modal de recompensa. Quem já resgatou
//    hoje via o modal, clicava, e a CF rejeitava por idempotência.
//    Num fluxo de economia, erro → não mostra nada.
//
// 2. getFunctions() lazy
//    No escopo do módulo, executava no import — sem garantia de
//    que initializeApp() já tinha rodado. Falha não determinística
//    no boot ("às vezes a recompensa não aparece").
//
// 3. checkedRef marcado só APÓS sucesso
//    Antes era marcado antes da chamada: uma falha transitória
//    bloqueava nova tentativa pela sessão inteira.
//
// 4. Cleanup do setTimeout
//    Logout dentro dos 1500ms causava setState em componente
//    desmontado.
//
// 5. Logs sob __DEV__, sem UID em produção.
// ============================================

import React, { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth }      from '../context/AuthContext';
import { db }           from '../services/firebase';
import DailyRewardModal from './DailyRewardModal';
import CosmeticRevealModal from './CosmeticRevealModal';
import { FRAMES } from '../config/cosmeticsCatalog';

const REVEAL_DELAY_MS = 1500;

// Genérico extraído para tipo nomeado: httpsCallable< em
// fim de linha é corrompido ao colar.
interface RestoreCreatorResult {
  restored: boolean;
  role: string | null;
}

export default function EngagementInitializer() {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<any>();

  const [showDailyReward, setShowDailyReward] = useState(false);
  const [rewardPending,   setRewardPending]   = useState(false);
  const [revealId,        setRevealId]        = useState<string | null>(null);
  const [photoURL,        setPhotoURL]        = useState('');

  const checkedRef = useRef<string | null>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (authLoading)  return;
    if (!user?.uid)   return;
    if (checkedRef.current === user.uid) return;

    checkEngagements(user.uid);
  }, [user?.uid, authLoading]);

  async function checkEngagements(uid: string) {
    // ── Ban de marketplace vencido ──
    // Idempotente no servidor: sem ban vencido não escreve
    // nada. try próprio para não derrubar o resto — e sem
    // fail-closed aqui, porque não há nada a exibir: falhar
    // só posterga a restauração para a próxima abertura ou
    // para a varredura diária.
    try {
      const restore = httpsCallable<void, RestoreCreatorResult>(
        getFunctions(),
        'restoreCreatorIfExpired',
      );
      const restored = await restore();

      if (__DEV__ && restored.data.restored) {
        console.log('[EngagementInitializer] Ban expirado — papel restaurado:', restored.data.role);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[EngagementInitializer] restoreCreatorIfExpired falhou:', error);
      }
    }

    // ── Cosmético pendente ──
    // Leitura direta do documento: uma leitura por abertura, e
    // evita uma CF só para isso. Falha aqui não pode derrubar a
    // recompensa diária, por isso o try próprio.
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      const data = snap.data() ?? {};
      const pending = data?.progression?.pendingCosmeticReveal;

      if (typeof pending === 'string' && pending && mountedRef.current) {
        setRevealId(pending);
        setPhotoURL(data?.photoURL ?? '');
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[EngagementInitializer] pendingCosmeticReveal falhou:', error);
      }
    }

    // ── Recompensa diária ──
    try {
      // Lazy: resolvido aqui, não no import do módulo.
      const fn = httpsCallable<void, { alreadyClaimed: boolean }>(
        getFunctions(),
        'getDailyRewardStatus',
      );

      const result = await fn();

      // Só marca como verificado APÓS sucesso — uma falha
      // transitória deve permitir nova tentativa.
      checkedRef.current = uid;

      if (__DEV__) {
        console.log('[EngagementInitializer] alreadyClaimed:', result.data.alreadyClaimed);
      }

      if (!result.data.alreadyClaimed && mountedRef.current) {
        setRewardPending(true);
      }
    } catch (error) {
      // FAIL-CLOSED: não sabemos se já resgatou, então não
      // oferecemos. Mostrar o modal aqui exibiria uma recompensa
      // que a CF vai rejeitar — e, se claimDailyReward não tiver
      // guard de idempotência, seria vetor de farm.
      if (__DEV__) {
        console.error('[EngagementInitializer] getDailyRewardStatus falhou:', error);
      }
    }
  }

  // A recompensa só entra na fila quando não há cosmético a
  // revelar. Dois modais sobrepostos é pior que um atraso.
  useEffect(() => {
    if (!rewardPending) return;
    if (revealId)       return;

    timerRef.current = setTimeout(() => {
      if (mountedRef.current) setShowDailyReward(true);
    }, REVEAL_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [rewardPending, revealId]);

  async function closeReveal() {
    const id = revealId;
    setRevealId(null);

    // Limpa a flag no servidor — sem isso o modal volta a cada
    // abertura. Falha aqui é tolerável: o pior caso é ver a
    // comemoração duas vezes.
    try {
      await httpsCallable(getFunctions(), 'clearCosmeticReveal')({});
    } catch (error) {
      if (__DEV__) {
        console.warn('[EngagementInitializer] clearCosmeticReveal falhou:', error);
      }
    }

    return id;
  }

  async function handleRevealClose() {
    await closeReveal();
  }

  async function handleRevealGoToItem() {
    const id = await closeReveal();
    // Molduras e badges têm telas próprias; o catálogo diz qual.
    navigation.navigate(id && FRAMES[id] ? 'Frames' : 'Badges');
  }

  if (!user?.uid) return null;

  return (
    <>
      <CosmeticRevealModal
        visible={revealId !== null}
        cosmeticId={revealId}
        photoURL={photoURL}
        onClose={handleRevealClose}
        onGoToItem={handleRevealGoToItem}
      />

      {showDailyReward && (
        <DailyRewardModal
          uid={user.uid}
          visible={showDailyReward}
          onClose={() => setShowDailyReward(false)}
        />
      )}
    </>
  );
}