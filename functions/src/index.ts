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
export {
  submitProductChanges, reviewProductChanges, unpublishProduct, getPurchasedContent,
} from "./products/productChanges";
export { getCurationDashboard }     from "./admin/getCurationDashboard";

export { getAdminDashboard }        from "./admin/getAdminDashboard";
export {
  createSupportTicket, replySupportTicket, resolveSupportTicket,
  markSupportTicketRead, getSupportAttachmentUrl,
} from "./support/supportTickets";
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
export { requestWithdrawal }        from "./wallet/requestWithdrawal";
export { getWithdrawalReview }      from "./wallet/getWithdrawalReview";
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
export {
  setGalleryPhoto, removeGalleryPhoto, adminRemoveGalleryPhoto,
} from "./users/profileGallery";

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
export { markRefundPaid }           from "./payments/markRefundPaid";
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
// earnCoins REMOVIDA: callable em que o cliente escolhia origem,
// valor e chave de idempotência — com 'GALAXIA_PLUS_MENSAL'
// creditava cristais PREMIUM sem teto. Seu único uso (bônus de
// login de 10 cristais) foi retirado: a recompensa diária
// (claimDailyReward) já cumpre esse papel, calculada no servidor.
export { spendCoins }               from "./economy/spendCoins";

// Fragmentos (moeda secundária — v5.1)
// earnFragments REMOVIDA (27/09): callable em que o app escolhia a
// quantidade de fragmentos e a chave de idempotência — crédito sem
// teto. Missões pagam pelo MissionService; o Cofre, pelo VaultService.

export { convertFragments }         from "./economy/convertFragments";



// updateTrustScore REMOVIDA (27/09): calculava uma nota que nenhuma
// regra lia — antifraude desligado. Dois critérios liam campos
// errados (sintoniaCount e streakAtual). Religar com critérios
// corrigidos quando o antifraude for implementado de fato.

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
// markDestinyCardViewed REMOVIDA: gravava `visualizado: true` e
// ninguém lia esse campo. O que importa agora é o `chosenUid`.
export {
  getDestinyCard, drawDestinyCard, chooseDestinyProfile,
} from './engagement/destinyCard';

// trigger notifications
export { onProfileVisit, checkLostSintonia } from './engagement/emotionalTriggers';
export { getUserPublicProfile }              from './engagement/getUserPublicProfile';
export { revealTrigger }                     from './engagement/revealTrigger';
export { generateDailyMissions, getDailyMissions, progressMission } from './engagement/dailyMissions';
// expireFragments REMOVIDA: sem expiração de fragmentos.
export { getFragmentsStatus } from './engagement/fragments';
export { getVaultStatus, withdrawFromVault } from './engagement/vault';
export { notifyVaultUnlocked } from './engagement/notifyVaultUnlocked';
export { notifyGalaxiaTurbosExpiring } from './engagement/notifyGalaxiaTurbosExpiring';
// Missões registradas pelo servidor
export { onProfilePhotoUploaded } from './engagement/onProfilePhotoUploaded';
export { onChatMessageCreated }   from './engagement/onChatMessageCreated';
export { equipFrame, getFramesStatus } from './engagement/frames';
export { equipBadge, getBadgesStatus } from './engagement/badges';
export { clearCosmeticReveal }         from './engagement/cosmeticReveal';
export { buyBadgeWithFragments }       from './economy/buyBadgeWithFragments';
export { earnXP, getXPStatus } from './engagement/xp';
// checkAchievements REMOVIDA: callable que aceitava ação e valor do
// app e desbloqueava qualquer conquista. Conquistas entram só pelo
// servidor, via achievementTriggers → onAchievementTrigger.
export { getAchievementsStatus, repairAchievements } from './engagement/achievements';
// registerRankingXP REMOVIDA (27/09): o app escolhia quanto XP de
// ranking recebia. O ranking é alimentado pelo Engine
// (RankingRepository), no servidor.
export { getRanking, freezeRanking, rewardRanking, resetRanking } from './engagement/ranking';
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
export { reportBoostResults }                       from './premium/reportBoostResults';
export { revealVisitors, getVisitorsStatus }        from './premium/visitorsService';
// Desafio Semanal REMOVIDO (27/09): nenhuma tela o usava, e o
// progressWeeklyChallenge deixava o app declarar tipo e quantidade
// (sem meta definida, uma chamada concluía o desafio e pagava até
// 320 fragmentos e badges). Se voltar, voltar como as missões:
// registrado pelo servidor no evento real.
                    
// onMessageReply REMOVIDA (27/09): o app informava o alvo e a
// quantidade de mensagens direto ao Engine. Nenhuma tela chamava.
// Conversa real agora é observada pelo servidor
// (onChatMessageCreated) — se o evento de resposta voltar, nasce lá.
export { onCreateMatch } from './engagement/matchCreated';            
export { getDashboardSnapshot } from './gamification/dashboard/getDashboardSnapshot';

// ============================================
// GAMIFICATION ENGINE
// ============================================
// Importa os dispatchers para que o registerDispatcher() de
// cada um rode. Sem esta linha o registry fica vazio e o
// Engine não concede nada. Ver registerDispatchers.ts.
import './gamification/registerDispatchers';

// processGameEvent REMOVIDA do export (27/09): callable que aceitava
// qualquer evento do app (visita, curtida, sintonia, missão) direto
// no Engine, conferindo só o uid. O servidor chama o Engine por
// dentro (GamificationIntegrationService) — a porta pública não
// tinha uso legítimo. O arquivo fica para referência do wrapper.
export { onProfileLike } from './engagement/profileLike';
export { clearSintoniaReveal } from './engagement/clearSintoniaReveal';
export { equipTitle, getTitlesStatus } from './engagement/titles';
export { dismissProfile } from './engagement/dismissProfile';
export { secondChance }   from './engagement/secondChance';
export { clearPrestigeReveal } from './engagement/clearPrestigeReveal';
export { getPublicAchievements } from './users/getPublicAchievements';
export { gamificationHealthCheck } from './gamification/health/healthCheck';
export { onProductPending } from "./triggers/onProductPending";
export { onAchievementTrigger } from "./triggers/onAchievementTrigger";
export {
  activateDestaqueRegional,
  getDestaqueRegionalStatus,
  joinDestaqueWaitlist,
} from './premium/destaqueRegionalService';
export { notifyDestaqueOpened } from './premium/notifyDestaqueOpened';
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
export { saveCreatorPixKey, getMyPixKeyStatus } from './payments/saveCreatorPixKey';
export { onWithdrawalCreated }     from './triggers/onWithdrawalCreated';
export { onCreatorRequestCreated } from './triggers/onCreatorRequestCreated';
export { clearLevelReveal } from './engagement/clearLevelReveal';
export { getGalaxiaPlusStatus } from './payments/getGalaxiaPlusStatus';
// Migração única (28/09) — APAGAR depois de executada.
export { migrateNotificationTypes } from './maintenance/migrateNotificationTypes';