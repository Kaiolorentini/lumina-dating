// ============================================
// LUMINA — REGISTRO DA ECONOMIA v2
// functions/src/utils/auditLogFinanceiro.ts
//
// REGRA 15: toda movimentação de CRISTAIS e FRAGMENTOS gera um
// registro em walletAuditLogs, dentro da transação que moveu.
//
// v2 (28/09):
// - Cobre as DUAS moedas. Cada tipo declara moeda e categoria, e o
//   snapshot diário (inflationMonitor) agrega por elas.
// - Saldos antes/depois opcionais: vários caminhos só incrementam
//   sem ler o saldo.
// - Lista de tipos refeita: saíram 14 que não existiam no app;
//   entraram os reais que não registravam (diária, Faísca, Galáxia
//   Plus, Turbo, Fertilizante, Carta, árvore, níveis, missões,
//   Cofre, ranking, conquistas, conversão, badges).
// ============================================

import * as admin from 'firebase-admin';

export type Moeda = 'cristal' | 'fragmento';
export type AuditCategoria = 'compra' | 'recompensa' | 'gasto' | 'conversao' | 'estorno' | 'ajuste';
export type CoinTipo = 'gratuito' | 'premium' | 'mixed';

export type AuditTipo =
  // Cristais — entradas
  | 'COMPRA_ASAAS'
  | 'GALAXIA_PLUS_ATIVACAO'
  | 'WELCOME_BONUS'
  | 'LOGIN_DIARIO'
  | 'FAISCA_DESTINO'
  | 'MISSAO_ESPECIAL'
  | 'ARVORE_RECOMPENSA'
  | 'NIVEL_RECOMPENSA'
  | 'FRAGMENTOS_CONVERSAO'
  | 'CARTA_DESTINO_ESTORNO'
  // Cristais — saídas
  | 'SPEND_COSMETICO'
  | 'SPEND_REVEAL_VISITORS'
  | 'SPEND_REVEAL_QUASE_SINTONIA'
  | 'SPEND_REVEAL_PENSOU_EM_VOCE'
  | 'SPEND_REVEAL_SINTONIA_PERDIDA'
  | 'SPEND_IMPULSO_PERFIL'
  | 'SPEND_DESTAQUE_REGIONAL'
  | 'SPEND_TURBO_SINTONIA'
  | 'SPEND_FERTILIZANTE'
  | 'SPEND_SEGUNDA_CHANCE'
  | 'SPEND_CARTA_DESTINO'
  | 'ESTORNO'
  | 'ADMIN_AJUSTE'
  // Fragmentos
  | 'FRAG_MISSAO'
  | 'FRAG_COFRE_DEPOSITO'
  | 'FRAG_NIVEL'
  | 'FRAG_RANKING'
  | 'FRAG_CONQUISTA'
  | 'FRAG_COLECAO'
  | 'FRAG_GALAXIA_PLUS'
  | 'FRAG_CONVERSAO'
  | 'FRAG_BADGE';

interface TipoInfo { moeda: Moeda; categoria: AuditCategoria }

export const AUDIT_TIPOS: Record<AuditTipo, TipoInfo> = {
  COMPRA_ASAAS:                  { moeda: 'cristal',   categoria: 'compra' },
  GALAXIA_PLUS_ATIVACAO:         { moeda: 'cristal',   categoria: 'compra' },
  WELCOME_BONUS:                 { moeda: 'cristal',   categoria: 'recompensa' },
  LOGIN_DIARIO:                  { moeda: 'cristal',   categoria: 'recompensa' },
  FAISCA_DESTINO:                { moeda: 'cristal',   categoria: 'recompensa' },
  MISSAO_ESPECIAL:               { moeda: 'cristal',   categoria: 'recompensa' },
  ARVORE_RECOMPENSA:             { moeda: 'cristal',   categoria: 'recompensa' },
  NIVEL_RECOMPENSA:              { moeda: 'cristal',   categoria: 'recompensa' },
  FRAGMENTOS_CONVERSAO:          { moeda: 'cristal',   categoria: 'conversao' },
  CARTA_DESTINO_ESTORNO:         { moeda: 'cristal',   categoria: 'estorno' },
  SPEND_COSMETICO:               { moeda: 'cristal',   categoria: 'gasto' },
  SPEND_REVEAL_VISITORS:         { moeda: 'cristal',   categoria: 'gasto' },
  SPEND_REVEAL_QUASE_SINTONIA:   { moeda: 'cristal',   categoria: 'gasto' },
  SPEND_REVEAL_PENSOU_EM_VOCE:   { moeda: 'cristal',   categoria: 'gasto' },
  SPEND_REVEAL_SINTONIA_PERDIDA: { moeda: 'cristal',   categoria: 'gasto' },
  SPEND_IMPULSO_PERFIL:          { moeda: 'cristal',   categoria: 'gasto' },
  SPEND_DESTAQUE_REGIONAL:       { moeda: 'cristal',   categoria: 'gasto' },
  SPEND_TURBO_SINTONIA:          { moeda: 'cristal',   categoria: 'gasto' },
  SPEND_FERTILIZANTE:            { moeda: 'cristal',   categoria: 'gasto' },
  SPEND_SEGUNDA_CHANCE:          { moeda: 'cristal',   categoria: 'gasto' },
  SPEND_CARTA_DESTINO:           { moeda: 'cristal',   categoria: 'gasto' },
  ESTORNO:                       { moeda: 'cristal',   categoria: 'estorno' },
  ADMIN_AJUSTE:                  { moeda: 'cristal',   categoria: 'ajuste' },
  FRAG_MISSAO:                   { moeda: 'fragmento', categoria: 'recompensa' },
  FRAG_COFRE_DEPOSITO:           { moeda: 'fragmento', categoria: 'recompensa' },
  FRAG_NIVEL:                    { moeda: 'fragmento', categoria: 'recompensa' },
  FRAG_RANKING:                  { moeda: 'fragmento', categoria: 'recompensa' },
  FRAG_CONQUISTA:                { moeda: 'fragmento', categoria: 'recompensa' },
  FRAG_COLECAO:                  { moeda: 'fragmento', categoria: 'recompensa' },
  FRAG_GALAXIA_PLUS:             { moeda: 'fragmento', categoria: 'compra' },
  FRAG_CONVERSAO:                { moeda: 'fragmento', categoria: 'conversao' },
  FRAG_BADGE:                    { moeda: 'fragmento', categoria: 'gasto' },
};

export interface AuditLogFinanceiroInput {
  uid:    string;
  tipo:   AuditTipo;
  /** positivo = entrada, negativo = saída — na moeda do tipo. */
  valor:  number;
  origem: string;
  coinTipo?: CoinTipo;
  saldoAnteriorGratuito?:  number;
  saldoAnteriorPremium?:   number;
  saldoPosteriorGratuito?: number;
  saldoPosteriorPremium?:  number;
  metadata?: Record<string, unknown>;
}

export async function auditLogFinanceiro(
  input: AuditLogFinanceiroInput,
  transaction?: admin.firestore.Transaction,
): Promise<void> {
  const db   = admin.firestore();
  const info = AUDIT_TIPOS[input.tipo];

  const logData = {
    uid:                    input.uid,
    tipo:                   input.tipo,
    moeda:                  info.moeda,
    categoria:              info.categoria,
    coinTipo:               input.coinTipo ?? null,
    valor:                  input.valor,
    origem:                 input.origem,
    saldoAnteriorGratuito:  input.saldoAnteriorGratuito  ?? null,
    saldoAnteriorPremium:   input.saldoAnteriorPremium   ?? null,
    saldoPosteriorGratuito: input.saldoPosteriorGratuito ?? null,
    saldoPosteriorPremium:  input.saldoPosteriorPremium  ?? null,
    metadata:               input.metadata ?? {},
    // REGRA 2: timestamp sempre server-side
    createdAt:              admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    const logRef = db.collection('walletAuditLogs').doc();
    if (transaction) {
      transaction.set(logRef, logData);
    } else {
      await logRef.set(logData);
    }
  } catch (error) {
    // O registro nunca derruba a operação principal.
    console.error('[auditLogFinanceiro] FALHA AO REGISTRAR:', {
      uid: input.uid, tipo: input.tipo, valor: input.valor, error,
    });
  }
}