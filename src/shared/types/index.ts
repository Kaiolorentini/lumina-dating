// ============================================
// LUMINA — TIPOS GLOBAIS COMPARTILHADOS
// src/shared/types/index.ts
//
// v5.3 — vaultFragments adicionado ao Wallet
// ============================================

export type Gender = 'masculino' | 'feminino' | 'trans' | 'nao-binario';
export type Preference = 'homens' | 'mulheres' | 'trans' | 'todos';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  age: number;
  city: string;
  state: string;
  gender: Gender;
  preferences: Preference[];
  bio: string;
  photoURL: string;
  cpf?: string; 
  createdAt: Date;
  updatedAt?: Date;
  // Campos de segurança — obrigatórios para Firestore Rules
  role: 'user' | 'creator' | 'admin' | 'superadmin';
  isBlocked: boolean;
}

// ------------------------------------------
// WALLET — v5.3
// ------------------------------------------
export interface Wallet {
  uid: string;

  // REGRA 18: separados obrigatoriamente
  coinsGratuitos: number;
  coinsPremium:   number;

  // Moeda secundária — não comprável
  fragments: number;

  // Cofre de Sintonia — v5.3
  vaultFragments:        number;   // fragmentos no cofre
  vaultMax:              number;   // limite máximo (5000)
  vaultUnlockAt:         Date | null;
  vaultLastWithdrawAt:   Date | null;
  vaultLastContribution: Date | null;
  vaultFullNotified:     boolean;
  vaultCrystalsToday:    number;
  vaultCrystalsTodayDate: string;

  // Totais históricos
  totalEarned: number;
  totalSpent:  number;

  // Controle anti-inflação
  cristaisGratuitosMensais:  number;
  mesAtual:                  string; // YYYY-MM
  dailyCristaisGratuitos:    number;

  // Vault legado (mantido para compatibilidade)
  vault?: {
    saldo:               number;
    disponivelEm:        Date | null;
    ultimaContribuicao:  Date | null;
  };

  // Controle de primeira compra
  firstPurchaseDone: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export function walletTotalBalance(wallet: Wallet): number {
  return wallet.coinsGratuitos + wallet.coinsPremium;
}

// ------------------------------------------
// TRANSAÇÃO
// ------------------------------------------
export interface Transaction {
  id:          string;
  type:        'earn' | 'spend';
  coinTipo:    'gratuito' | 'premium' | 'mixed';
  amount:      number;
  description: string;
  timestamp:   Date;
}

// ------------------------------------------
// PROGRESSÃO
// ------------------------------------------
export type ProfileTier = 'comum' | 'raro' | 'epico' | 'lendario' | 'galaxia';

export interface UserProgression {
  xp:           number;
  level:        number;
  prestige:     number;
  prestigeTitle: string;
  profileTier:  ProfileTier;
  achievements: string[];
  colecoes:     string[];
  metaSintonia: 'namoro' | 'amizade' | 'casamento' | 'conhecer' | null;
  progressoMeta: number;
  arvore: {
    estagio:              number;
    xpArvore:             number;
    fertilizanteAtivo:    boolean;
    fertilizanteExpiraEm: Date | null;
  };
  visibilidade:  number;
  ultimoAcesso:  Date;
}

// ------------------------------------------
// DAILY STATE
// ------------------------------------------
export interface DailySintonia {
  perfilId:       string;
  compatibilidade: number;
  revelado:       boolean;
}

export interface UserDaily {
  streakAtual:    number;
  ultimoResgate:  Date | null;
  multiplicador:  number;
  faisca: {
    resgatada: boolean;
    valor:     number;
  };
  destinyCard: {
    perfis:           string[];
    compatibilidades: number[];
    visualizado:      boolean;
    cartasHoje:       number;
  };
  mysteryMatch: {
    compatibilidade: number;
    revelado:        boolean;
  };
  quaseSintonia: {
    compatibilidade:   number;
    revelado:          boolean;
    nearMatchVisitors: string[];
  };
  sintoniasPerdidas: {
    perfis:            string[];
    compatibilidades:  number[];
    reveladas:         boolean[];
    expiraEm:          Date | null;
    lostMatchVisitors: string[];
  };
  alguemPensouEmVoce: {
    ativo:    boolean;
    revelado: boolean;
  };
  profilesVisitedForXP:       string[];
  likesReceivedFrom:           string[];
  xpFromLikesToday:            number;
  vaultFragmentsFromVisits:    number;
  flashOfferShownAt:           Date | null;
}

// ------------------------------------------
// NOTIFICAÇÕES
// ------------------------------------------
export type NotificationType =
  | 'sintonia'
  | 'mensagem'
  | 'promocao'
  | 'creator_approved'
  | 'creator_rejected'
  | 'product_approved'
  | 'product_rejected'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'withdrawal_paid'
  | 'refund_processed'
  | 'quase_sintonia'
  | 'sintonia_perdida'
  | 'pensou_em_voce'
  | 'cofre_cheio'
  | 'streak_risco'
  | 'visibilidade_caindo'
  | 'level_up'
  | 'tree_evolution'
  | 'achievement_unlocked'
  | 'collection_complete';

export interface AppNotification {
  id:        string;
  userId:    string;
  type:      NotificationType;
  message:   string;
  read:      boolean;
  timestamp: Date;
  icon:      string;
  dados?: {
    visitorId?:      string;
    sintonia?:       number;
    fragments?:      number;
    borrado?:        boolean;
    podeRevelar?:    boolean;
    title?:          string;
    level?:          number;
    tier?:           string;
    stage?:          number;
    achievementId?:  string;
    collectionId?:   string;
    reward?:         Record<string, unknown>;
  };
}

// ------------------------------------------
// CHAT
// ------------------------------------------
export interface ChatMessage {
  id:            string;
  text:          string;
  senderId:      string;
  senderName:    string;
  timestamp:     Date;
  delivered?:    boolean;
  read?:         boolean;
  audioUrl?:     string;
  audioDuration?: number;
  reactions?:    Record<string, string>;
  messageCount?: number;
}

// ------------------------------------------
// SOCIAL
// ------------------------------------------
export type RequestStatus = 'pending' | 'accepted' | 'rejected';

export interface ConnectionRequest {
  id:            string;
  fromUserId:    string;
  toUserId:      string;
  fromUserName:  string;
  fromUserPhoto: string;
  status:        RequestStatus;
  timestamp:     Date;
}

export interface Block {
  id:           string;
  blockerId:    string;
  blockedId:    string;
  blockedName:  string;
  blockedPhoto: string;
  timestamp:    Date;
}

// ------------------------------------------
// MARKETPLACE
// ------------------------------------------
export interface MediaItem {
  id:            string;
  url:           string;
  type:          'image' | 'video';
  isLocked:      boolean;
  uploadedBy:    string;
  uploaderName:  string;
  uploaderPhoto: string;
  timestamp:     Date;
  unlockedBy:    string[];
}

export interface ContentAccess {
  level1: boolean;
  level2: boolean;
  level3: boolean;
}

export interface ProfileCardData {
  id:       string;
  name:     string;
  age:      number;
  location: string;
  sintonia: number;
  photoURL: string;
  
}

// ------------------------------------------
// SINTONIA
// ------------------------------------------
export interface SintoniaResult {
  score: number;
  label: string;
  color: string;
  breakdown: {
    localizacao: number;
    preferencia: number;
    perfil:      number;
    interesses:  number;
  };
}

// ------------------------------------------
// GALÁXIA PLUS
// ------------------------------------------
export interface GalaxiaPlusSubscription {
  active:               boolean;
  expiresAt:            Date | null;
  startedAt:            Date | null;
  asaasSubscriptionId:  string | null;
} 