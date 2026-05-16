import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { COLLECTIONS } from '../../../core/constants';
import { sendMessage, generateAIChatId } from './messageService';
import { AIModel } from '../../../utils/aiModels';

// ============================================
// AUTO MESSAGE SERVICE — MÓDULO CHAT
//
// Responsabilidade única:
// Disparar mensagem automática da IA
// ao usuário visitar o perfil.
// Anti-duplicata via Firestore.
// ============================================

const AUTO_MESSAGES: Record<string, string[]> = {
  'ai-1': ['Oi... senti uma Sintonia interessante com você ✨', 'Algo me diz que você é diferente 💫'],
  'ai-2': ['Oi! Que bom que você veio me visitar! 🌊', 'Estava esperando alguém especial aparecer... 😍'],
  'ai-3': ['Olá! Seu perfil chamou muito minha atenção 🎨', 'Tenho a sensação que temos muito em comum ✨'],
  'ai-4': ['Hmm... analisei seu perfil e achei muito interessante 💡', 'Você parece ser fascinante. Me conta mais? 🔍'],
  'ai-5': ['Oi! A natureza nos uniu aqui 🌿', 'Sinto que nossa Sintonia pode ser incrível ✦'],
  'ai-6': ['Ei! Que alegria te ver por aqui! 🌺', 'Você tem uma energia muito especial, sabia? 💫'],
  'ai-7': ['As palavras me faltam quando vejo seu perfil... 📚', 'Algo em você me inspira a escrever coisas bonitas ✨'],
  'ai-8': ['Oi! A floresta me sussurrou seu nome 🌿', 'Sinto que você tem uma alma aventureira 💚'],
  'ai-9': ['Olá. Analisei nossos perfis e a compatibilidade é alta ⚖️', 'Você parece diferente dos outros ✦'],
  'ai-10': ['Oi! Posso te dedicar uma música? 🎵', 'Sua presença aqui já me inspira a compor algo lindo ✨'],
};

const GENERIC = [
  'Oi... senti uma Sintonia interessante com você ✨',
  'Você parece diferente dos outros por aqui 💫',
  'Nossa Sintonia é uma das mais altas que já vi ✦',
];

function getAutoMessage(aiId: string): string {
  const messages = AUTO_MESSAGES[aiId] || GENERIC;
  return messages[Math.floor(Math.random() * messages.length)];
}

async function wasAutoMessageSent(chatId: string): Promise<boolean> {
  try {
    const ref = doc(db, COLLECTIONS.AUTO_MESSAGES, chatId);
    const snap = await getDoc(ref);
    return snap.exists();
  } catch {
    return false;
  }
}

async function markAutoMessageSent(chatId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.AUTO_MESSAGES, chatId);
  await setDoc(ref, { sent: true, timestamp: serverTimestamp() });
}

export async function dispararMensagemAutomatica(
  userId: string,
  aiModel: AIModel,
  delayMs?: number
): Promise<boolean> {
  try {
    const chatId = generateAIChatId(userId, aiModel.id);

    const alreadySent = await wasAutoMessageSent(chatId);
    if (alreadySent) return false;

    const delay = delayMs || Math.floor(Math.random() * 3000) + 2000;
    await new Promise(resolve => setTimeout(resolve, delay));

    const message = getAutoMessage(aiModel.id);
    await sendMessage(chatId, message, aiModel.id, aiModel.name, true);
    await markAutoMessageSent(chatId);

    return true;
  } catch (error) {
    console.error('Erro ao disparar mensagem automática:', error);
    return false;
  }
}