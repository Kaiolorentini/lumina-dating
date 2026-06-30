# LUMINA — MIGRATION CHECKLIST v2.0
# Sprint 1C — Status final por sistema

---

## XP — ✅ PRONTO PARA SHADOW

- [x] Calculator (XPCalculator — função pura)
- [x] Adapter (XPCompatibilityAdapter — comparador puro)
- [x] Comparator (XPComparator)
- [x] Metrics (ShadowMetricsService — ACTIVE)
- [x] Dispatcher simplificado (só persiste em ENGINE)
- [x] Legado (earnXP) dispara LegacyShadowOrchestrator
- [x] ShadowModeEnabled = true ← ATIVO
- [ ] Feature Flag testada (LegacyXP toggle)
- [ ] Rollback validado em produção
- [ ] Tests automatizados
- [ ] Shadow ativo por 72h consecutivas
- [ ] Divergência < 0.01%
- [ ] 0 divergências CRITICAL
- [ ] **ENGINE READY**

---

## RANKING — ✅ PRONTO PARA SHADOW

- [x] Calculator (RankingCalculator — função pura)
- [x] Adapter (RankingCompatibilityAdapter — comparador puro)
- [x] Comparator (RankingComparator)
- [x] Metrics (ShadowMetricsService — ACTIVE)
- [x] Dispatcher simplificado
- [x] Legado (registerRankingXP) dispara LegacyShadowOrchestrator
- [x] ShadowModeEnabled = true ← ATIVO
- [ ] Feature Flag testada
- [ ] Rollback validado
- [ ] Tests automatizados
- [ ] Shadow ativo por 72h consecutivas
- [ ] Divergência < 0.01%
- [ ] 0 divergências CRITICAL
- [ ] **ENGINE READY**

---

## ACHIEVEMENT — ✅ PRONTO PARA SHADOW

- [x] Calculator (AchievementCalculator — função pura)
- [x] Adapter (AchievementCompatibilityAdapter — comparador puro)
- [x] Comparator (AchievementComparator)
- [x] Metrics (ShadowMetricsService — ACTIVE)
- [x] Dispatcher simplificado
- [x] Legado (checkAchievements) dispara LegacyShadowOrchestrator
- [x] ShadowModeEnabled = true ← ATIVO
- [ ] Feature Flag testada
- [ ] Rollback validado
- [ ] Tests automatizados
- [ ] Shadow ativo por 72h consecutivas
- [ ] Divergência < 0.01%
- [ ] 0 divergências CRITICAL
- [ ] **ENGINE READY**

---

## TREE — 🔵 INHERITED (coberta pelo XP)

**Status: INHERITED via XPCompatibilityAdapter**

A árvore não possui sistema legado independente.
Seu comportamento (treeXP, treeStage) é consequência direta do fluxo de XP
já coberto pelo XPCompatibilityAdapter.

- [N/A] Adapter próprio — não necessário (coberto pelo XP)
- [N/A] Legado independente — não existe
- [x] Calculator (TreeCalculator — disponível para uso futuro)
- [x] Comparator (TreeComparator — disponível para uso futuro)
- [x] Dispatcher simplificado (só persiste em ENGINE)
- [x] Metrics (ShadowMetricsService — INHERITED)

**Critério de ENGINE READY:** mesmo critério do XP (já que depende dele).

---

## PRESTIGE — 🟡 NOT_SUPPORTED (Sprint 1C)

**Status: NOT_SUPPORTED — incompatibilidade de modelos**

O legado de Prestígio (grantPrestigePoints) é baseado em **marcos** (marcoId),
enquanto o Engine usa **GameEventType** (eventos de domínio).
Uma comparação 1:1 não é possível sem criar um adaptador artificial.

- [N/A] Adapter — requer estratégia específica (Sprint futura)
- [N/A] Legado integrado — modelo incompatível nesta Sprint
- [x] Calculator (PrestigeCalculator — disponível para uso futuro)
- [x] Comparator (PrestigeComparator — disponível para uso futuro)
- [x] Dispatcher simplificado (só persiste em ENGINE)
- [x] Metrics (ShadowMetricsService — NOT_SUPPORTED)

**Próxima Sprint:** definir estratégia de mapeamento marcos → eventos antes de integrar.

---

## VAULT — ⏳ PLANNED

- [ ] Calculator
- [ ] Adapter
- [ ] Comparator
- [ ] Legado integrado

---

## REGRA DE ATIVAÇÃO DO SHADOW MODE

`ShadowModeEnabled: true` foi ativado para os 3 sistemas com legado comparável.

| Sistema | Shadow Mode |
|---|---|
| XP | ACTIVE ✅ |
| RANKING | ACTIVE ✅ |
| ACHIEVEMENT | ACTIVE ✅ |
| TREE | INHERITED 🔵 |
| PRESTIGE | NOT_SUPPORTED 🟡 |

**Critério de saída do Shadow (por sistema):**
1. Shadow ativo por ≥ 72h consecutivas
2. 0 divergências CRITICAL
3. Divergência total < 0.01%
4. Dead Letter Queue = 0
5. Todos os testes automatizados passando

Somente após todos os critérios: desligar `LegacyXP/LegacyRanking/LegacyAchievement` → modo ENGINE.