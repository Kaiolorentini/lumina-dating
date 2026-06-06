import * as admin from "firebase-admin";
import { Request } from "firebase-functions/v2/https";

interface AuditLogInput {
  action: string;
  performedBy: string;
  targetId: string;
  targetType: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const ip = input.req
      ? (input.req.headers["x-forwarded-for"] as string)
          ?.split(",")[0]
          ?.trim() ?? input.req.ip ?? "unknown"
      : "cloud-function";

    await admin.firestore().collection("auditLogs").add({
      action: input.action,
      performedBy: input.performedBy,
      targetId: input.targetId,
      targetType: input.targetType,
      metadata: input.metadata ?? {},
      ip,
      platform: "cloud-function",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.warn("[auditLog] Falha ao registrar:", error);
  }
}