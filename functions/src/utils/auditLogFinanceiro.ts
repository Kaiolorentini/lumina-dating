// ============================================
// LUMINA — AUDIT LOG FINANCEIRO
// functions/src/utils/auditLogFinanceiro.ts
//
// REGRA 15: Toda movimentação de cristais
// gera auditLog com uid, tipo, valor, origem,
// saldo anterior, saldo posterior e timestamp.
// Sem exceções.
// ============================================

import * as admin from 'firebase-admin';

export type AuditTipo =
  // Entradas gratuitas
  | 'LOGIN_DIARIO'
  | 'FAISCA_DESTINO'
  | 'MISSAO_COMPLETA'
  | 'CONQUISTA'
  | 'COFRE_SAQUE'
  | 'FRAGMENTOS_CONVERSAO'
  | 'WELCOME_BONUS'
  | 'PRESTIGIO_BONUS'
  // Entradas premium
  | 'COMPRA_ASAAS'
  | 'GALAXIA_PLUS_MENSAL'
  | 'FIRST_PURCHASE_BONUS'
  // Saídas
  | 'SPEND_REVEAL_VISITORS'
  | 'SPEND_QUASE_SINTONIA'
  | 'SPEND_SINTONIA_PERDIDA'
  | 'SPEND_MYSTERY_MATCH'
  | 'SPEND_PENSOU_EM_VOCE'
  | 'SPEND_IMPULSO_PERFIL'
  | 'SPEND_DESTAQUE_REGIONAL'
  | 'SPEND_MEGA_DESTAQUE'
  | 'SPEND_TURBO_SINTONIA'
  | 'SPEND_PERFIL_GALAXIA'
  | 'SPEND_SEGUNDA_CHANCE'
  | 'SPEND_ENERGIA'
  | 'SPEND_FERTILIZANTE'
  | 'SPEND_MERCADO_COSMICO'
  // Sistema
  | 'ADMIN_AJUSTE'
  | 'ESTORNO';

export type CoinTipo = 'gratuito' | 'premium' | 'mixed';

export interface AuditLogFinanceiroInput {
  uid: string;
  tipo: AuditTipo;
  coinTipo: CoinTipo;
  valor: number;                    // positivo = ganho, negativo = gasto
  origem: string;                   // ex: 'dailyFaisca', 'asaasWebhook'
  saldoAnteriorGratuito: number;
  saldoAnteriorPremium: number;
  saldoPosteriorGratuito: number;
  saldoPosteriorPremium: number;
  metadata?: Record<string, unknown>;
}

export async function auditLogFinanceiro(
  input: AuditLogFinanceiroInput,
  transaction?: admin.firestore.Transaction
): Promise<void> {
  const db = admin.firestore();

  const logData = {
    uid:                      input.uid,
    tipo:                     input.tipo,
    coinTipo:                 input.coinTipo,
    valor:                    input.valor,
    origem:                   input.origem,
    saldoAnteriorGratuito:    input.saldoAnteriorGratuito,
    saldoAnteriorPremium:     input.saldoAnteriorPremium,
    saldoPosteriorGratuito:   input.saldoPosteriorGratuito,
    saldoPosteriorPremium:    input.saldoPosteriorPremium,
    metadata:                 input.metadata ?? {},
    // REGRA 2: timestamp sempre server-side
    createdAt:                admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    const logRef = db.collection('walletAuditLogs').doc();

    if (transaction) {
      // Dentro de uma transaction existente
      transaction.set(logRef, logData);
    } else {
      // Fora de transaction (casos raros — ex: log de erro)
      await logRef.set(logData);
    }
  } catch (error) {
    // Log nunca deve quebrar a operação principal
    // mas sempre registra o erro para investigação
    console.error('[auditLogFinanceiro] FALHA AO REGISTRAR:', {
      uid: input.uid,
      tipo: input.tipo,
      valor: input.valor,
      error,
    });
  }
}