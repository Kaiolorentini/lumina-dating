// ============================================
// LUMINA — ENGAGEMENT INITIALIZER v5.11
// src/components/EngagementInitializer.tsx
//
// v5.11 — COMEMORAÇÕES NA HORA.
//
// As flags de revelação (sintonia, prestígio, nível, marco de
// nível, cosmético) eram lidas UMA vez por sessão, com getDoc.
// Quem subia de nível usando o app só via o modal na próxima
// abertura — ou nunca, se não fechasse o app.
//
// Agora o documento do usuário é escutado em tempo real
// (onSnapshot). O useUserPermissions já escuta o MESMO
// documento; o SDK compartilha a escuta, sem leitura a mais.
//
// Ao fechar um modal, a flag é limpa no servidor. Até a limpeza
// chegar de volta pelo snapshot, `dismissedRef` lembra o valor
// já mostrado — sem isso o modal reabriria por um instante.
//
// Recompensa diária e restauração do ban continuam UMA vez por
// sessão: não dependem do documento do usuário.
//
// v5.10 — REVELAÇÃO DE NÍVEL. Ordem dos modais ao competirem:
// SINTONIA, PRESTÍGIO, NÍVEL (com marco), cosmético, diária.
//
// v5.9 — REVELAÇÃO DE PRESTÍGIO (cinco vezes na vida da conta).
//
// v5.8 — REVELAÇÃO DA SINTONIA. O MatchService grava
// progression.pendingSintoniaReveal nos dois lados; guarda só a
// mais recente — o resto fica no sino.
//
// v5.7 — restauração sob demanda do ban de marketplace.
//
// v5.6 — revelação de cosmético (flag no servidor).
//
// v5.5 — robustez: fail-closed na recompensa diária,
// getFunctions() lazy, checkedRef só após sucesso, cleanup do
// setTimeout, logs sob __DEV__.
// ============================================

import React, { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, getDoc, onSnapshot, DocumentData } from 'firebase/firestore';
import { useAuth }      from '../context/AuthContext';
import { db }           from '../services/firebase';
import DailyRewardModal from './DailyRewardModal';
import CosmeticRevealModal from './CosmeticRevealModal';
import SintoniaRevealModal from './SintoniaRevealModal';
import PrestigeRevealModal from './PrestigeRevealModal';
import LevelUpModal, { LevelRewardInfo } from './LevelUpModal';
import { FRAMES } from '../config/cosmeticsCatalog';

const REVEAL_DELAY_MS = 1500;

// Genérico extraído para tipo nomeado: httpsCallable< em
// fim de linha é corrompido ao colar.
interface RestoreCreatorResult {
  restored: boolean;
  role: string | null;
}

interface DailyRewardStatusResult {
  alreadyClaimed: boolean;
}

/** Última versão de cada flag já mostrada — evita reabrir o
 *  modal enquanto a limpeza no servidor não volta. */
interface DismissedFlags {
  cosmetic?: string;
  sintonia?: string;
  prestige?: number;
  level?:    number;
  reward?:   number;
}

export default function EngagementInitializer() {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<any>();

  const [showDailyReward, setShowDailyReward] = useState(false);
  const [rewardPending,   setRewardPending]   = useState(false);
  const [revealId,        setRevealId]        = useState<string | null>(null);
  const [photoURL,        setPhotoURL]        = useState('');
  const [sintoniaUid,     setSintoniaUid]     = useState<string | null>(null);
  const [sintoniaName,    setSintoniaName]    = useState('');
  const [prestigeStage,   setPrestigeStage]   = useState<number | null>(null);
  const [levelUp,         setLevelUp]         = useState<number | null>(null);
  const [levelReward,     setLevelReward]     = useState<LevelRewardInfo | null>(null);

  const checkedRef      = useRef<string | null>(null);
  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef      = useRef(true);
  const dismissedRef    = useRef<DismissedFlags>({});
  const sintoniaNameFor = useRef<string | null>(null);

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

  // ── Uma vez por sessão: ban e recompensa diária ──
  useEffect(() => {
    if (authLoading)  return;
    if (!user?.uid)   return;
    if (checkedRef.current === user.uid) return;

    checkSessionOnce(user.uid);
  }, [user?.uid, authLoading]);

  // ── Tempo real: flags de comemoração ──
  useEffect(() => {
    if (authLoading) return;
    if (!user?.uid)  return;

    // Troca de conta: o que foi dispensado era da conta anterior.
    dismissedRef.current    = {};
    sintoniaNameFor.current = null;

    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      snap => { handleUserSnapshot(snap.data() ?? {}); },
      error => {
        if (__DEV__) {
          console.warn('[EngagementInitializer] listener do usuário falhou:', error);
        }
      },
    );

    return unsubscribe;
  }, [user?.uid, authLoading]);

  function handleUserSnapshot(data: DocumentData) {
    if (!mountedRef.current) return;

    const progression = data?.progression ?? {};
    const dismissed   = dismissedRef.current;

    // Cosmético
    const cosmetic = progression.pendingCosmeticReveal;
    if (typeof cosmetic === 'string' && cosmetic && dismissed.cosmetic !== cosmetic) {
      setRevealId(cosmetic);
      setPhotoURL(data?.photoURL ?? '');
    }

    // Sintonia — o nome exige outra leitura, só quando a
    // pessoa a revelar muda.
    const sintonia = progression.pendingSintoniaReveal;
    if (typeof sintonia === 'string' && sintonia && dismissed.sintonia !== sintonia) {
      setSintoniaUid(sintonia);
      if (sintoniaNameFor.current !== sintonia) {
        sintoniaNameFor.current = sintonia;
        loadSintoniaName(sintonia);
      }
    }

    // Prestígio
    const prestige = progression.pendingPrestigeReveal;
    if (typeof prestige === 'number' && prestige > 0 && dismissed.prestige !== prestige) {
      setPrestigeStage(prestige);
    }

    // Nível
    const level = progression.pendingLevelReveal;
    if (typeof level === 'number' && level > 1 && dismissed.level !== level) {
      setLevelUp(level);
    }

    // Marco de nível — mostrado no MESMO modal do nível.
    const reward = progression.pendingLevelReward;
    if (
      reward && typeof reward.level === 'number' &&
      dismissed.reward !== reward.level
    ) {
      setLevelReward({
        level:           reward.level,
        fragments:       Number(reward.fragments)       || 0,
        crystalsPremium: Number(reward.crystalsPremium) || 0,
      });
    }
  }

  async function loadSintoniaName(uid: string) {
    try {
      const otherSnap = await getDoc(doc(db, 'users', uid));
      const otherName = (otherSnap.data()?.name as string | undefined) ?? 'Alguém';
      if (mountedRef.current) setSintoniaName(otherName);
    } catch {
      if (mountedRef.current) setSintoniaName('Alguém');
    }
  }

  async function checkSessionOnce(uid: string) {
    // ── Ban de marketplace vencido ──
    // Idempotente no servidor; falhar só posterga a restauração.
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

    // ── Recompensa diária ──
    try {
      const fn = httpsCallable<void, DailyRewardStatusResult>(
        getFunctions(),
        'getDailyRewardStatus',
      );

      const result = await fn();

      // Só marca como verificado APÓS sucesso.
      checkedRef.current = uid;

      if (!result.data.alreadyClaimed && mountedRef.current) {
        setRewardPending(true);
      }
    } catch (error) {
      // FAIL-CLOSED: sem saber se já resgatou, não oferece.
      if (__DEV__) {
        console.error('[EngagementInitializer] getDailyRewardStatus falhou:', error);
      }
    }
  }

  // A recompensa diária só entra quando não há outra comemoração.
  useEffect(() => {
    if (!rewardPending) return;
    if (revealId)       return;
    if (sintoniaUid)    return;
    if (prestigeStage)  return;
    if (levelUp)        return;
    if (levelReward)    return;

    timerRef.current = setTimeout(() => {
      if (mountedRef.current) setShowDailyReward(true);
    }, REVEAL_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [rewardPending, revealId, sintoniaUid, prestigeStage, levelUp, levelReward]);

  async function clearOnServer(fnName: string) {
    try {
      await httpsCallable(getFunctions(), fnName)({});
    } catch (error) {
      // Tolerável: o pior caso é ver a comemoração de novo na
      // próxima abertura.
      if (__DEV__) {
        console.warn(`[EngagementInitializer] ${fnName} falhou:`, error);
      }
    }
  }

  async function closeReveal() {
    const id = revealId;
    if (id) dismissedRef.current.cosmetic = id;
    setRevealId(null);
    await clearOnServer('clearCosmeticReveal');
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

  async function closeSintonia(): Promise<string | null> {
    const uid = sintoniaUid;
    if (uid) dismissedRef.current.sintonia = uid;
    setSintoniaUid(null);
    await clearOnServer('clearSintoniaReveal');
    return uid;
  }

  async function handleSintoniaChat() {
    const uid = await closeSintonia();
    if (uid) {
      navigation.navigate('UserChat', {
        userId:    uid,
        userName:  sintoniaName,
        userPhoto: '',
      });
    }
  }

  async function closePrestige() {
    if (prestigeStage !== null) dismissedRef.current.prestige = prestigeStage;
    setPrestigeStage(null);
    await clearOnServer('clearPrestigeReveal');
  }

  async function closeLevelUp() {
    if (levelUp !== null)     dismissedRef.current.level  = levelUp;
    if (levelReward !== null) dismissedRef.current.reward = levelReward.level;
    setLevelUp(null);
    setLevelReward(null);
    // Limpa nível E marco — o mesmo modal mostra os dois.
    await clearOnServer('clearLevelReveal');
  }

  if (!user?.uid) return null;

  const levelShown = levelUp ?? levelReward?.level ?? null;

  return (
    <>
      {/* Sintonia PRIMEIRO: é o momento que define o app. */}
      <SintoniaRevealModal
        visible={sintoniaUid !== null}
        otherName={sintoniaName}
        onClose={() => { closeSintonia(); }}
        onOpenChat={handleSintoniaChat}
      />

      {/* Prestígio depois da sintonia. */}
      <PrestigeRevealModal
        visible={prestigeStage !== null && sintoniaUid === null}
        stage={prestigeStage}
        onClose={() => { closePrestige(); }}
      />

      {/* Nível — com o marco de recompensa, quando houver. */}
      <LevelUpModal
        visible={levelShown !== null && sintoniaUid === null && prestigeStage === null}
        level={levelShown}
        reward={levelReward}
        onClose={() => { closeLevelUp(); }}
      />

      <CosmeticRevealModal
        visible={
          revealId !== null &&
          sintoniaUid === null &&
          prestigeStage === null &&
          levelShown === null
        }
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