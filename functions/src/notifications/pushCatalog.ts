// ============================================
// LUMINA — CATÁLOGO DE PUSH DO CLIENTE
// functions/src/notifications/pushCatalog.ts
//
// O cliente diz apenas QUAL EVENTO aconteceu e com QUEM. O
// texto sai daqui, no servidor.
//
// Antes o app montava título e corpo e chamava a API do Expo
// direto: qualquer conta logada mandava "Você ganhou 500
// cristais, toque aqui" com o nome do Lumina para qualquer
// pessoa. As rules já bloqueavam isso na notificação in-app;
// o push, que é mais visível, seguia aberto.
//
// MENSAGEM DE CHAT SEM O TEXTO: push aparece na tela
// bloqueada, e conversa privada não vaza ali. Só o nome de
// quem mandou.
// ============================================

export type PushEvent = "chat_message" | "connection_request" | "connection_accepted";

export const PUSH_EVENTS: PushEvent[] = [
  "chat_message",
  "connection_request",
  "connection_accepted",
];

export interface PushContent {
  title: string;
  body: string;
  /** type usado pelo AppNavigator para decidir a navegação. */
  type: string;
  /** true exige conexão aceita entre remetente e destinatário. */
  requiresConnection: boolean;
}

/**
 * @param actorName nome de quem disparou, lido do SERVIDOR —
 *   nunca do payload do cliente, senão o texto volta a ser
 *   escolhido por ele.
 */
export function buildPushContent(event: PushEvent, actorName: string): PushContent {
  const name = actorName.trim() || "Alguém";

  switch (event) {
    case "chat_message":
      return {
        title: name,
        body: "enviou uma mensagem",
        type: "message",
        requiresConnection: true,
      };

    case "connection_request":
      return {
        title: "Nova solicitação",
        body: `${name} quer se conectar com você`,
        type: "request",
        // Solicitação acontece ANTES da conexão existir.
        requiresConnection: false,
      };

    case "connection_accepted":
      return {
        title: "Solicitação aceita",
        body: `${name} aceitou sua solicitação. Comece a conversar.`,
        type: "request_accepted",
        requiresConnection: true,
      };
  }
}