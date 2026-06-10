import { AIModel } from '../utils/aiModels';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  ProfileSetup: { editMode?: boolean } | undefined;
  MainTabs: undefined;
  AIProfile: { model: AIModel };
  Chat: { model: AIModel };
  Notifications: undefined;
  RealProfile: { userId: string };
  UserChat: { userId: string; userName: string; userPhoto: string };
  Requests: undefined;
  Blocked: undefined;
  PaymentSetup: undefined;
  // Marketplace
  MarketplaceHome: undefined;
  ProductDetail: { productId: string };
  MyPurchases: undefined;
  MyProducts: undefined;
  CreateProduct: undefined;
  EditProduct: { productId: string };
  MyFavorites: undefined;
  MyEarnings: undefined;
  Withdrawal: undefined;
  CreatorRequest: undefined;
  ContentViewer: { productId: string; purchaseId: string };
  Checkout: { saleId: string; checkoutUrl?: string; pixQrCode?: string; pixCopyPaste?: string };
  // Admin
  AdminPanel: undefined;
  AdminDashboard: undefined;
  AdminCreatorRequests: undefined;
  AdminProductsModeration: undefined;
  AdminSales: undefined;
  AdminRefundRequests: undefined;
  AdminWithdrawals: undefined;
  AdminFraudFlags: undefined;
  AdminUserSearch: undefined;
  AdminUserDetail: { userId: string };
  AdminCoupons: undefined;
  AdminReports: undefined;
};

export type TabParamList = {
  Home: undefined;
  Media: undefined;
  // Conversas removida — tab órfã sem Tab.Screen correspondente
  Sintonias: undefined;
  Store: undefined;
  Profile: undefined;
  Marketplace: undefined;
  Admin: undefined;
};