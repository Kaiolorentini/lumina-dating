// ============================================
// LUMINA — VERIFICAÇÃO DE IDADE, HOOK
// src/modules/verification/hooks/useAgeVerification.ts
//
// Sobe as três imagens de uma vez no final, não a cada etapa:
// quem desiste na etapa 2 não deixa imagem de documento órfã
// no Storage.
//
// O andamento (fotos tiradas, etapa, câmera aberta) vive no
// verificationDraft, não em useState: o Android pode encerrar o
// app com a câmera aberta, e a pessoa precisa voltar exatamente
// onde estava, com a foto que acabou de tirar.
//
// O status não é lido aqui: ele vem do useUserPermissions,
// que escuta users/{uid} com onSnapshot. Assim a tela sai
// de "pendente" sozinha quando o admin aprova, sem polling.
// ============================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  CapturedImage,
  captureVerificationImage,
  recoverPendingCapture,
  submitVerification,
  uploadVerificationImage,
} from '../services/verificationService';
import {
  DraftCaptures,
  EMPTY_DRAFT,
  VerificationDraft,
  clearDraft,
  deleteLocalFile,
  getDraft,
  loadDraft,
  subscribeDraft,
  updateDraft,
} from '../services/verificationDraft';
import { VERIFICATION_STEPS, VerificationStep } from '../../../config/verification';

type Captures = Partial<Record<VerificationStep, CapturedImage>>;

interface UseAgeVerificationReturn {
  /** Índice da etapa atual em VERIFICATION_STEPS. */
  stepIndex: number;
  currentStep: VerificationStep;
  captures: Captures;
  /** true quando as três fotos foram tiradas. */
  isComplete: boolean;
  /** true enquanto recupera fotos de antes de o app ser encerrado. */
  restoring: boolean;
  /** true com a câmera aberta ou a foto sendo preparada. */
  capturing: boolean;
  submitting: boolean;
  /** 0 a 100 durante o envio das três imagens. */
  progress: number;
  error: string | null;
  /** true quando a permissão de câmera foi negada. */
  cameraDenied: boolean;
  capture: () => Promise<void>;
  retake: (step: VerificationStep) => void;
  goToStep: (index: number) => void;
  submit: () => Promise<boolean>;
}

/** Primeira etapa sem foto; com as três prontas, a última (conferência). */
function firstMissingIndex(captures: DraftCaptures): number {
  const missing = VERIFICATION_STEPS.findIndex(step => !captures[step]);
  return missing === -1 ? VERIFICATION_STEPS.length - 1 : missing;
}

/** Grava a foto na etapa, apagando a anterior dessa etapa. */
function storeCapture(uid: string, step: VerificationStep, uri: string): Promise<void> {
  const previous = getDraft(uid).captures[step];
  if (previous && previous !== uri) void deleteLocalFile(previous);

  return updateDraft(uid, draft => {
    const captures = { ...draft.captures, [step]: uri };
    return {
      ...draft,
      captures,
      pendingStep: null,
      stepIndex: firstMissingIndex(captures),
    };
  });
}

export function useAgeVerification(): UseAgeVerificationReturn {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [draft, setDraft] = useState<VerificationDraft>(() =>
    uid ? getDraft(uid) : EMPTY_DRAFT,
  );
  const [restoring, setRestoring] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);

  // Trava síncrona: dois toques rápidos não abrem duas câmeras.
  const capturingRef = useRef(false);

  // Carrega o rascunho e recupera a foto que o Android segurou.
  useEffect(() => {
    if (!uid) {
      setDraft(EMPTY_DRAFT);
      setRestoring(false);
      return;
    }

    let alive = true;
    setRestoring(true);
    const unsubscribe = subscribeDraft(uid, next => {
      if (alive) setDraft(next);
    });

    (async () => {
      try {
        const loaded = await loadDraft(uid);
        if (!alive) return;
        setDraft(loaded);

        if (loaded.pendingStep && !capturingRef.current) {
          const step = loaded.pendingStep;
          try {
            const recovered = await recoverPendingCapture();
            if (recovered) await storeCapture(uid, step, recovered.uri);
            else await updateDraft(uid, d => ({ ...d, pendingStep: null }));
          } catch (e) {
            await updateDraft(uid, d => ({ ...d, pendingStep: null }));
            if (alive) {
              setError(
                e instanceof Error ? e.message : 'Não foi possível recuperar a foto. Tire novamente.',
              );
            }
          }
        }
      } catch (e) {
        console.warn('[useAgeVerification] Falha ao restaurar rascunho', e);
      } finally {
        if (alive) setRestoring(false);
      }
    })();

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [uid]);

  const captures = useMemo<Captures>(() => {
    const out: Captures = {};
    for (const step of VERIFICATION_STEPS) {
      const uri = draft.captures[step];
      if (uri) out[step] = { uri };
    }
    return out;
  }, [draft.captures]);

  const stepIndex = draft.stepIndex;
  const currentStep = VERIFICATION_STEPS[stepIndex] ?? VERIFICATION_STEPS[0];
  const isComplete = VERIFICATION_STEPS.every(step => !!draft.captures[step]);

  const capture = useCallback(async () => {
    if (!uid || restoring || capturingRef.current) return;

    const step = currentStep;
    capturingRef.current = true;
    setCapturing(true);
    setError(null);
    setCameraDenied(false);

    try {
      // Gravado ANTES de abrir a câmera: se o Android encerrar o
      // app, é por aqui que a foto volta para a etapa certa.
      await updateDraft(uid, d => ({ ...d, pendingStep: step }));

      const image = await captureVerificationImage();
      if (!image) {
        await updateDraft(uid, d => ({ ...d, pendingStep: null }));
        return;
      }

      await storeCapture(uid, step, image.uri);
    } catch (e) {
      await updateDraft(uid, d => ({ ...d, pendingStep: null }));
      if (e instanceof Error && e.message === 'CAMERA_DENIED') {
        setCameraDenied(true);
        setError('Precisamos da câmera para verificar seu documento.');
        return;
      }
      setError(e instanceof Error ? e.message : 'Não foi possível abrir a câmera.');
    } finally {
      capturingRef.current = false;
      setCapturing(false);
    }
  }, [uid, restoring, currentStep]);

  const retake = useCallback((step: VerificationStep) => {
    if (!uid) return;
    void deleteLocalFile(getDraft(uid).captures[step]);
    void updateDraft(uid, d => {
      const next = { ...d.captures };
      delete next[step];
      return { ...d, captures: next, stepIndex: VERIFICATION_STEPS.indexOf(step) };
    });
    setError(null);
  }, [uid]);

  const goToStep = useCallback((index: number) => {
    if (!uid) return;
    if (index < 0 || index >= VERIFICATION_STEPS.length) return;
    void updateDraft(uid, d => ({ ...d, stepIndex: index }));
    setError(null);
  }, [uid]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!uid) {
      setError('Sessão expirada. Entre novamente.');
      return false;
    }
    if (!isComplete) {
      setError('Tire as três fotos antes de enviar.');
      return false;
    }

    setSubmitting(true);
    setProgress(0);
    setError(null);

    try {
      // Sequencial, não em paralelo: três uploads simultâneos em
      // rede móvel competem entre si e o progresso fica sem sentido.
      for (let i = 0; i < VERIFICATION_STEPS.length; i++) {
        const step = VERIFICATION_STEPS[i];
        const uri = draft.captures[step];
        if (!uri) throw new Error('Tire as três fotos antes de enviar.');

        await uploadVerificationImage(uid, step, { uri }, percent => {
          // Cada imagem vale um terço da barra.
          const base = (i / VERIFICATION_STEPS.length) * 100;
          const slice = percent / VERIFICATION_STEPS.length;
          setProgress(Math.round(base + slice));
        });
      }

      setProgress(100);

      // Só agora o registro é criado. A CF confirma que os
      // três arquivos existem antes de marcar como pendente.
      await submitVerification();

      // Aceito: as fotos já estão no servidor e a cópia local sai do
      // aparelho. Sem avisar a tela, e com o "enviando" mantido, para
      // ela não piscar vazia antes de o app trocar para a espera.
      await clearDraft(uid, { notify: false });
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao enviar. Tente novamente.';
      setError(message);
      setSubmitting(false);
      return false;
    }
  }, [uid, isComplete, draft.captures]);

  return {
    stepIndex,
    currentStep,
    captures,
    isComplete,
    restoring,
    capturing,
    submitting,
    progress,
    error,
    cameraDenied,
    capture,
    retake,
    goToStep,
    submit,
  };
}