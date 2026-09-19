// ============================================
// LUMINA — ENVIO VIA EXPO
// functions/src/utils/expoPush.ts
//
// Ponto único de envio. Extraído do notifyUser para o
// sendUserPush não ter uma segunda cópia da chamada.
//
// A API do Expo responde 200 MESMO QUANDO REJEITA o envio: o
// erro vem no corpo, em data.status === 'error'. O notifyUser
// antigo ignorava a resposta e imprimia "Notificado" de todo
// jeito — uma investigação de push não chegado custou horas
// por causa disso.
// ============================================

const EXPO_ENDPOINT = "https://exp.host/--/api/v2/push/send";

export interface ExpoSendResult {
  sent: boolean;
  /** Código do Expo quando falha: DeviceNotRegistered, MessageTooBig… */
  errorCode: string | null;
  message: string | null;
}

interface ExpoTicket {
  status?: string;
  message?: string;
  details?: { error?: string };
}

export async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<ExpoSendResult> {
  try {
    const response = await fetch(EXPO_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data,
        sound: "default",
        priority: "high",
      }),
    });

    if (!response.ok) {
      return {
        sent: false,
        errorCode: `HTTP_${response.status}`,
        message: `Expo respondeu ${response.status}`,
      };
    }

    const json = (await response.json()) as { data?: ExpoTicket | ExpoTicket[] };
    const ticket = Array.isArray(json.data) ? json.data[0] : json.data;

    if (ticket?.status === "error") {
      const errorCode = ticket.details?.error ?? "UNKNOWN";
      console.warn(`[expoPush] Recusado (${errorCode}): ${ticket.message ?? ""}`);
      return { sent: false, errorCode, message: ticket.message ?? null };
    }

    return { sent: true, errorCode: null, message: null };
  } catch (error) {
    console.warn("[expoPush] Falha na requisição:", error);
    return {
      sent: false,
      errorCode: "REQUEST_FAILED",
      message: error instanceof Error ? error.message : null,
    };
  }
}