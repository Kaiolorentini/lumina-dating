// ============================================
// LUMINA — PURCHASE SERVICE v5.3
// src/modules/economy/services/purchaseService.ts
//
// v5.3: initiatePurchase recebe o CPF do chamador.
// O CPF é pedido no momento da compra (CpfPromptModal),
// trafega app → Cloud Function → Asaas e NÃO é persistido
// em lugar nenhum. LGPD, minimização (Art. 6º, III).
//
// v5.2: initiatePurchase chama createCoinsPurchase
// (CF dedicada para cristais) em vez de createAsaasPayment
// (CF do marketplace de produtos).
// ============================================

import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

// Pacotes apenas para exibição na UI
// Preços e totais reais ficam no backend (createCoinsPurchase.ts)
// Cliente NUNCA credita — apenas inicia o fluxo de pagamento
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
    total:              100,
    priceValue:         5.00,
    priceLabel:         'R$ 5,00',
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

// Retorna { saleId, checkoutUrl, pixQrCode, pixCopyPaste }
// para navegar ao CheckoutScreen existente.
export async function initiatePurchase(
  packageId: string,
  cpf: string,
): Promise<{
  success:       boolean;
  saleId?:       string;
  checkoutUrl?:  string;
  pixQrCode?:    string;
  pixCopyPaste?: string;
  error?:        string;
}> {
  try {
    // CPF trafega app → CF → Asaas e não é persistido em lugar nenhum.
    const fn = httpsCallable<
      { packageId: string; cpf: string },
      { saleId: string; checkoutUrl: string; pixQrCode: string; pixCopyPaste: string }
    >(functions, 'createCoinsPurchase');

    const result = await fn({ packageId, cpf });
    return {
      success:      true,
      saleId:       result.data.saleId,
      checkoutUrl:  result.data.checkoutUrl,
      pixQrCode:    result.data.pixQrCode,
      pixCopyPaste: result.data.pixCopyPaste,
    };
  } catch (error: unknown) {
    // HttpsError do backend traz mensagem acionável (CPF inválido,
    // pendência de chargeback, pacote inexistente). Descartá-la
    // deixaria o usuário sem saber o que corrigir.
    const message = error instanceof Error && error.message
      ? error.message
      : 'Erro ao iniciar pagamento.';
    console.error('[purchaseService] initiatePurchase error:', message);
    return { success: false, error: message };
  }
}