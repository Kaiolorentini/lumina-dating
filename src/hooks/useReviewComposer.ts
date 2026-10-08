// ============================================
// useReviewComposer — HOOK
// src/hooks/useReviewComposer.ts
//
// Fluxo de "Avaliar" compartilhado pelo detalhe do produto e por
// Minhas Compras:
//   open(productId) → confere se pode avaliar (compra ativa e
//   conteúdo já aberto) e busca a avaliação atual para edição —
//   2 leituras, só no toque; abre o modal.
//   submit(nota, comentário) → CF submitProductReview.
//
// Quem chama renderiza <ReviewFormModal {...modalProps} />.
// Protegido contra resposta depois de desmontar (mountedRef).
// ============================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  getMyReview, getReviewEligibility, submitReview,
} from '../services/marketplace/reviewService';
import { ReviewRating, SubmitReviewResult } from '../shared/types/marketplace/review.types';

interface Options {
  /** Chamado depois de salvar — para recarregar lista e média. */
  onSubmitted?: (productId: string, result: SubmitReviewResult) => void;
}

interface ModalProps {
  visible: boolean;
  productTitle?: string;
  initialRating: number;
  initialComment: string;
  isEdit: boolean;
  submitting: boolean;
  onSubmit: (rating: ReviewRating, comment: string) => void;
  onClose: () => void;
}

export function useReviewComposer(userId: string | undefined, options: Options = {}) {
  const [target, setTarget]         = useState<{ productId: string; title?: string } | null>(null);
  const [initialRating, setRating]  = useState(0);
  const [initialComment, setComment] = useState('');
  const [isEdit, setIsEdit]         = useState(false);
  const [openingId, setOpeningId]   = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const mountedRef   = useRef(true);
  const onSubmitted  = useRef(options.onSubmitted);
  onSubmitted.current = options.onSubmitted;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const open = useCallback(async (productId: string, productTitle?: string) => {
    if (!userId || openingId) return;
    setOpeningId(productId);
    try {
      const [eligibility, mine] = await Promise.all([
        getReviewEligibility(userId, productId),
        getMyReview(productId, userId),
      ]);
      if (!mountedRef.current) return;

      if (eligibility === 'not_buyer') {
        Alert.alert('Avaliação', 'Só quem comprou este conteúdo pode avaliar.');
        return;
      }
      if (eligibility === 'not_viewed') {
        Alert.alert(
          'Abra o conteúdo primeiro',
          'Você pode avaliar depois de abrir o conteúdo pelo menos uma vez, em "📂 Abrir conteúdo".',
        );
        return;
      }

      setRating(mine?.rating ?? 0);
      setComment(mine?.comment ?? '');
      setIsEdit(!!mine);
      setTarget({ productId, title: productTitle });
    } catch (error) {
      console.error('[useReviewComposer] open falhou:', error);
      if (mountedRef.current) {
        Alert.alert('Erro', 'Não foi possível abrir a avaliação. Verifique a conexão e tente de novo.');
      }
    } finally {
      if (mountedRef.current) setOpeningId(null);
    }
  }, [userId, openingId]);

  const close = useCallback(() => {
    if (submitting) return;
    setTarget(null);
  }, [submitting]);

  const submit = useCallback(async (rating: ReviewRating, comment: string) => {
    if (!target || submitting) return;
    setSubmitting(true);
    try {
      const result = await submitReview(target.productId, rating, comment);
      if (!mountedRef.current) return;
      setTarget(null);
      Alert.alert(
        result.isNew ? '⭐ Obrigado!' : '✅ Avaliação atualizada',
        result.isNew
          ? 'Sua avaliação ajuda outras pessoas a escolher.'
          : 'Sua nova nota já vale para a média do produto.',
      );
      onSubmitted.current?.(target.productId, result);
    } catch (error) {
      if (mountedRef.current) {
        Alert.alert('Não foi possível enviar', (error as Error).message);
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [target, submitting]);

  const modalProps: ModalProps = {
    visible:        target !== null,
    productTitle:   target?.title,
    initialRating,
    initialComment,
    isEdit,
    submitting,
    onSubmit:       submit,
    onClose:        close,
  };

  return {
    open,
    /** productId sendo aberto agora (spinner no botão). */
    openingId,
    modalProps,
  };
}
