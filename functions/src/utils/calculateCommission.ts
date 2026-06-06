export function calculateCommission(
  amount: number,
  commissionRate: number = 0.20
): { platformCommission: number; sellerAmount: number } {
  const platformCommission = Math.round(amount * commissionRate * 100) / 100;
  const sellerAmount = Math.round((amount - platformCommission) * 100) / 100;
  return { platformCommission, sellerAmount };
}