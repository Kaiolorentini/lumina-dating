# LUMINA — ARCHITECTURE DECISION LOG (ADR)

Registro de decisões arquiteturais importantes.
Sempre que uma decisão relevante for tomada, adicionar aqui.

---

## ADR-001 — MatchService emite eventos, não trigger Firestore

**Data:** 2026-06
**Status:** Aprovado

**Decisão:**
O evento MATCH_CREATED é emitido pelo `MatchService.createMatch()`, não por um trigger Firestore `onDocumentCreated`.

**Motivo:**
A regra de negócio deve viver no domínio (MatchService), não na persistência.
Se a criação de Sintonia vier de outra origem no futuro (API, IA, sincronização), a gamificação continua funcionando sem duplicação.

**Alternativas consideradas:**
- Trigger `sintonias/{id}` onDocumentCreated — descartado por acoplamento à persistência.

---

## ADR-002 — MissionService emite eventos, não trigger Firestore

**Data:** 2026-06
**Status:** Aprovado

**Decisão:**
O evento MISSION_COMPLETED é emitido pelo `MissionService.completeMission()`, após validação e entrega de fragmentos no servidor.

**Motivo:**
Garantia de que os fragmentos foram entregues antes do XP ser concedido.
O trigger seria o último recurso, não o padrão.

---

## ADR-003 — AntiFarmService centralizado

**Data:** 2026-06
**Status:** Aprovado

**Decisão:**
Toda lógica anti-farm vive no `AntiFarmService` + `AntiFarmPolicy`.
Nenhum Validator implementa regras anti-farm diretamente.

**Motivo:**
Evita duplicação de regras. Alterações em políticas afetam todos os eventos automaticamente.

---

## ADR-004 — Padrão Orchestrator para todo o backend

**Data:** 2026-06
**Status:** Aprovado

**Decisão:**
Toda Cloud Function segue o padrão:
CF → Orchestrator → Validator → Triggers → GamificationIntegrationService

**Motivo:**
Padronização facilita manutenção, testes e onboarding.
Com 100+ CFs, todas seguem o mesmo fluxo.

---

## ADR-005 — Engine nunca conhece regras de negócio

**Data:** 2026-06
**Status:** Aprovado

**Decisão:**
O GamificationEngine só valida estrutura, executa middlewares, despacha e registra.
Nunca calcula XP, fragmentos, rankings ou prestígio.

**Motivo:**
Desacoplamento total. XP pode ser rebalanceado sem tocar no Engine.

---

## ADR-006 — GameEventFactory obrigatória

**Data:** 2026-06
**Status:** Aprovado

**Decisão:**
Nenhum GameEvent pode ser criado manualmente.
Todo evento passa pela GameEventFactory, que garante: eventId, eventHash, schemaVersion, eventVersion, correlationId, timestamp, origin, source.

**Motivo:**
Eventos incompletos causam falhas silenciosas no EventLedger e dificultam debug.

---

## ADR-007 — Dispatchers seguem padrão Dispatcher → Service → Repository

**Data:** 2026-06
**Status:** Aprovado

**Decisão:**
Dispatcher = adaptador puro (~50 linhas).
Service = lógica de negócio.
Repository = acesso ao Firestore.

**Motivo:**
Testabilidade: cada camada pode ser testada isoladamente.
Migração: se o banco mudar, só o Repository muda.


---

## ADR-008 — Legacy Freeze

**Data:** 2026-06
**Status:** Aprovado

**Decisão:**
A partir do Bloco 6, é proibido criar código novo em `economy/` e `engagement/` (pastas legadas).
Toda feature nova obrigatoriamente usa: Engine → Dispatcher → Service → Repository.

**Motivo:**
Evitar que o legado continue crescendo enquanto a migração para o Engine está em andamento.

---

## ADR-009 — Shadow Migration Strategy

**Data:** 2026-06
**Status:** Aprovado

**Decisão:**
Toda migração de sistema legado para o Engine passa obrigatoriamente por um período de Shadow Mode, onde o Engine processa em paralelo ao legado e apenas compara resultados, sem produzir efeito real, até atingir 0 divergências por 72h consecutivas.

**Motivo:**
Reduz risco de regressões em sistemas que envolvem economia real. Permite validação com dados reais de produção antes do corte definitivo.

**Alternativas consideradas:**
- Migração direta com feature flag simples — descartada por alto risco em sistema de economia real.
- Shim eterno (registerRankingXP retorna no-op) — descartado em favor de Feature Flag por sistema, mais simples de reverter.

**Rollback:** sempre via Feature Flag, nunca via novo deploy.

---

## ADR-010 — Versionamento de Contratos

**Data:** 2026-06
**Status:** Aprovado

**Decisão:**
Adicionar `contractVersion` como terceira camada de versionamento, além de `eventVersion` e `eventSchemaVersion`.
Representa o contrato entre Cliente → Cloud Functions → Engine.

**Motivo:**
Apps antigos instalados em dispositivos de usuários precisam continuar funcionando sem quebrar eventos, mesmo que o Engine evolua.

---

## ADR-011 — Engine Fail Safe (Política por Dispatcher)

**Data:** 2026-06
**Status:** Aprovado

**Decisão:**
Cada Dispatcher possui política própria de falha:

| Dispatcher | Política |
|---|---|
| XP | obrigatório |
| Vault | obrigatório |
| Achievement | retry |
| Ranking | retry |
| Tree | retry |
| Prestige | retry |
| Mission | retry |
| Notification | retry |
| Analytics | best effort |

**Motivo:**
Um problema no Analytics nunca deve impedir o usuário de ganhar XP. Dispatchers obrigatórios falham o evento; os demais são reenfileirados ou ignorados silenciosamente.

---

## ADR-012 — Idempotência Global

**Data:** 2026-06
**Status:** Aprovado

**Decisão:**
Nenhum Service pode produzir efeito se `eventId` já existir — regra do sistema inteiro, não apenas do Engine.

**Motivo:**
EventLedger garante idempotência no nível do Engine, mas Services chamados fora do fluxo padrão (ex: schedulers) também precisam verificar antes de escrever.

---

## ADR-010 — Shadow Coverage Scope

**Data:** 2026-06
**Status:** Aprovado

**Decisão:**
A Sprint 1C cobre Shadow Mode apenas para sistemas com legado diretamente comparável:
- **XP:** coberto — `earnXP` captura e envia `legacyResult` real
- **Ranking:** coberto — `registerRankingXP` captura e envia `legacyResult` real
- **Achievement:** coberto — `checkAchievements` captura e envia `legacyResult` real
- **Tree:** `INHERITED` — sem legado independente; comportamento validado indiretamente pelo XPCompatibilityAdapter
- **Prestige:** `NOT_SUPPORTED` — legado baseado em marcos (`marcoId`), incompatível com o modelo de eventos (`GameEventType`) do Engine; requer estratégia específica em Sprint futura

**Critério de ativação do Engine:** considera apenas sistemas com `coverageStatus = ACTIVE`.
Tree e Prestige não bloqueiam a transição dos outros 3 sistemas para ENGINE.

**Motivo:**
Criar um adaptador artificial para Tree ou Prestige apenas para satisfazer a cobertura de Shadow geraria complexidade sem benefício real. É preferível documentar a lacuna e tratá-la na Sprint correta.

**Alternativas consideradas:**
- Mapear marcos do Prestige para eventos artificiais → descartado (polui EventLedger)
- Criar `TREE_XP_GRANTED` como GameEventType → descartado (ADR-001: não criar eventos artificiais)