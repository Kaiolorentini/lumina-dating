import * as admin from "firebase-admin";

const ADMIN_METRICS_DOC = "adminMetrics/main";

export async function incrementMetric(
  field: string,
  value: number = 1
): Promise<void> {
  try {
    await admin.firestore().doc(ADMIN_METRICS_DOC).set(
      {
        [field]:   admin.firestore.FieldValue.increment(value),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn(`[incrementMetric] Falha ao incrementar ${field}:`, error);
  }
}

export async function incrementMetrics(
  updates: Record<string, number>
): Promise<void> {
  try {
    const data: Record<string, admin.firestore.FieldValue> = {};
    for (const [field, value] of Object.entries(updates)) {
      data[field] = admin.firestore.FieldValue.increment(value);
    }
    // updatedAt sempre: os Relatórios mostravam "Atualizado:" vazio.
    data.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await admin.firestore().doc(ADMIN_METRICS_DOC).set(data, { merge: true });
  } catch (error) {
    console.warn("[incrementMetrics] Falha:", error);
  }
}