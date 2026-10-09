// ============================================
// ASAAS CLIENT — UTILITÁRIO CENTRALIZADO
//
// Todas as chamadas à API Asaas passam por aqui.
// Nunca importar axios diretamente nas functions.
//
// 09/10/2026 — troca para produção:
//  • ASAAS_ENVIRONMENT agora é lido com trim/minúsculas e valor
//    desconhecido FALHA em vez de cair em silêncio no sandbox
//    ("Production" com P maiúsculo usava o sandbox com a chave de
//    produção e toda compra dava "API Key inválida").
//  • Chave e ambiente precisam combinar: chave de produção
//    ($aact_prod_…) com ambiente sandbox, ou chave de homologação
//    ($aact_hmlg_…) com ambiente produção, é recusada antes de
//    qualquer chamada. Chaves no formato antigo não são checadas.
//  • O ambiente é registrado no log uma vez por instância (nunca
//    a chave).
//  • Notificações do Asaas DESLIGADAS no cliente (notificationDisabled).
//    Com elas ligadas, o Asaas mandava e-mail/SMS de cada cobrança e
//    descontava R$ 0,99 por pagamento — o app já mostra o Pix e
//    avisa por notificação própria. Cliente antigo com notificação
//    ligada é atualizado na próxima compra.
// ============================================

import axios, { AxiosInstance, AxiosError } from "axios";
import { HttpsError } from "firebase-functions/v2/https";

export type AsaasEnvironment = "sandbox" | "production";

let environmentLogged = false;

/** Ambiente configurado no secret ASAAS_ENVIRONMENT. Vazio continua
 *  sendo sandbox (comportamento de antes); valor desconhecido é erro
 *  de configuração. */
export function getAsaasEnvironment(): AsaasEnvironment {
  const raw = (process.env.ASAAS_ENVIRONMENT ?? "").trim().toLowerCase();
  if (raw === "production") return "production";
  if (raw === "" || raw === "sandbox") return "sandbox";
  console.error("[Asaas] ASAAS_ENVIRONMENT inválido — use 'sandbox' ou 'production'.", { value: raw.slice(0, 20) });
  throw new HttpsError("failed-precondition", "Pagamentos indisponíveis no momento. Tente mais tarde.");
}

// URL base de cada ambiente (docs.asaas.com → "Comece por aqui").
// CORREÇÃO 09/10/2026: produção é https://api.asaas.com/v3 — SEM o
// "/api". O endereço antigo (api.asaas.com/api/v3) não existe: toda
// chamada voltava 404 e o app mostrava "Recurso não encontrado no
// Asaas" ao gerar o Pix. Só aparecia em produção porque o sandbox
// usa outro endereço, que continua igual (o atual oficial do
// sandbox é https://api-sandbox.asaas.com/v3; o antigo segue ativo).
function getBaseUrl(): string {
  return getAsaasEnvironment() === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";
}

function getApiKey(): string {
  const key = (process.env.ASAAS_API_KEY ?? "").trim();
  if (!key) throw new HttpsError("internal", "ASAAS_API_KEY não configurada");

  const env = getAsaasEnvironment();
  const isProdKey = key.startsWith("$aact_prod_");
  const isTestKey = key.startsWith("$aact_hmlg_");
  if ((env === "production" && isTestKey) || (env === "sandbox" && isProdKey)) {
    console.error(`[Asaas] Chave e ambiente não combinam (ambiente=${env}, chave de ${isProdKey ? "produção" : "sandbox"}).`);
    throw new HttpsError("failed-precondition", "Pagamentos indisponíveis no momento. Tente mais tarde.");
  }

  if (!environmentLogged) {
    environmentLogged = true;
    console.info(`[Asaas] ambiente: ${env}`);
  }
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
  notificationDisabled?: boolean;
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
      const needsCpf = !existing.cpfCnpj && !!params.cpfCnpj;
      // Cliente criado antes desta correção: notificações ainda ligadas
      // (R$ 0,99 por cobrança). Desliga junto, na mesma atualização.
      const needsMute = existing.notificationDisabled !== true;

      if (needsCpf || needsMute) {
        try {
          const updated = await client.post(`/customers/${existing.id}`, {
            ...(needsCpf && { cpfCnpj: params.cpfCnpj }),
            notificationDisabled: true,
          });
          return updated.data as AsaasCustomer;
        } catch (updateError) {
          // Sem CPF a cobrança não funciona — falhar de forma clara é melhor
          // do que retornar um customer que causará erro no pagamento.
          if (needsCpf) handleAsaasError(updateError, "findOrCreateCustomer:update");
          // Só a notificação falhou: a compra segue (custo, não erro).
          console.warn("[Asaas] não foi possível desligar as notificações do cliente", existing.id);
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
      // O app mostra o Pix e avisa por notificação própria; o e-mail/SMS
      // do Asaas custaria R$ 0,99 por cobrança paga.
      notificationDisabled: true,
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

    // Busca QR Code Pix. O Asaas às vezes ainda não gerou a imagem
    // no instante seguinte à criação da cobrança — uma segunda
    // tentativa após 1,2s resolve a maioria dos casos. Sem ela o
    // app recebia encodedImage vazio e ficava com o spinner girando.
    let pixData = await client.get(`/payments/${paymentId}/pixQrCode`);

    if (!pixData.data?.encodedImage) {
      await new Promise(r => setTimeout(r, 1200));
      pixData = await client.get(`/payments/${paymentId}/pixQrCode`);
    }

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
