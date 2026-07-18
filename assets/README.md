# Lumina Dating App - Assets

## Estrutura de Diretórios

```
assets/
├── crystals/           # Ícones de cristais
│   ├── crystal-small.svg
│   ├── crystal-medium.svg
│   ├── crystal-large.svg
│   └── crystal-legendary.svg
├── fragments/          # Ícones de fragmentos
│   ├── fragment-common.svg
│   └── fragment-rare.svg
├── vault/              # Ícones de cofres
│   ├── vault-closed.svg
│   ├── vault-glowing.svg
│   └── vault-full.svg
├── trees/              # Ilustrações da Árvore da Sintonia
│   ├── tree-broto.svg
│   ├── tree-crescimento.svg
│   ├── tree-florescimento.svg
│   ├── tree-constelacao.svg
│   └── tree-galaxia.svg
├── frames/             # Molduras de perfil (20 total)
│   ├── 5 gratuitas
│   ├── 10 premium
│   └── 5 eventos
├── badges/             # Badges de conquistas (11 total)
├── destiny-cards/      # Cartas do destino (4 tipos)
├── events/             # Banners de eventos (4 total)
├── premium/            # Assets premium Galáxia Plus
├── animations/         # Animações Lottie (4 placeholders)
└── index.ts            # Índice de exportação para React Native
```

## Uso no React Native

```typescript
import { Crystals, Frames, Badges } from '../assets';

// Usar cristal
<Image source={Crystals.small} />

// Usar moldura
<Image source={Frames.galaxia} />

// Usar badge
<Image source={Badges.prestigio1} />
```

## Formatos

- **SVG**: Vetorial, escalável infinitamente
- **JSON**: Animações Lottie para React Native
- **PNG**: Para assets que precisam de rasterização

## Próximos Passos

1. Substituir placeholders Lottie com animações reais
2. Gerar versões PNG dos SVGs se necessário
3. Otimizar para produção
4. Adicionar mais badges conforme necessidade