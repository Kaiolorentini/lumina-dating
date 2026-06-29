// ============================================
// LUMINA — PURCHASE SERVICE v5.1
// src/modules/economy/services/purchaseService.ts
//
// REGRA 1: Nenhuma compra creditada client-side.
// Crédito real: onAsaasWebhook (Cloud Function).
//
// CORREÇÃO: Removido import de ../../../functions/
// (pasta backend não pode ser importada no client)
// Pacotes definidos localmente para exibição apenas.
// ============================================

import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

// Pacotes apenas para exibição na UI
// Preços e totais reais ficam em functions/src/config/economy.ts
// Cliente nunca credita — apenas inicia o fluxo de pagamento
export interface CoinPackageDisplay {
  id:                 string;
  label:              string;
  coinsPremium:       number;
  bonus:              number;
  total:              number;
  priceValue:         number;
  priceLabel:         string;
  highlighted?:       boolean;
  packAsset:          string;
  isFirstPurchasePkg: boolean;
}

export const COIN_PACKAGES_DISPLAY: CoinPackageDisplay[] = [
  {
    id:                 'starter',
    label:              'Iniciante',
    coinsPremium:       100,
    bonus:              0,
    total:              100,   // +100 na 1ª compra → 200 (backend calcula)
    priceValue:         4.99,
    priceLabel:         'R$ 4,99',
    packAsset:          'pack-iniciante',
    isFirstPurchasePkg: true,
  },
  {
    id:                 'popular',
    label:              'Popular',
    coinsPremium:       500,
    bonus:              100,
    total:              600,
    priceValue:         19.99,
    priceLabel:         'R$ 19,99',
    highlighted:        true,
    packAsset:          'pack-popular',
    isFirstPurchasePkg: false,
  },
  {
    id:                 'supremo',
    label:              'Supremo',
    coinsPremium:       1000,
    bonus:              500,
    total:              1500,
    priceValue:         39.99,
    priceLabel:         'R$ 39,99',
    packAsset:          'pack-supremo',
    isFirstPurchasePkg: false,
  },
  {
    id:                 'galaxia',
    label:              'Galáxia',
    coinsPremium:       4000,
    bonus:              2000,
    total:              6000,
    priceValue:         99.99,
    priceLabel:         'R$ 99,99',
    packAsset:          'pack-galaxia',
    isFirstPurchasePkg: false,
  },
];

// Inicia pagamento via Asaas
// O crédito só acontece quando webhook confirmar
export async function initiatePurchase(packageId: string): Promise<{
  success:      boolean;
  checkoutUrl?: string;
  error?:       string;
}> {
  try {
    const fn = httpsCallable<
      { packageId: string },
      { success: boolean; checkoutUrl?: string; error?: string }
    >(functions, 'createAsaasPayment');

    const result = await fn({ packageId });
    return result.data;
  } catch (error: unknown) {
    console.error('[purchaseService] initiatePurchase error:', error);
    return { success: false, error: 'Erro ao iniciar pagamento.' };
  }
}