// ============================================
// LUMINA — LINKS / URLS (WEB)
// src/navigation/linking.web.ts
//
// Cada tela tem uma URL em português; o F5 e o link aberto direto
// levam de volta à mesma tela.
//
// Segurança: a URL leva SÓ ids. Parâmetros extras (nome, foto, dados
// de pagamento) iriam para a query string (?...) e são sempre
// removidos. Telas que dependem desses dados não são restauradas
// pela URL: a conversa volta para Sintonias, o pagamento para Compras.
//
// O app troca de árvore na abertura (carregando → login → gate → app),
// e a URL inicial se perderia. Por isso ela é lida ao carregar este
// arquivo e aplicada quando a pilha principal monta (restoreWebRoute),
// o mesmo padrão do toque no push. Abrir /cofre sem login → entrar →
// cai no Cofre. URLs das telas do gate não são restauradas.
// ============================================

import {
  getPathFromState as defaultGetPathFromState,
  getStateFromPath as defaultGetStateFromPath,
} from '@react-navigation/native';
import type { LinkingOptions, NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

type LinkingConfig = NonNullable<LinkingOptions<RootStackParamList>['config']>;
type ParseOptions  = Parameters<typeof defaultGetStateFromPath>[1];
type ResetState    = Parameters<NavigationContainerRef<RootStackParamList>['resetRoot']>[0];

const GATE_PATHS = {
  Splash:                  'carregando',
  Login:                   'entrar',
  Register:                'cadastro',
  ProfileOnboarding:       'criar-perfil',
  TermsGate:               'termos',
  AgeVerificationGate:     'verificacao',
  VerificationPendingGate: 'verificacao-em-analise',
  AccountBannedGate:       'conta-suspensa',
  GateError:               'erro',
} as const;

const SCREENS = {
  ...GATE_PATHS,
  MainTabs: {
    path: '',
    screens: {
      Home:        '',
      Sintonize:   'sintonize',
      Sintonias:   'sintonias',
      Store:       'cristais',
      Marketplace: 'marketplace',
      CreatorHub:  'painel',
      Profile:     'perfil',
      Admin:       'admin',
    },
  },
  RealProfile:      'pessoa/:userId',
  UserChat:         'conversa/:userId',
  ProfileSetup:     'perfil/editar',
  Notifications:    'notificacoes',
  Requests:         'solicitacoes',
  Blocked:          'bloqueados',
  Faisca:           'faisca',
  DestinyCard:      'carta-do-destino',
  Missions:         'missoes',
  Fragments:        'fragmentos',
  Vault:            'cofre',
  XP:               'xp',
  Achievements:     'conquistas',
  Ranking:          'ranking',
  Prestige:         'prestigio',
  PremiumTools:     'ferramentas',
  GalaxiaPlus:      'galaxia-plus',
  Visitors:         'visitantes',
  Frames:           'molduras',
  Badges:           'badges',
  Titles:           'titulos',
  BadgesShop:       'loja/badges',
  FramesShop:       'loja/molduras',
  CrystalPacks:     'loja/cristais',
  Boosts:           'impulsos',
  PaymentSetup:     'recebimento',
  MarketplaceHome:  'marketplace/vitrine',
  ProductDetail:    'produto/:productId',
  MyPurchases:      'compras',
  ContentViewer:    'compras/:purchaseId/conteudo/:productId',
  MyProducts:       'meus-produtos',
  CreateProduct:    'meus-produtos/novo',
  EditProduct:      'meus-produtos/:productId/editar',
  CreatorAgreement: 'contrato-do-criador',
  Interests:        'interesses',
  MyFavorites:      'favoritos',
  MyEarnings:       'ganhos',
  Withdrawal:       'ganhos/saque',
  CreatorRequest:   'seja-criador',
  CreatorPanel:     'meu-painel',
  Checkout:         'pagamento',
  Support:          'suporte',
  SupportNew:       'suporte/novo',
  SupportTicket:    'suporte/:ticketId',
  DeleteAccount:    'excluir-conta',
  AdminPanel:                 'admin/painel',
  AdminDashboard:             'admin/inicio',
  AdminCreatorRequests:       'admin/criadores',
  AdminProductsModeration:    'admin/produtos',
  AdminProductReview:         'admin/produtos/:productId',
  AdminProductChecklist:      'admin/produtos/:productId/questionario/:mode',
  AdminSales:                 'admin/vendas',
  AdminRefundRequests:        'admin/reembolsos',
  AdminWithdrawals:           'admin/saques',
  AdminFraudFlags:            'admin/fraudes',
  AdminBlockedUsers:          'admin/bloqueados',
  AdminAgeVerification:       'admin/verificacoes',
  AdminAgeVerificationReview: 'admin/verificacoes/:userId',
  AdminUserSearch:            'admin/usuarios',
  AdminUserDetail:            'admin/usuarios/:userId',
  AdminCoupons:               'admin/cupons',
  AdminReports:               'admin/relatorios',
  AdminInflation:             'admin/inflacao',
  AdminCuration:              'admin/curadoria',
  AdminSupport:               'admin/suporte',
} as const;

// MainTabs é tipada como undefined no RootStackParamList (o app já
// navega para as abas com `as never`), então a tipagem não aceita a
// configuração aninhada das abas: a conversão abaixo é intencional.
const config = {
  initialRouteName: 'MainTabs',
  screens: SCREENS,
} as unknown as LinkingConfig;

/** Telas que dependem de dados fora da URL → para onde a URL leva. */
const FALLBACK_PATH: Partial<Record<keyof RootStackParamList, string>> = {
  UserChat: 'sintonias',
  Checkout: 'compras',
};

const GATE_PATH_SET = new Set<string>(Object.values(GATE_PATHS));

function withoutQuery(path: string): string {
  return path.split('?')[0].split('#')[0];
}

function trimSlashes(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

function parsePath(path: string, options?: ParseOptions) {
  const clean = withoutQuery(path);
  const state = defaultGetStateFromPath(clean, options);
  const last  = state?.routes[state.routes.length - 1];
  const fallback = last ? FALLBACK_PATH[last.name as keyof RootStackParamList] : undefined;
  return fallback ? defaultGetStateFromPath(fallback, options) : state;
}

export const appLinking: LinkingOptions<RootStackParamList> = {
  prefixes: [],
  config,
  getStateFromPath: (path, options) => parsePath(path, options),
  getPathFromState: (state, options) => withoutQuery(defaultGetPathFromState(state, options)),
};

// ── URL de abertura (F5 / link direto) ──────────────────────
interface LocationLike { pathname?: string }

const initialPath = withoutQuery(
  (globalThis as unknown as { location?: LocationLike }).location?.pathname ?? '/',
);

function isRestorable(path: string): boolean {
  const clean = trimSlashes(path);
  return clean !== '' && !GATE_PATH_SET.has(clean);
}

let pendingPath: string | null = isRestorable(initialPath) ? initialPath : null;

/** Leva à tela da URL de abertura, uma vez, quando a pilha principal monta. */
export function restoreWebRoute(
  navigation: NavigationContainerRef<RootStackParamList> | null,
): void {
  if (!pendingPath || !navigation?.isReady()) return;
  const path = pendingPath;
  pendingPath = null;

  const state = parsePath(path, config as ParseOptions);
  if (!state) return;
  try {
    navigation.resetRoot(state as ResetState);
  } catch (error) {
    console.warn('[linking] Não foi possível abrir a tela da URL:', error);
  }
}