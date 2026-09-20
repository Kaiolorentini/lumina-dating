// ============================================
// LUMINA — REGISTRO DOS DISPATCHERS
// functions/src/gamification/registerDispatchers.ts
//
// Cada dispatcher chama registerDispatcher() no CARREGAMENTO
// do módulo. Sem alguém importar o arquivo, o módulo nunca
// carrega e o registry fica vazio — todo evento saía SKIPPED
// e o Engine parecia funcionar sem conceder nada.
//
// Este arquivo é o ponto ÚNICO desses imports, e é importado
// pelo index.ts.
//
// LIGAR UM POR VEZ. Importar um dispatcher aqui NÃO basta
// para ele persistir: o modo vem de systemConfig/legacyFlags
// e só em ENGINE ele grava. São dois travões, de propósito.
//
// ── ESTADO ──
//
// XP — LIGADO.
//   Resolve cinco ações que não tinham caminho nenhum:
//   VISIT_PROFILE, GIVE_LIKE, CREATE_SINTONIA,
//   COMPLETE_MISSION e MESSAGE_REPLY. O XPService grava XP E
//   treeXP com os valores do xpValues.ts.
//   Sem duplicação: o cliente só chama earnXP para
//   START_CONVO e UNLOCK_ACHIEVEMENT, e MESSAGE_REPLY não é
//   disparado por ninguém hoje.
//
// TREE — NÃO LIGAR.
//   Conflita com o XP. Em MATCH_CREATED o XPService soma 50
//   de treeXP (xpValues) e o TreeService soma 25 (constante
//   própria), os dois gravando o estágio no mesmo evento. E o
//   TreeService.persist grava o ESTÁGIO sem gravar o treeXP
//   que usou para calculá-lo.
//
// ACHIEVEMENT, MISSION, VAULT, RANKING, PRESTIGE,
// NOTIFICATION — não auditados ainda. Cada um tem um caminho
// legado equivalente em produção (achievementTriggers,
// progressMission, earnFragments, registerRankingXP) e ligar
// sem comparar duplicaria economia.
// ============================================

import './services/XPDispatcher';

// ── STUBS ──
// Os três abaixo devolvem SKIPPED com "não implementado —
// Bloco 5": o Service correspondente nunca foi escrito.
// Ligar só troca o erro "não registrado" por um SKIPPED
// honesto no log. Não gravam nada e não têm risco.
//
// NOTIFICATION é o que mais falta: pela EventMatrix ele
// deveria avisar o usuário em LEVEL_UP, TREE_EVOLUTION e
// ACHIEVEMENT_UNLOCKED. Implementar o NotificationService é
// pré-requisito para os avisos de gamificação.
// VAULT — LIGADO. Deposita fragmentos no ALVO: 2 por visita,
// 5 por curtida, 20 por match. Sem duplicação: o legado
// (earnFragments) é código morto, ninguém o chama.
// Teto diário de 20 só para visitas; curtida e match não têm.
import './services/VaultDispatcher';

// RANKING — LIGADO. Sem duplicação: nem o registerRankingXP
// nem o registerRankingEvent são chamados pelo cliente, então
// ninguém alimentava o ranking até agora.
import './services/RankingDispatcher';

import './services/AnalyticsDispatcher';
import './services/MissionDispatcher';
import './services/NotificationDispatcher';