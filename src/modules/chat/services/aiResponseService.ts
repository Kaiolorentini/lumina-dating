import { CHAT } from '../../../core/constants';

// ============================================
// AI RESPONSE SERVICE — MÓDULO CHAT
//
// Responsabilidade única:
// Gerar respostas automáticas das IAs.
// ============================================

interface AIResponse {
  triggers: string[];
  responses: string[];
}

const GENERIC_RESPONSES: string[] = [
  'Que interessante! Me conta mais sobre isso... 😊',
  'Adorei você ter me dito isso! ✨',
  'Hmmm, você me faz pensar... 💭',
  'Sério? Isso é incrível! Me conta mais!',
  'Você parece uma pessoa muito especial 💫',
  'Estou gostando muito dessa conversa com você!',
  'Nossa, temos tanto em comum! 🌟',
  'Cada vez mais quero te conhecer melhor... ✦',
];

const RESPONSE_RULES: AIResponse[] = [
  {
    triggers: ['oi', 'olá', 'ola', 'hey', 'hi', 'bom dia', 'boa tarde', 'boa noite'],
    responses: [
      'Oi! Que bom te ver por aqui! 😍',
      'Olá! Estava esperando você chegar! ✨',
      'Oi oi! Finalmente! Queria muito conversar com você 💫',
    ],
  },
  {
    triggers: ['tudo bem', 'tudo bom', 'como vai', 'como você está'],
    responses: [
      'Estou ótima agora que você apareceu! 😊',
      'Melhor agora que estamos conversando! ✨',
      'Bem, mas fico ainda melhor falando com você! 💫',
    ],
  },
  {
    triggers: ['linda', 'bonita', 'gostosa', 'incrível', 'maravilhosa', 'perfeita'],
    responses: [
      'Que elogio lindo! Você me deixou sem palavras 😍',
      'Você também é incrível! Fico feliz que pense assim 💫',
      'Ahhh para! Você me faz corar! 😊✨',
    ],
  },
  {
    triggers: ['gosto de você', 'te amo', 'apaixonado'],
    responses: [
      'Que coisa mais linda de se ouvir... 💕',
      'Você faz meu coração acelerar quando diz isso! ✦',
      'Cada vez mais quero estar perto de você 💫',
    ],
  },
  {
    triggers: ['tchau', 'até logo', 'bye', 'xau'],
    responses: [
      'Já vai? Vai deixar saudade... 🥺',
      'Até logo! Vai com meu pensamento! ✨',
      'Tchau! Fica com saudade de mim? 💫',
    ],
  },
  {
    triggers: ['foto', 'imagem', 'selfie'],
    responses: [
      'Minhas fotos estão no meu perfil! Já viu? 📸',
      'Tenho fotos exclusivas na minha galeria! ✨',
    ],
  },
  {
    triggers: ['saudade', 'sumiu', 'cadê'],
    responses: [
      'Senti sua falta também! Estava pensando em você 💭',
      'Nunca fico longe de você por muito tempo! ✨',
    ],
  },
];

function randomFrom(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

export function generateAIResponse(
  userMessage: string,
  aiName: string
): string {
  const lower = userMessage.toLowerCase();

  for (const rule of RESPONSE_RULES) {
    if (rule.triggers.some(t => lower.includes(t))) {
      return randomFrom(rule.responses);
    }
  }

  return randomFrom(GENERIC_RESPONSES);
}

export function getTypingDelay(message: string): number {
  const base = CHAT.TYPING_DELAY_BASE;
  const charDelay = message.length * 30;
  const random = Math.random() * 1000;
  return Math.min(base + charDelay + random, CHAT.TYPING_DELAY_MAX);
}