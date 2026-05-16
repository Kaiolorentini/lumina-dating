import { addCoins } from './walletService';

// ============================================
// PURCHASE SERVICE — MÓDULO ECONOMY
//
// Responsabilidade única:
// Simular compra de pacotes de moedas.
// Preparado para integração com gateway real.
// ============================================

export interface CoinPackage {
  id: string;
  coins: number;
  price: string;
  priceValue: number;
  label: string;
  bonus: number;
  icon: string;
  highlighted?: boolean;
}

export const COIN_PACKAGES: CoinPackage[] = [
  {
    id: 'starter',
    coins: 100,
    price: 'R$ 4,99',
    priceValue: 4.99,
    label: 'Iniciante',
    bonus: 0,
    icon: '💰',
  },
  {
    id: 'popular',
    coins: 500,
    price: 'R$ 19,99',
    priceValue: 19.99,
    label: 'Popular',
    bonus: 50,
    icon: '💎',
    highlighted: true,
  },
  {
    id: 'premium',
    coins: 1200,
    price: 'R$ 39,99',
    priceValue: 39.99,
    label: 'Premium',
    bonus: 200,
    icon: '👑',
  },
  {
    id: 'vip',
    coins: 3000,
    price: 'R$ 89,99',
    priceValue: 89.99,
    label: 'VIP',
    bonus: 800,
    icon: '✦',
  },
];

// Simula compra de moedas
// Aqui você integraria Stripe, PagSeguro, etc.
export async function purchaseCoins(
  userId: string,
  packageId: string
): Promise<boolean> {
  const pkg = COIN_PACKAGES.find(p => p.id === packageId);
  if (!pkg) return false;

  const totalCoins = pkg.coins + pkg.bonus;

  // ============================================
  // INTEGRAR GATEWAY AQUI:
  // const paymentResult = await stripe.charge(pkg.priceValue);
  // if (!paymentResult.success) return false;
  // ============================================

  await addCoins(
    userId,
    totalCoins,
    `${pkg.icon} Compra: ${pkg.label} (${totalCoins} moedas)`
  );

  return true;
}