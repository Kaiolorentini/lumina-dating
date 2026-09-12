// LUMINA — NAVIGATION TYPES v5.14
// AdminInflation + Visitors adicionados; AdminProductReview restaurado

export type PremiumFeatureStatus = 'LOCKED' | 'READY' | 'ACTIVE' | 'EXPIRED' | 'COOLDOWN';

export type RootStackParamList = {
  Splash:       undefined;
  Login:        undefined;
  Register:     undefined;
  ProfileSetup: { editMode?: boolean } | undefined;
  /** Onboarding — árvore separada, nome distinto de ProfileSetup para
   *  o React Navigation não preservar estado ao trocar de árvore. */
  ProfileOnboarding: undefined;
  MainTabs:      undefined;
  RealProfile:   { userId: string };
  UserChat:      { userId: string; userName: string; userPhoto: string };
  Notifications: undefined;
  Requests:      undefined;
  Blocked:       undefined;
  DailyReward:   undefined;
  Faisca:        undefined;
  DestinyCard:   undefined;
  Missions:      undefined;
  Fragments:     undefined;
  Vault:         undefined;
  XP:            undefined;
  Achievements:  undefined;
  Ranking:       undefined;
  Prestige:      undefined;
  PremiumTools:  undefined;
  WeeklyChallenge: undefined;
  PaymentSetup:    undefined;
  MarketplaceHome: undefined;
  ProductDetail:   { productId: string };
  MyPurchases:     undefined;
  ContentViewer:   { productId: string; purchaseId: string };
  MyProducts:      undefined;
  CreateProduct:   undefined;
  EditProduct:     { productId: string };
  MyFavorites:     undefined;
  MyEarnings:      undefined;
  Withdrawal:      undefined;
  CreatorRequest:  undefined;
  Checkout: {
    productId?:    string;
    saleId?:       string;
    checkoutUrl?:  string;
    pixQrCode?:    string;
    pixCopyPaste?: string;
  };
  AdminPanel:               undefined;
  AdminDashboard:           undefined;
  AdminCreatorRequests:     undefined;
  AdminProductsModeration:  undefined;
  AdminProductReview:       { productId: string };
  AdminSales:               undefined;
  AdminRefundRequests:      undefined;
  AdminWithdrawals:         undefined;
  AdminFraudFlags:          undefined;
  AdminUserSearch:          undefined;
  AdminUserDetail:          { userId: string };
  AdminCoupons:             undefined;
  AdminReports:             undefined;
  AdminInflation:           undefined;
  Visitors:                 undefined;
};

export type TabParamList = {
  Home: undefined; Media: undefined; Sintonias: undefined;
  Store: undefined; Marketplace: undefined; Profile: undefined; Admin: undefined;
};