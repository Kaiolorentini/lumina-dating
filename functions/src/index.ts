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
export { onApproveCreator }         from "./creators/onApproveCreator";
export { onRejectCreator }          from "./creators/onRejectCreator";
export { onApproveProduct }         from "./products/onApproveProduct";
export { onRejectProduct }          from "./products/onRejectProduct";
export { releaseCreatorBalance }    from "./wallet/releaseCreatorBalance";
export { createFreeProductPurchase } from "./payments/createFreeProductPurchase";
export { requestRefund }            from "./payments/requestRefund";
export { rejectRefund }             from "./payments/rejectRefund";

// DRM
export { reportScreenshot }         from "./users/reportScreenshot";
export { banUserAfterScreenshot }   from "./users/banUserAfterScreenshot";

// ============================================
// FASE 10 — Admin + SuperAdmin
// ============================================
export { onApproveWithdrawal }      from "./wallet/onApproveWithdrawal";
export { onRejectWithdrawal }       from "./wallet/onRejectWithdrawal";
export { onMarkWithdrawalPaid }     from "./wallet/onMarkWithdrawalPaid";
export { blockUser }                from "./users/blockUser";
export { unblockUser }              from "./users/unblockUser";
export { getModeratorFileUrl } from "./admin/getModeratorFileUrl";
export { resolveFraudFlag } from "./admin/resolveFraudFlag";


// ============================================
// FASE 6B — Com Asaas
// ============================================
export { createAsaasPayment }       from "./payments/createAsaasPayment";
export { approveRefund }            from "./payments/approveRefund";
export { verifyAsaasWallet }        from "./payments/verifyAsaasWallet";
export { onAsaasWebhook }           from "./payments/onAsaasWebhook";

// ============================================
// CONTEÚDO PROTEGIDO
// ============================================
export { getSignedUrl }             from "./content/getSignedUrl";

// ============================================
// FASE 0 — BLINDAGEM DA ECONOMIA v5.1
// ============================================
// Carteira
export { initWallet }               from "./economy/initWallet";

// Cristais
export { earnCoins }                from "./economy/earnCoins";
export { spendCoins }               from "./economy/spendCoins";

// Fragmentos (moeda secundária — v5.1)
export { earnFragments }            from "./economy/earnFragments";
export { convertFragments }         from "./economy/convertFragments";



// Segurança
export { updateTrustScore }         from "./security/trustScore";

// Ranking
export { registerRankingEvent, resetWeeklyRanking } from "./economy/weeklyRanking";

// Monitoramento
export { takeDailyEconomySnapshot } from "./monitoring/inflationMonitor";

// recompensa diaria
export { claimDailyReward, getDailyRewardStatus } from './engagement/dailyReward';

//faísca
export { claimDailyFaisca, getDailyFaiscaStatus } from './engagement/dailyFaisca';

//carta do destino
export { getDestinyCard, markDestinyCardViewed } from './engagement/destinyCard';

// trigger notifications
export { onProfileVisit, checkLostSintonia } from './engagement/emotionalTriggers';
export { getUserPublicProfile }              from './engagement/getUserPublicProfile';
export { generateDailyMissions, getDailyMissions, progressMission } from './engagement/dailyMissions';
export { getFragmentsStatus, expireFragments } from './engagement/fragments';
export { getVaultStatus, depositToVault, withdrawFromVault } from './engagement/vault';
export { earnXP, getXPStatus } from './engagement/xp';
export { checkAchievements, getAchievementsStatus, repairAchievements } from './engagement/achievements';
export { registerRankingXP, getRanking, freezeRanking, rewardRanking, resetRanking } from './engagement/ranking';
export { grantPrestigePoints, getPrestigeStatus, checkPrestigeTimeMarcos } from './engagement/prestige';
export { activateFertilizer, getFertilizerStatus } from './premium/fertilizerService';
export { activateTurbo, getTurboStatus }            from './premium/turboService';
export { getWeeklyChallenge, progressWeeklyChallenge, resetWeeklyChallenges } from './premium/weeklyChallengeService';
                    
export { onMessageReply } from './engagement/messageReply';
export { onMissionCompleted } from './engagement/missionCompleted';
export { onCreateMatch } from './engagement/matchCreated';            
export { getDashboardSnapshot } from './gamification/dashboard/getDashboardSnapshot';

// ============================================
// GAMIFICATION ENGINE
// ============================================
export { processGameEvent } from './gamification/GamificationEngine';
export { onProfileLike } from './engagement/profileLike';
export { gamificationHealthCheck } from './gamification/health/healthCheck';

export { createCoupon } from "./marketplace/coupons/createCoupon";
export { updateCoupon } from "./marketplace/coupons/updateCoupon";
export { toggleCoupon } from "./marketplace/coupons/toggleCoupon";

// ============================================
// TRIGGERS — notificação de admin
// ============================================
export { onCreatorRequestCreated } from "./triggers/onCreatorRequestCreated";
export { onWithdrawalCreated } from "./triggers/onWithdrawalCreated";
export { onProductPending } from "./triggers/onProductPending";
export { saveCreatorPixKey } from "./payments/saveCreatorPixKey";