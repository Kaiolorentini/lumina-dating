import { createNotification } from '../modules/notifications/services/notificationService';
import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from '../core/firebase';
import { COLLECTIONS, COINS } from '../core/constants';
import { registrarVisita } from './visitsService';
import { registerVisit } from '../modules/ai/services/sintoniaService';
import { dispararMensagemAutomatica } from './autoMessageService';
import { AI_MODELS } from '../utils/aiModels';

// ============================================
// SERVIÇO DE ENGAJAMENTO CENTRAL
// ============================================

// Adiciona moedas criando carteira se não existir
async function safeAddCoins(
  userId: string,
  amount: number,
  description: string
): Promise<void> {
  try {
    const walletRef = doc(db, COLLECTIONS.WALLETS, userId);
    await setDoc(walletRef, {
      coins: increment(amount),
      totalEarned: increment(amount),
      totalSpent: increment(0),
    }, { merge: true });
  } catch (error) {
    console.error('Erro ao adicionar moedas:', error);
  }
}

// PASSO 1 — Executado quando usuário abre o app
export async function onAppOpen(userId: string): Promise<void> {
  try {
    // Gera notificações de IAs online
    const onlineModels = AI_MODELS.filter(m => m.status === 'online');
    if (onlineModels.length > 0) {
      const randomModel = onlineModels[
        Math.floor(Math.random() * onlineModels.length)
      ];
      await createNotification(
        userId,
        'online',
        `${randomModel.name} está online agora e pode responder você ✨`
      );
    }

    // Notificação de Sintonia disponível
    await createNotification(
      userId,
      'sintonia',
      'Nova Sintonia disponível! Confira perfis compatíveis ✦'
    );

    // Bônus diário de moedas
    await safeAddCoins(userId, COINS.DAILY_LOGIN, '🎁 Bônus diário de login');

    console.log('✅ App aberto — engajamento iniciado');
  } catch (error) {
    console.error('Erro no onAppOpen:', error);
  }
}

// PASSO 2 — Executado quando usuário visita perfil de IA
export async function onProfileVisit(
  userId: string,
  aiModelId: string,
  aiModelName: string
): Promise<void> {
  try {
    await registrarVisita(userId, aiModelId);
    await registerVisit(userId, aiModelId);

    await createNotification(
      userId,
      'visita',
      `${aiModelName} viu que você visitou o perfil dela 👀`
    );

    const model = AI_MODELS.find(m => m.id === aiModelId);
    if (model) {
      await dispararMensagemAutomatica(userId, model);
    }

    await safeAddCoins(
      userId,
      COINS.VISIT_PROFILE,
      `✦ Visitou perfil de ${aiModelName}`
    );

    console.log(`✅ Visita ao perfil ${aiModelName} registrada`);
  } catch (error) {
    console.error('Erro no onProfileVisit:', error);
  }
}

// PASSO 3 — Executado quando usuário envia mensagem
export async function onMessageSent(
  userId: string,
  aiModelId: string,
  aiModelName: string
): Promise<void> {
  try {
    await safeAddCoins(
      userId,
      COINS.SEND_MESSAGE,
      `💬 Mensagem para ${aiModelName}`
    );

    setTimeout(async () => {
      await createNotification(
        userId,
        'mensagem',
        `${aiModelName} respondeu sua mensagem 💬`
      );
    }, 3000);

    console.log(`✅ Mensagem para ${aiModelName} registrada`);
  } catch (error) {
    console.error('Erro no onMessageSent:', error);
  }
}

// PASSO 4 — Executado quando usuário desbloqueia conteúdo
export async function onContentUnlocked(
  userId: string,
  aiModelName: string,
  level: number
): Promise<void> {
  try {
    await createNotification(
      userId,
      'desbloqueio',
      `🔓 Você desbloqueou conteúdo nível ${level} de ${aiModelName}!`
    );

    console.log(`✅ Conteúdo nível ${level} de ${aiModelName} desbloqueado`);
  } catch (error) {
    console.error('Erro no onContentUnlocked:', error);
  }
}

// PASSO 5 — Executado quando Sintonia aumenta
export async function onSintoniaIncrease(
  userId: string,
  aiModelName: string,
  newScore: number
): Promise<void> {
  try {
    if (newScore >= 95) {
      await createNotification(
        userId,
        'sintonia',
        `✦ Sintonia Perfeita com ${aiModelName}! Vocês são almas gêmeas!`
      );
      await safeAddCoins(userId, COINS.PERFECT_SINTONIA, '✦ Sintonia Perfeita!');
    } else if (newScore >= 80) {
      await createNotification(
        userId,
        'sintonia',
        `🔥 Sua Sintonia com ${aiModelName} chegou a ${newScore.toFixed(0)}%!`
      );
      await safeAddCoins(userId, COINS.HIGH_SINTONIA, '🔥 Alta Sintonia!');
    } else if (newScore >= 65) {
      await createNotification(
        userId,
        'sintonia',
        `⚡ Boa Sintonia com ${aiModelName}: ${newScore.toFixed(0)}%`
      );
      await safeAddCoins(userId, COINS.HIGH_SINTONIA, '⚡ Boa Sintonia!');
    }

    console.log(`✅ Sintonia ${newScore} com ${aiModelName} registrada`);
  } catch (error) {
    console.error('Erro no onSintoniaIncrease:', error);
  }
}