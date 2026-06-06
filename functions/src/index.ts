import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions";

admin.initializeApp();

setGlobalOptions({
  maxInstances: 10,
  region: "us-central1",
});

// ============================================
// FASE 6A — Sem Asaas
// ============================================
export { onApproveCreator } from "./creators/onApproveCreator";
export { onRejectCreator } from "./creators/onRejectCreator";
export { onApproveProduct } from "./products/onApproveProduct";
export { onRejectProduct } from "./products/onRejectProduct";
export { releaseCreatorBalance } from "./wallet/releaseCreatorBalance";
export { createFreeProductPurchase } from "./payments/createFreeProductPurchase";
export { requestRefund } from "./payments/requestRefund";
export { rejectRefund } from "./payments/rejectRefund";

// DRM — Proteção de conteúdo iOS
export { reportScreenshot } from "./users/reportScreenshot";
export { banUserAfterScreenshot } from "./users/banUserAfterScreenshot";

// ============================================
// FASE 10 — Admin + SuperAdmin
// ============================================
export { onApproveWithdrawal } from "./wallet/onApproveWithdrawal";
export { onRejectWithdrawal } from "./wallet/onRejectWithdrawal";
export { onMarkWithdrawalPaid } from "./wallet/onMarkWithdrawalPaid";
export { blockUser } from "./users/blockUser";
export { unblockUser } from "./users/unblockUser";

// ============================================
// FASE 6B — Com Asaas (aguardando API Key)
// ============================================
export { createAsaasPayment } from "./payments/createAsaasPayment";
export { onAsaasWebhook } from "./payments/onAsaasWebhook";
export { approveRefund } from "./payments/approveRefund";