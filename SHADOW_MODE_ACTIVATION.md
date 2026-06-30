# SHADOW MODE — ATIVAÇÃO

## Como ativar

Execute no Firebase Console → Firestore → `systemConfig/legacyFlags`:

```json
{
  "LegacyXP": true,
  "LegacyRanking": true,
  "LegacyAchievement": true,
  "LegacyVault": true,
  "LegacyTree": true,
  "LegacyPrestige": true,
  "ShadowModeEnabled": true,
  "CanaryPercentage": 0
}
```

Ou via Admin SDK (script):

```typescript
import * as admin from 'firebase-admin';
admin.firestore().collection('systemConfig').doc('legacyFlags').set({
  ShadowModeEnabled: true,
}, { merge: true });
```

## O que acontece ao ativar

- XP: cada earnXP dispara comparação Shadow (legado vs Calculator)
- Ranking: cada registerRankingXP dispara comparação Shadow
- Achievement: cada checkAchievements dispara comparação Shadow
- Tree: INHERITED — sem comparação direta, cobertura via XP
- Prestige: NOT_SUPPORTED — sem comparação

## O que NÃO muda

- Resposta ao cliente: idêntica
- Dados de produção: intocados (legado continua como fonte da verdade)
- Performance: fire-and-forget, sem bloqueio

## Como monitorar

- Dashboard: getDashboardSnapshot() → shadowScores
- Firestore: collection `shadowComparisons` — divergências em tempo real
- ShadowMetricsService.getAllScores() — percentual de equivalência por sistema

## Critérios para avançar para ENGINE

Por sistema (XP, Ranking, Achievement):
1. Shadow ativo por ≥ 72h consecutivas
2. 0 divergências CRITICAL
3. scorePercent ≥ 99.99%
4. totalComparisons > 100 (dados suficientes)
5. Dead Letter Queue = 0

Quando atingido: definir `LegacyXP: false` (ou o sistema correspondente)
→ Dispatcher passa a modo ENGINE automaticamente.