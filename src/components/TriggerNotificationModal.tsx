// ============================================
// LUMINA — TRIGGER NOTIFICATION MODAL v5.2
// src/components/TriggerNotificationModal.tsx
//
// v5.2: Verifica saldo antes de revelar.
// Se saldo < custo → mostra opção de compra.
//
// CUSTOS (espelho de economy.ts):
// REVEAL_QUASE_SINTONIA:   25 cristais
// REVEAL_SINTONIA_PERDIDA: 35 cristais (premium only)
// REVEAL_PENSOU_EM_VOCE:   20 cristais
// ============================================

import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet,
  TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient }  from 'expo-linear-gradient';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useCoins }        from '../context/CoinsContext';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT , colors , alpha, GLASS } from '../theme/tokens';

const functions = getFunctions();

export type TriggerType =
  | 'quase_sintonia'
  | 'sintonia_perdida'
  | 'pensou_em_voce'
  | 'cofre_cheio';

interface Props {
  visible:     boolean;
  type:        TriggerType;
  sintonia?:   number;
  visitorId?:  string;
  fragments?:  number;
  onClose:     () => void;
  onNavigate:  (userId: string) => void;
  onGoToStore: () => void; // navega para StoreScreen
}

// Espelho de economy.ts — cliente usa só para exibição
// Backend decide o preço real no spendCoins
const REVEAL_COSTS: Partial<Record<TriggerType, number>> = {
  quase_sintonia:   25,
  sintonia_perdida: 35,
  pensou_em_voce:   20,
};

const TRIGGER_CONFIG: Record<TriggerType, {
  icon:        string;
  title:       string;
  color:       string;
  gradient:    [string, string];
  message:     string;
  revealFeature?: string;
  isPremium?:  boolean;
}> = {
  quase_sintonia: {
    icon:          '💜',
    title:         'Quase Sintonia',
    color:         colors.secondaryLegacy,
    gradient:      [colors.cardLegacy, '#2D1B4E'],
    message:       'Esta pessoa tem alta compatibilidade com você. Será que é especial?',
    revealFeature: 'REVEAL_QUASE_SINTONIA',
    isPremium:     false,
  },
  sintonia_perdida: {
    icon:          '💔',
    title:         'Sintonia Perdida',
    color:         colors.errorLegacy,
    gradient:      ['#2E0A0A', '#4E1B1B'],
    message:       'Uma conexão especial não voltou. Talvez ainda dê tempo...',
    revealFeature: 'REVEAL_SINTONIA_PERDIDA',
    isPremium:     true, // exige cristais Premium
  },
  pensou_em_voce: {
    icon:          '✨',
    title:         'Pensou em Você',
    color:         colors.goldLegacy,
    gradient:      ['#2E2A0A', '#4E441B'],
    message:       'Esta pessoa visitou seu perfil 3 vezes hoje. Está pensando em você!',
    revealFeature: 'REVEAL_VISITORS',
    isPremium:     false,
  },
  cofre_cheio: {
    icon:          '🗝️',
    title:         'Cofre Cheio',
    color:         colors.info,
    gradient:      ['#0A1A2E', '#1B3D4E'],
    message:       'Você tem fragmentos esperando para virar cristais!',
  },
};

export default function TriggerNotificationModal({
  visible, type, sintonia, visitorId, fragments,
  onClose, onNavigate, onGoToStore,
}: Props) {
  const { wallet, spend } = useCoins();
  const [revealing,    setRevealing]    = useState(false);
  const [revealed,     setRevealed]     = useState(false);
  const [visitorData,  setVisitorData]  = useState<{ name: string; photoURL: string; uid: string } | null>(null);
  const [converting,   setConverting]   = useState(false);

  const cfg  = TRIGGER_CONFIG[type];
  const cost = REVEAL_COSTS[type] ?? 0;

  // Saldo total disponível
  const coinsGratuitos = wallet?.coinsGratuitos ?? 0;
  const coinsPremium   = wallet?.coinsPremium   ?? 0;

  // Para features premium: verifica só Premium
  // Para features comuns: verifica total (gratuitos + premium)
  const saldoDisponivel = cfg.isPremium
    ? coinsPremium
    : coinsGratuitos + coinsPremium;

  const semSaldo = cost > 0 && saldoDisponivel < cost;

  async function handleReveal() {
    if (!visitorId || !cfg.revealFeature) return;
    setRevealing(true);
    try {
      const success = await spend(
        cfg.revealFeature as any,
        `reveal_${type}_${visitorId}_${Date.now()}`
      );
      if (success) {
        const fn = httpsCallable<{ userId: string }, { name: string; photoURL: string; uid: string }>(
          functions, 'getUserPublicProfile'
        );
        const result = await fn({ userId: visitorId });
        setVisitorData(result.data);
        setRevealed(true);
      }
    } catch (error) {
      console.error('[TriggerModal] reveal error:', error);
    } finally {
      setRevealing(false);
    }
  }

  async function handleConvertFragments() {
    setConverting(true);
    try {
      const fn = httpsCallable(functions, 'convertFragments');
      await fn({});
      onClose();
    } catch (error) {
      console.error('[TriggerModal] convert error:', error);
    } finally {
      setConverting(false);
    }
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <BlurView intensity={GLASS.blur.heavy} tint="dark" style={styles.overlay}>
        <LinearGradient colors={cfg.gradient} style={styles.card}>

          {/* Ícone + Título */}
          <Text style={styles.icon}>{cfg.icon}</Text>
          <Text style={[styles.title, { color: cfg.color }]}>{cfg.title}</Text>

          {/* Chip de sintonia */}
          {sintonia && (
            <View style={[styles.sintoniaChip, { borderColor: cfg.color }]}>
              <Text style={[styles.sintoniaText, { color: cfg.color }]}>
                {sintonia}% de compatibilidade
              </Text>
            </View>
          )}

          {/* ── COFRE CHEIO ── */}
          {type === 'cofre_cheio' && (
            <>
              <Text style={styles.message}>
                Você acumulou {fragments} fragmentos de Sintonia!{'\n'}
                100 fragmentos = 1 Cristal Gratuito
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: cfg.color }]}
                onPress={handleConvertFragments}
                disabled={converting}
              >
                {converting
                  ? <ActivityIndicator color={COLORS.background} />
                  : <Text style={styles.primaryBtnText}>🗝️ Converter agora</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {/* ── GATILHOS COM PERFIL ── */}
          {type !== 'cofre_cheio' && (
            <>
              {/* Perfil borrado ou revelado */}
              <View style={styles.profileArea}>
                {revealed && visitorData ? (
                  /* Revelado */
                  <View style={styles.revealedProfile}>
                    {visitorData.photoURL ? (
                      <Image source={{ uri: visitorData.photoURL }} style={styles.profilePhoto} />
                    ) : (
                      <View style={[styles.profilePhoto, styles.photoPlaceholder]}>
                        <Text style={{ fontSize: 40 }}>👤</Text>
                      </View>
                    )}
                    <Text style={styles.revealedName}>{visitorData.name}</Text>
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: cfg.color }]}
                      onPress={() => { onClose(); onNavigate(visitorData.uid); }}
                    >
                      <Text style={styles.primaryBtnText}>Ver perfil completo ›</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* Borrado */
                  <View style={styles.blurredProfile}>
                    <View style={styles.blurredCircle}>
                      <Text style={styles.blurredIcon}>👤</Text>
                      <View style={styles.blurOverlay} />
                    </View>
                    <Text style={styles.blurredLabel}>Perfil oculto</Text>

                    {/* Tem saldo suficiente → botão revelar */}
                    {cfg.revealFeature && !semSaldo && (
                      <TouchableOpacity
                        style={[styles.revealBtn, { borderColor: cfg.color }]}
                        onPress={handleReveal}
                        disabled={revealing}
                      >
                        {revealing
                          ? <ActivityIndicator color={cfg.color} size="small" />
                          : <Text style={[styles.revealBtnText, { color: cfg.color }]}>
                              {cfg.isPremium ? '💎' : '✨'} Revelar por {cost} cristais
                            </Text>
                        }
                      </TouchableOpacity>
                    )}

                    {/* Sem saldo → botão comprar */}
                    {cfg.revealFeature && semSaldo && (
                      <View style={styles.semSaldoContainer}>
                        <Text style={styles.semSaldoText}>
                          Você precisa de {cost} cristais{cfg.isPremium ? ' Premium 💎' : ' ✨'} para revelar.{'\n'}
                          Você tem {saldoDisponivel}.
                        </Text>
                        <TouchableOpacity
                          style={styles.comprarBtn}
                          onPress={() => { onClose(); onGoToStore(); }}
                        >
                          <Text style={styles.comprarBtnText}>
                            💎 Comprar Cristais
                          </Text>
                        </TouchableOpacity>
                        {/* Se for premium only — explica */}
                        {cfg.isPremium && (
                          <Text style={styles.premiumNote}>
                            ⚠️ Sintonia Perdida exige Cristais Premium
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>

              <Text style={styles.message}>{cfg.message}</Text>
            </>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Fechar</Text>
          </TouchableOpacity>

        </LinearGradient>
      </BlurView>
    </Modal>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  overlay:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl },
  card:             { width: '100%', borderRadius: R.xl, padding: S.xl, alignItems: 'center', gap: S.md, borderWidth: 1, borderColor: alpha(colors.secondaryLegacy, 0.3) },
  icon:             { fontSize: 56 },
  title:            { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold, textAlign: 'center' },
  sintoniaChip:     { borderRadius: R.full, borderWidth: 1, paddingHorizontal: S.lg, paddingVertical: S.xs },
  sintoniaText:     { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  profileArea:      { width: '100%', alignItems: 'center' },

  // Perfil borrado
  blurredProfile:   { alignItems: 'center', gap: S.md },
  blurredCircle:    { width: 100, height: 100, borderRadius: 50, overflow: 'hidden', position: 'relative', backgroundColor: COLORS.card },
  blurredIcon:      { fontSize: 60, textAlign: 'center', lineHeight: 100 },
  blurOverlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(13,13,26,0.85)' },
  blurredLabel:     { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },

  // Botão revelar (tem saldo)
  revealBtn:        { borderRadius: R.lg, borderWidth: 1, paddingVertical: S.sm, paddingHorizontal: S.lg },
  revealBtnText:    { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },

  // Sem saldo
  semSaldoContainer: { alignItems: 'center', gap: S.sm, width: '100%' },
  semSaldoText:     { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },
  comprarBtn:       { width: '100%', backgroundColor: colors.goldLegacy, borderRadius: R.lg, paddingVertical: S.md, alignItems: 'center' },
  comprarBtnText:   { color: COLORS.background, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extrabold },
  premiumNote:      { color: colors.errorLegacy, fontSize: FONT_SIZE.xs, textAlign: 'center' },

  // Perfil revelado
  revealedProfile:  { alignItems: 'center', gap: S.md },
  profilePhoto:     { width: 100, height: 100, borderRadius: 50 },
  photoPlaceholder: { backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  revealedName:     { color: COLORS.surface, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },

  // Geral
  message:          { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },
  primaryBtn:       { borderRadius: R.lg, paddingVertical: S.md, paddingHorizontal: S.xl, marginTop: S.sm },
  primaryBtnText:   { color: COLORS.background, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  closeBtn:         { paddingVertical: S.sm },
  closeBtnText:     { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
});