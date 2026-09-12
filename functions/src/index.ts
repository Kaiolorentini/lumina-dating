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

// ============================================
// FASE 6B — Com Asaas
// ============================================
export { createAsaasPayment }       from "./payments/createAsaasPayment";
export { approveRefund }            from "./payments/approveRefund";
export { verifyAsaasWallet }        from "./payments/verifyAsaasWallet";
export { onAsaasWebhook }           from "./payments/onAsaasWebhook";
export { createCoinsPurchase } from "./payments/createCoinsPurchase";

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
export { takeDailyEconomySnapshot, getEconomySnapshots } from "./monitoring/inflationMonitor";

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
export { activateImpulso, getImpulsoStatus }        from './premium/impulsoService';
export { revealVisitors, getVisitorsStatus }        from './premium/visitorsService';
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
export { onProductPending } from "./triggers/onProductPending";
export { onAchievementTrigger } from "./triggers/onAchievementTrigger";
export {
  activateDestaqueRegional,
  getDestaqueRegionalStatus,
} from './premium/destaqueRegionalService';
export { registerProfileVisit } from './engagement/registerProfileVisit';
// ============================================
// Functions que estavam em produção sem export aqui.
// Sem a linha, todo `firebase deploy --only functions`
// propunha DELETAR: cupons, resolução de fraude, chave PIX
// do criador, URL de moderação e os dois triggers.
// ============================================
export { resolveFraudFlag }        from './admin/resolveFraudFlag';
export { getModeratorFileUrl }     from './admin/getModeratorFileUrl';
export { createCoupon }            from './marketplace/coupons/createCoupon';
export { updateCoupon }            from './marketplace/coupons/updateCoupon';
export { toggleCoupon }            from './marketplace/coupons/toggleCoupon';
export { saveCreatorPixKey }       from './payments/saveCreatorPixKey';
export { onWithdrawalCreated }     from './triggers/onWithdrawalCreated';
export { onCreatorRequestCreated } from './triggers/onCreatorRequestCreated';