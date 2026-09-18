// ============================================
// LUMINA — VERIFICAÇÃO DE IDADE, HOOK
// src/modules/verification/hooks/useAgeVerification.ts
//
// Guarda as três capturas em memória e sobe todas de uma
// vez no final, não a cada etapa.
//
// Por que no final: se a pessoa desistir na etapa 2,
// nenhuma imagem fica órfã no Storage — e imagem órfã de
// documento é justamente o que a LGPD manda evitar.
//
// O status não é lido aqui: ele vem do useUserPermissions,
// que escuta users/{uid} com onSnapshot. Assim a tela sai
// de "pendente" sozinha quando o admin aprova, sem polling.
// ============================================

import { useCallback, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  CapturedImage,
  captureVerificationImage,
  submitVerification,
  uploadVerificationImage,
} from '../services/verificationService';
import { VERIFICATION_STEPS, VerificationStep } from '../../../config/verification';

type Captures = Partial<Record<VerificationStep, CapturedImage>>;

interface UseAgeVerificationReturn {
  /** Índice da etapa atual em VERIFICATION_STEPS. */
  stepIndex: number;
  currentStep: VerificationStep;
  captures: Captures;
  /** true quando as três fotos foram tiradas. */
  isComplete: boolean;
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

export function useAgeVerification(): UseAgeVerificationReturn {
  const { user } = useAuth();

  const [stepIndex, setStepIndex] = useState(0);
  const [captures, setCaptures] = useState<Captures>({});
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);

  const currentStep = VERIFICATION_STEPS[stepIndex] ?? VERIFICATION_STEPS[0];
  const isComplete = VERIFICATION_STEPS.every(step => !!captures[step]);

  const capture = useCallback(async () => {
    setError(null);
    setCameraDenied(false);

    try {
      const image = await captureVerificationImage();
      if (!image) return; // usuário cancelou

      setCaptures(prev => ({ ...prev, [currentStep]: image }));

      // Avança sozinho, exceto na última: ali a pessoa
      // confere as três antes de enviar.
      setStepIndex(prev => Math.min(prev + 1, VERIFICATION_STEPS.length - 1));
    } catch (e) {
      if (e instanceof Error && e.message === 'CAMERA_DENIED') {
        setCameraDenied(true);
        setError('Precisamos da câmera para verificar seu documento.');
        return;
      }
      setError(e instanceof Error ? e.message : 'Não foi possível abrir a câmera.');
    }
  }, [currentStep]);

  const retake = useCallback((step: VerificationStep) => {
    setCaptures(prev => {
      const next = { ...prev };
      delete next[step];
      return next;
    });
    setStepIndex(VERIFICATION_STEPS.indexOf(step));
    setError(null);
  }, []);

  const goToStep = useCallback((index: number) => {
    if (index < 0 || index >= VERIFICATION_STEPS.length) return;
    setStepIndex(index);
    setError(null);
  }, []);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!user?.uid) {
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
      // Sequencial, não em paralelo: três uploads
      // simultâneos em rede móvel competem entre si e o
      // progresso fica sem sentido para quem está olhando.
      for (let i = 0; i < VERIFICATION_STEPS.length; i++) {
        const step = VERIFICATION_STEPS[i];
        const image = captures[step]!;

        await uploadVerificationImage(user.uid, step, image, percent => {
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

      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao enviar. Tente novamente.';
      setError(message);
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [user?.uid, isComplete, captures]);

  return {
    stepIndex,
    currentStep,
    captures,
    isComplete,
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