// ============================================
// LUMINA — TAXAS DE PAGAMENTO
// functions/src/config/paymentFees.ts
//
// Taxa que o Asaas desconta por Pix RECEBIDO (tabela padrão, fora da
// promoção dos 3 primeiros meses). Usada na métrica "Taxa Pix Asaas"
// do Painel Admin (pedido de Kaio, 09/10/2026).
//
// Se o Asaas mudar a tarifa ou o contrato tiver outro valor, troque
// SÓ aqui. A métrica conta a partir do deploy: Pix anteriores não
// entram.
// ============================================

export const ASAAS_PIX_FEE = 1.99;
