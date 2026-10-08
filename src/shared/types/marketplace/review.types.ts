// ============================================
// REVIEW TYPES — MARKETPLACE
//
// reviewId = userId + '_' + productId
// Gravado SÓ pela CF submitProductReview (functions/src/products/
// productReviews.ts). Conta excluída: id e userId viram anon_<hash>
// e userName "Usuário removido".
// ============================================

export type ReviewRating = 1 | 2 | 3 | 4 | 5;

export interface ProductReview {
  /** Id do documento — chave da lista e alvo da moderação. */
  id: string;
  productId: string;
  userId: string;
  /** Primeiro nome do comprador no momento da avaliação. */
  userName?: string;
  rating: ReviewRating;
  /** Opcional: pode vir vazio. */
  comment: string;
  /** Comentário oculto pela moderação. A nota continua na média. */
  isHidden: boolean;
  hiddenReason?: string;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Quem pode avaliar: comprador ativo que já abriu o conteúdo. */
export type ReviewEligibility = 'ok' | 'not_buyer' | 'not_viewed';

export interface SubmitReviewResult {
  success: boolean;
  isNew: boolean;
  averageRating: number;
  reviewsCount: number;
}
