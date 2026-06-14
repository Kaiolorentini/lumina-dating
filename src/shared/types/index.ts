// ============================================
// TIPOS GLOBAIS COMPARTILHADOS
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
  createdAt: Date;
  updatedAt?: Date;
}

export interface SintoniaResult {
  score: number;
  label: string;
  color: string;
  breakdown: {
    localizacao: number;
    preferencia: number;
    perfil: number;
    interesses: number;
  };
}

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
  | 'refund_processed';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  read: boolean;
  timestamp: Date;
  icon: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
  delivered?: boolean;
  read?: boolean;
  audioUrl?: string;
  audioDuration?: number;
  reactions?: Record<string, string>;
}

export interface Wallet {
  coins: number;
  totalSpent: number;
  totalEarned: number;
}

export interface Transaction {
  id: string;
  type: 'earn' | 'spend';
  amount: number;
  description: string;
  timestamp: Date;
}

export type RequestStatus = 'pending' | 'accepted' | 'rejected';

export interface ConnectionRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUserName: string;
  fromUserPhoto: string;
  status: RequestStatus;
  timestamp: Date;
}

export interface Block {
  id: string;
  blockerId: string;
  blockedId: string;
  blockedName: string;
  blockedPhoto: string;
  timestamp: Date;
}

export interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  isLocked: boolean;
  uploadedBy: string;
  uploaderName: string;
  uploaderPhoto: string;
  timestamp: Date;
  unlockedBy: string[];
}

export interface ContentAccess {
  level1: boolean;
  level2: boolean;
  level3: boolean;
}

export interface ProfileCardData {
  id: string;
  name: string;
  age: number;
  location: string;
  sintonia: number;
  photoURL: string;
}