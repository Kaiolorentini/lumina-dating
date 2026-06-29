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