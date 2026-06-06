// ============================================
// TIPOS GLOBAIS COMPARTILHADOS
//
// Tipos usados em mais de um módulo ficam aqui.
// Tipos específicos de módulo ficam dentro do módulo.
// ============================================

// Gêneros disponíveis
export type Gender =
  | 'masculino'
  | 'feminino'
  | 'trans'
  | 'nao-binario';

// Preferências de relacionamento
export type Preference =
  | 'homens'
  | 'mulheres'
  | 'trans'
  | 'todos';

// Perfil completo do usuário
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

// Resultado de Sintonia
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

// Tipos de notificação
export type NotificationType =
  | 'online'
  | 'sintonia'
  | 'visita'
  | 'mensagem'
  | 'desbloqueio'
  | 'promocao';

// Notificação interna
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
  isAI: boolean;
  delivered?: boolean;
  read?: boolean;
  audioUrl?: string;
  audioDuration?: number;
  reactions?: Record<string, string>;
}
// Carteira de moedas
export interface Wallet {
  coins: number;
  totalSpent: number;
  totalEarned: number;
}

// Transação de moedas
export interface Transaction {
  id: string;
  type: 'earn' | 'spend';
  amount: number;
  description: string;
  timestamp: Date;
}

// Status de solicitação
export type RequestStatus = 'pending' | 'accepted' | 'rejected';

// Solicitação de conexão
export interface ConnectionRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUserName: string;
  fromUserPhoto: string;
  status: RequestStatus;
  timestamp: Date;
}

// Bloqueio de usuário
export interface Block {
  id: string;
  blockerId: string;
  blockedId: string;
  blockedName: string;
  blockedPhoto: string;
  timestamp: Date;
}

// Item de mídia
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

// Acesso a conteúdo progressivo
export interface ContentAccess {
  level1: boolean;
  level2: boolean;
  level3: boolean;
}

// Card de perfil para feed
export interface ProfileCardData {
  id: string;
  name: string;
  age: number;
  location: string;
  sintonia: number;
  photoURL: string;
  isAI?: boolean;
}