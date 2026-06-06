// ============================================
// USER TYPES — MARKETPLACE
//
// Separado de UserProfile (src/shared/types/index.ts).
// NÃO importar de shared/types/index.ts aqui.
// ============================================

export type UserRole = 'user' | 'creator' | 'admin' | 'superadmin';

// ============================================
// ASAAS ACCOUNT — adicionado para onboarding
// ============================================
export type AsaasAccountStatus =
  | 'not_configured'
  | 'pending'
  | 'verified'
  | 'error';

// ============================================
// SCREENSHOT PROTECTION — DRM iOS
// ============================================
export type ScreenshotWarningStatus =
  | 'clean'       // nunca tirou print
  | 'warned_1'    // 1 print — aviso de política
  | 'warned_2'    // 2 prints — última oportunidade
  | 'final'       // 3 prints — próximo = banimento
  | 'flagged';    // 4 prints — aguardando decisão admin

export interface UserPermissions {
  uid: string;
  role: UserRole;
  isBlocked: boolean;
  blockedReason?: string;
  blockedAt?: Date;
  blockedBy?: string;
  acceptedMarketplaceTermsVersion?: string;
  acceptedMarketplaceTermsAt?: Date;

  // ============================================
  // CAMPOS ASAAS — recebimento automático
  // ============================================
  asaasWalletId?: string;
  asaasAccountVerified?: boolean;
  asaasAccountVerifiedAt?: Date;
  asaasAccountStatus?: AsaasAccountStatus;
  asaasAccountType?: 'cpf' | 'cnpj';
  asaasSubaccountId?: string;

  // ============================================
  // SCREENSHOT PROTECTION — DRM iOS
  // ============================================
  screenshotWarnings?: number;              // contador 0-4
  screenshotWarningStatus?: ScreenshotWarningStatus;
  screenshotWarningProductId?: string;      // último produto fotografado
  screenshotWarningAt?: Date;               // último print registrado
}