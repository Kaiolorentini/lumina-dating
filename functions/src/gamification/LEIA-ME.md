# Engine de Gamificação — PAUSADO

**Estado em 19/09/2026: o Engine NÃO está ativo. Nada nesta
pasta credita XP, fragmento ou conquista em produção.**

## O que credita de verdade

O caminho vivo é o LEGADO, disparado pelo cliente:

app (RealProfileScreen, engagementService)
→ CF earnXP (functions/src/economy/earnXP.ts)
→ XPService, VaultService, ranking e missão



Valores em `functions/src/config/xpValues.ts`.
Conquistas entram por `achievementTriggers` → `onAchievementTrigger`
→ `AchievementProcessor`.

## Por que o Engine não roda

Dois travões INDEPENDENTES, os dois ativos:

1. **Os dispatchers nunca são importados.** Cada um chama
   `registerDispatcher()` no carregamento do módulo, mas nenhum
   arquivo do projeto importa `services/XPDispatcher.ts` e os
   outros oito. O registry fica vazio e todo evento sai
   `SKIPPED`.

2. **O modo é LEGACY.** `getDispatcherMode()` lê
   `systemConfig/legacyFlags`. Com o documento ausente valem os
   DEFAULTS de `LegacyFeatureFlags.ts`, que têm todas as flags
   de legado em `true`. Em LEGACY e SHADOW o dispatcher nunca
   persiste.

O segundo travão é a proteção que importa: mesmo que alguém
adicione os imports, nada é gravado enquanto as flags
estiverem assim.

## NÃO ligue o Engine sem antes

Ligar os dois travões ao mesmo tempo faz o Engine creditar
**em cima** do legado, que continua creditando. XP e fragmento
em dobro, e a FASE 2D existiu justamente para eliminar uma
duplicação dessas.

O caminho correto está em `SHADOW_MODE.md`, nesta pasta:
ativar o Shadow, comparar por 72h, exigir 99,99% de
equivalência e zero divergência crítica, e só então virar
`LegacyXP: false` — um sistema por vez.

## Se for retomar

1. Recriar `systemConfig/legacyFlags` (foi apagado no reset de
   18/09/2026)
2. `ShadowModeEnabled: true`
3. Adicionar os imports dos nove dispatchers
4. Acompanhar `shadowComparisons` e o `getDashboardSnapshot`
5. Virar as flags uma a uma

## Se for remover

São ~30 arquivos entrelaçados. `emotionalTriggers.ts` já chama
`ProfileVisitOrchestrator`, que chama
`GamificationIntegrationService`. Remover exige desmontar essa
cadeia — não é apagar a pasta.