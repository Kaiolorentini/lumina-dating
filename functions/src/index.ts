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
export { toggleProductFeatured }    from "./products/toggleProductFeatured";
export { getCurationDashboard }     from "./admin/getCurationDashboard";
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
// Ban temporário de marketplace (fraudes): restauração
// sob demanda + varredura diária de rede de segurança.
export { restoreCreatorIfExpired }  from "./users/restoreCreatorIfExpired";
export { listBlockedUsers }         from "./users/listBlockedUsers";

// ============================================
// ONBOARDING — TERMOS E VERIFICAÇÃO DE IDADE
// ============================================
export { acceptAppTerms }           from "./users/acceptAppTerms";

// ============================================
// PUSH ENTRE USUÁRIOS
// ============================================
export { sendUserPush }             from "./notifications/sendUserPush";
export { registerPushToken }        from "./notifications/registerPushToken";
export { submitAgeVerification }    from "./verification/submitAgeVerification";
export { listPendingVerifications } from "./verification/listPendingVerifications";
export { approveAgeVerification }   from "./verification/approveAgeVerification";
export { rejectAgeVerification }    from "./verification/rejectAgeVerification";
export { expireMarketplaceBans }    from "./users/expireMarketplaceBans";

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
// weeklyRanking.ts REMOVIDO: era um SEGUNDO sistema de
// ranking, por categoria (EXPLORADORES/SINTONIAS/MISSOES),
// escrevendo na mesma coleção `weeklyRanking` com estrutura
// incompatível — doc {weekId}/{categoria}/{uid} contra
// {uid}_{weekId} — e com agendamento próprio pagando até 500
// fragmentos por posição, contra 50 do outro.
//
// Ninguém chamava o registerRankingEvent, mas o
// resetWeeklyRanking era AGENDADO e rodava toda segunda.
//
// A ideia de rankings por categoria é boa e fica registrada
// como melhoria: o RankingService já sabe a categoria de cada
// evento (SOCIAL, CHAT, MISSION).

// Monitoramento
export { takeDailyEconomySnapshot, getEconomySnapshots } from "./monitoring/inflationMonitor";
export { resetDailyMetrics, resetMonthlyMetrics } from "./monitoring/resetAdminMetrics";

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
export { getVaultStatus, withdrawFromVault } from './engagement/vault';
export { equipFrame, getFramesStatus } from './engagement/frames';
export { equipBadge, getBadgesStatus } from './engagement/badges';
export { clearCosmeticReveal }         from './engagement/cosmeticReveal';
export { buyBadgeWithFragments }       from './economy/buyBadgeWithFragments';
export { earnXP, getXPStatus } from './engagement/xp';
export { checkAchievements, getAchievementsStatus, repairAchievements } from './engagement/achievements';
export { registerRankingXP, getRanking, freezeRanking, rewardRanking, resetRanking } from './engagement/ranking';
// grantPrestigePoints REMOVIDA: era callable e aceitava
// qualquer marcoId do cliente — dava para pedir ACH_FOUNDER e
// ganhar 500 pontos sem ser fundador. Agora os marcos são
// concedidos pelo PrestigeService, no ponto onde o evento
// acontece.
//
// checkPrestigeTimeMarcos REMOVIDA: gravava em `pendingMarcos`
// e ninguém lia esse campo — detectava o marco e o abandonava.
// A checagem de tempo migrou para o claimDailyReward, que já
// roda uma vez por dia por usuário e escala sem o limite de
// 200 da varredura.
export { getPrestigeStatus } from './engagement/prestige';
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
// Importa os dispatchers para que o registerDispatcher() de
// cada um rode. Sem esta linha o registry fica vazio e o
// Engine não concede nada. Ver registerDispatchers.ts.
import './gamification/registerDispatchers';

export { processGameEvent } from './gamification/GamificationEngine';
export { onProfileLike } from './engagement/profileLike';
export { clearSintoniaReveal } from './engagement/clearSintoniaReveal';
export { equipTitle, getTitlesStatus } from './engagement/titles';
export { dismissProfile } from './engagement/dismissProfile';
export { clearPrestigeReveal } from './engagement/clearPrestigeReveal';
export { getPublicAchievements } from './users/getPublicAchievements';
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
export { clearLevelReveal } from './engagement/clearLevelReveal';