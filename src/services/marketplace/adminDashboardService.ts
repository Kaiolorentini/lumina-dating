// ============================================
// LUMINA — SERVIÇOS DO PAINEL ADMIN
// src/services/marketplace/adminDashboardService.ts
//
// Chamadas às funções do painel: pendentes e métricas
// (getAdminDashboard), conferência de saque (getWithdrawalReview) e
// as ações de reembolso manual.
// ============================================

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../core/firebase';

export interface AdminPendingCounts {
  ageVerifications: number;
  creatorRequests:  number;
  products:         number;
  withdrawals:      number;
  refunds:          number;
  fraud:            number;
  support:          number;
}

export interface AdminDashboardMetrics {
  totalSales:                number;
  monthlyMarketplaceSales:   number;
  monthlyCoinsSales:         number;
  monthlyRevenue:            number;
  monthlyCoinsRevenue:       number;
  monthlyMarketplaceRevenue: number;
  totalCommission:           number;
  monthlyCommission:         number;
  monthlyRefundedAmount:     number;
  monthlyRefundsApproved:    number;
  monthlyChargebacks:        number;
  totalWithdrawn:            number;
  refundRequestsMonth:       number;
  activeProducts:            number;
  creators:                  number;
  updatedAt:                 string | null;
}

export interface AdminDashboardData {
  pending:      AdminPendingCounts;
  totalPending: number;
  metrics:      AdminDashboardMetrics;
}

export interface WithdrawalReview {
  withdrawal: {
    id: string; amount: number; status: string;
    pixKey: string | null; pixType: string | null; createdAt: string | null;
  };
  creator:           { uid: string; name: string };
  currentPixKey:     string | null;
  currentPixKeyType: string | null;
  keyMatches:        boolean;
  wallet: {
    available: number; pending: number; debt: number;
    totalEarned: number; totalWithdrawn: number; chargebackPending: boolean;
  };
  afterWithdrawal: number;
  reconciliation: {
    creditedSales: number; earned: number; withdrawn: number;
    expected: number; actual: number; diff: number; alert: boolean;
  };
}

function fns() {
  return getFunctions(app, 'us-central1');
}

export async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  const result = await httpsCallable<void, AdminDashboardData>(fns(), 'getAdminDashboard')();
  return result.data;
}

export async function fetchWithdrawalReview(withdrawalId: string): Promise<WithdrawalReview> {
  const result = await httpsCallable<{ withdrawalId: string }, WithdrawalReview>(
    fns(), 'getWithdrawalReview',
  )({ withdrawalId });
  return result.data;
}

/** Chama uma função de admin e devolve só o sucesso (o erro sobe com a mensagem do servidor). */
export async function callAdminAction(name: string, params: Record<string, unknown>): Promise<void> {
  await httpsCallable(fns(), name)(params);
}

export function formatBRL(v: number | undefined | null): string {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

export const PIX_TYPE_LABEL: Record<string, string> = {
  cpf: 'CPF', email: 'E-mail', phone: 'Telefone', random: 'Chave aleatória',
  telefone: 'Telefone', chave: 'Chave aleatória', cnpj: 'CNPJ',
};