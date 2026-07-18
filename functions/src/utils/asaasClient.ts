// ============================================
// ASAAS CLIENT — UTILITÁRIO CENTRALIZADO
//
// Todas as chamadas à API Asaas passam por aqui.
// Nunca importar axios diretamente nas functions.
// ============================================

import axios, { AxiosInstance, AxiosError } from "axios";
import { HttpsError } from "firebase-functions/v2/https";

function getBaseUrl(): string {
  const env = process.env.ASAAS_ENVIRONMENT ?? "sandbox";
  return env === "production"
    ? "https://api.asaas.com/api/v3"
    : "https://sandbox.asaas.com/api/v3";
}

function getApiKey(): string {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new HttpsError("internal", "ASAAS_API_KEY não configurada");
  return key;
}

function createClient(): AxiosInstance {
  return axios.create({
    baseURL: getBaseUrl(),
    headers: {
      access_token: getApiKey(),
      "Content-Type": "application/json",
    },
    timeout: 15000,
  });
}

function handleAsaasError(error: unknown, context: string): never {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error(`[Asaas:${context}] status=${status}`, JSON.stringify(data));

    if (status === 401) {
      throw new HttpsError("permission-denied", "API Key Asaas inválida");
    }
    if (status === 404) {
      throw new HttpsError("not-found", "Recurso não encontrado no Asaas");
    }
    if (status === 400) {
      const msg = data?.errors?.[0]?.description ?? "Requisição inválida ao Asaas";
      throw new HttpsError("invalid-argument", msg);
    }
    throw new HttpsError("internal", `Erro Asaas: ${data?.errors?.[0]?.description ?? error.message}`);
  }
  throw new HttpsError("internal", `Erro inesperado em ${context}`);
}

// ============================================
// CUSTOMERS
// ============================================

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
}

export async function findOrCreateCustomer(params: {
  name: string;
  email: string;
  cpfCnpj?: string;
  externalReference: string;
}): Promise<AsaasCustomer> {
  const client = createClient();

  try {
    // Busca por email primeiro
    const search = await client.get("/customers", {
      params: { email: params.email, limit: 1 },
    });

    if (search.data.data?.length > 0) {
      const existing = search.data.data[0] as AsaasCustomer;

      // PREVENÇÃO (auditoria): um customer pode ter sido criado ANTES do
      // usuário ter CPF (ficando sem cpfCnpj no Asaas). Nesse caso, toda
      // cobrança falha com "necessário preencher o CPF ou CNPJ".
      // Se encontramos um customer sem cpfCnpj E agora temos um CPF válido
      // para informar, ATUALIZAMOS o customer no Asaas antes de reutilizá-lo.
      if (!existing.cpfCnpj && params.cpfCnpj) {
        try {
          const updated = await client.post(`/customers/${existing.id}`, {
            cpfCnpj: params.cpfCnpj,
          });
          return updated.data as AsaasCustomer;
        } catch (updateError) {
          // Sem CPF a cobrança não funciona — falhar de forma clara é melhor
          // do que retornar um customer que causará erro no pagamento.
          handleAsaasError(updateError, "findOrCreateCustomer:update");
        }
      }

      return existing;
    }

    // Cria novo customer
    const create = await client.post("/customers", {
      name: params.name,
      email: params.email,
      cpfCnpj: params.cpfCnpj,
      externalReference: params.externalReference,
      notificationDisabled: false,
    });

    return create.data as AsaasCustomer;
  } catch (error) {
    handleAsaasError(error, "findOrCreateCustomer");
  }
}

// ============================================
// PAYMENTS — PIX
// ============================================

export interface AsaasPixPayment {
  id: string;
  status: string;
  invoiceUrl: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
}

export async function createPixPayment(params: {
  customerId: string;
  value: number;
  description: string;
  externalReference: string;
  dueDate: string; // YYYY-MM-DD
}): Promise<AsaasPixPayment> {
  const client = createClient();

  try {
    const payment = await client.post("/payments", {
      customer: params.customerId,
      billingType: "PIX",
      value: params.value,
      description: params.description,
      externalReference: params.externalReference,
      dueDate: params.dueDate,
    });

    const paymentId = payment.data.id as string;

    // Busca QR Code Pix
    const pixData = await client.get(`/payments/${paymentId}/pixQrCode`);

    return {
      id: paymentId,
      status: payment.data.status,
      invoiceUrl: payment.data.invoiceUrl ?? "",
      pixQrCode: pixData.data.encodedImage,
      pixCopyPaste: pixData.data.payload,
    };
  } catch (error) {
    handleAsaasError(error, "createPixPayment");
  }
}

// ============================================
// PAYMENTS — REFUND
// ============================================

export async function refundPayment(paymentId: string): Promise<void> {
  const client = createClient();
  try {
    await client.post(`/payments/${paymentId}/refund`);
  } catch (error) {
    handleAsaasError(error, "refundPayment");
  }
}

// ============================================
// WALLET / ACCOUNTS
// ============================================

export interface AsaasAccount {
  id: string;
  name: string;
  email: string;
  walletId: string;
}

export async function getAccount(walletId: string): Promise<AsaasAccount | null> {
  const client = createClient();
  try {
    const response = await client.get(`/accounts/${walletId}`);
    return response.data as AsaasAccount;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      return null;
    }
    handleAsaasError(error, "getAccount");
  }
}

// Data no formato Asaas: YYYY-MM-DD
export function formatDueDate(daysFromNow = 1): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split("T")[0];
}