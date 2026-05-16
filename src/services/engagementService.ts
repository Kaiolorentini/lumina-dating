import { adicionarNotificacao } from './notificationsService';
import { addCoins } from './coinsService';
import { registrarVisita } from './visitsService';
import { registerVisit } from '../utils/dynamicSintonia';
import { dispararMensagemAutomatica } from './autoMessageService';
import { AI_MODELS } from '../utils/aiModels';

// ============================================
// SERVIÇO DE ENGAJAMENTO CENTRAL
//
// Orquestra todas as funcionalidades:
// Sintonia + Visitas + Notificações + Chat + Moedas
//
// FLUXO COMPLETO:
// 1. Usuário abre app → notificações geradas
// 2. Visita perfil → Sintonia aumenta + visita registrada
// 3. IA envia mensagem automática → notificação
// 4. Usuário responde → Sintonia aumenta + moedas ganhas
// 5. Desbloqueia conteúdo → moedas gastas
// ============================================

// PASSO 1 — Executado quando usuário abre o app
export async function onAppOpen(userId: string): Promise<void> {
  try {
    // Gera notificações de IAs online
    const onlineModels = AI_MODELS.filter(m => m.status === 'online');
    if (onlineModels.length > 0) {
      const randomModel = onlineModels[Math.floor(Math.random() * onlineModels.length)];
      await adicionarNotificacao(
        userId,
        'online',
        `${randomModel.name} está online agora e pode responder você ✨`
      );
    }

    // Notificação de Sintonia disponível
    await adicionarNotificacao(
      userId,
      'sintonia',
      'Nova Sintonia disponível! Confira perfis compatíveis ✦'
    );

    // Bônus diário de moedas (apenas uma vez por sessão)
    await addCoins(userId, 5, '🎁 Bônus diário de login');

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
    // Registra visita no sistema de visitas
    await registrarVisita(userId, aiModelId);

    // Registra visita no sistema de Sintonia dinâmica
    await registerVisit(userId, aiModelId);

    // Notifica o usuário que a IA viu a visita
    await adicionarNotificacao(
      userId,
      'visita',
      `${aiModelName} viu que você visitou o perfil dela 👀`
    );

    // Dispara mensagem automática da IA
    const model = AI_MODELS.find(m => m.id === aiModelId);
    if (model) {
      await dispararMensagemAutomatica(userId, model);
    }

    // Ganha moedas por visitar perfil
    await addCoins(userId, 2, `✦ Visitou perfil de ${aiModelName}`);

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
    // Ganha moedas por interagir
    await addCoins(userId, 1, `💬 Mensagem para ${aiModelName}`);

    // Notificação de resposta da IA
    setTimeout(async () => {
      await adicionarNotificacao(
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
    await adicionarNotificacao(
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
    // Notifica marcos importantes
    if (newScore >= 95) {
      await adicionarNotificacao(
        userId,
        'sintonia',
        `✦ Sintonia Perfeita com ${aiModelName}! Vocês são almas gêmeas!`
      );
      await addCoins(userId, 50, '✦ Sintonia Perfeita alcançada!');
    } else if (newScore >= 80) {
      await adicionarNotificacao(
        userId,
        'sintonia',
        `🔥 Sua Sintonia com ${aiModelName} chegou a ${newScore.toFixed(0)}%!`
      );
      await addCoins(userId, 20, '🔥 Alta Sintonia alcançada!');
    } else if (newScore >= 65) {
      await adicionarNotificacao(
        userId,
        'sintonia',
        `⚡ Boa Sintonia com ${aiModelName}: ${newScore.toFixed(0)}%`
      );
      await addCoins(userId, 10, '⚡ Boa Sintonia alcançada!');
    }

    console.log(`✅ Sintonia ${newScore} com ${aiModelName} registrada`);
  } catch (error) {
    console.error('Erro no onSintoniaIncrease:', error);
  }
}