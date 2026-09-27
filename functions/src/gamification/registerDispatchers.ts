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
// LIGADOS (gravam):
//   XP       — cobre VISIT_PROFILE, GIVE_LIKE, CREATE_SINTONIA,
//              COMPLETE_MISSION e MESSAGE_REPLY. Grava XP E
//              treeXP (xpValues.ts); quando o estágio sobe, paga
//              a recompensa, notifica e enfileira TREE_EVOLUTION
//              em achievementTriggers. O cliente só chama earnXP
//              para START_CONVO e UNLOCK_ACHIEVEMENT — sem
//              duplicação.
//   VAULT    — deposita fragmentos no ALVO: 2 por visita, 5 por
//              curtida, 20 por match. O legado (earnFragments)
//              é código morto, ninguém o chama.
//   RANKING  — nem registerRankingXP nem registerRankingEvent
//              são chamados pelo cliente; ninguém alimentava o
//              ranking antes. Lê o XP CRU, sem o multiplicador
//              do fertilizante — de propósito, para não vender
//              posição.
//
// STUBS (ligados, não gravam nada):
//   ANALYTICS, MISSION, NOTIFICATION — devolvem SKIPPED com
//   "não implementado — Bloco 5". Ligados só para trocar o
//   erro "não registrado" por um SKIPPED honesto no log.
//   NOTIFICATION é o que mais falta: pela EventMatrix ele
//   deveria avisar em LEVEL_UP, TREE_EVOLUTION e
//   ACHIEVEMENT_UNLOCKED.
//
// NÃO LIGAR — já têm caminho próprio em produção:
//   ACHIEVEMENT — conquistas entram por achievementTriggers →
//                 onAchievementTrigger → AchievementProcessor.
//                 Ligar processaria cada conquista DUAS vezes:
//                 recompensa, título e notificação em dobro.
//                 O DISPATCHER_NOT_REGISTERED no log é esperado.
//   PRESTIGE    — concedido por engagement/prestigeService.ts,
//                 chamado direto onde o marco acontece.
//   TREE        — conflita com o XP: em MATCH_CREATED o XPService
//                 soma 50 de treeXP e o TreeService soma 25, os
//                 dois gravando o estágio; e o TreeService.persist
//                 grava o ESTÁGIO sem o treeXP que usou. Exige a
//                 reescrita "opção B" antes de qualquer ligação.
// ============================================

import './services/XPDispatcher';
import './services/VaultDispatcher';
import './services/RankingDispatcher';

// Stubs
import './services/AnalyticsDispatcher';
import './services/MissionDispatcher';
import './services/NotificationDispatcher';