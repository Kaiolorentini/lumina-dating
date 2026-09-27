// ============================================
// LUMINA — TRIGGER NOTIFICATION MODAL v6.0
// src/components/TriggerNotificationModal.tsx
//
// v6.0 (27/09) — A REVELAÇÃO É DO SERVIDOR.
// O modal recebia o id de quem visitou e cobrava pelo spendCoins
// antes de buscar o perfil: a pessoa já estava no app, a cobrança
// era só uma trava na tela, e "Pensou em Você" mostrava 20 e
// cobrava 50. Agora envia só o id da NOTIFICAÇÃO à CF
// revealTrigger, que confere, cobra o preço certo e revela.
//
// Galáxia Plus: Quase Sintonia e Pensou em Você grátis. Sintonia
// Perdida é paga para todos, em premium.
//
// "Cofre Cheio" abre o Cofre (convertia a carteira, e não o Cofre).
// ============================================

import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, StyleSheet,
  TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useCoins }        from '../context/CoinsContext';
import { fetchGalaxiaPlusStatus } from '../modules/premium/services/galaxiaPlusService';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme/tokens';

const functions = getFunctions();

export type TriggerType =
  | 'quase_sintonia'
  | 'sintonia_perdida'
  | 'pensou_em_voce'
  | 'cofre_cheio';

interface Props {
  visible:         boolean;
  type:            TriggerType;
  sintonia?:       number;
  notificationId?: string;
  fragments?:      number;
  onClose:         () => void;
  onNavigate:      (userId: string) => void;
  onGoToStore:     () => void;
  onOpenVault:     () => void;
}

interface RevealRequest  { notificationId: string }
interface RevealResponse {
  uid:             string;
  name:            string;
  photoURL:        string;
  charged:         number;
  free:            boolean;
  alreadyRevealed: boolean;
}

// Só exibição — o preço real é decidido pelo servidor (economy.ts).
const TRIGGER_CONFIG: Record<TriggerType, {
  icon:          string;
  title:         string;
  color:         string;
  gradient:      [string, string];
  message:       string;
  cost?:         number;
  isPremium?:    boolean;
  freeWithPlus?: boolean;
}> = {
  quase_sintonia: {
    icon: '💜', title: 'Quase Sintonia', color: '#B57BEE',
    gradient: ['#1A0A2E', '#2D1B4E'],
    message: 'Esta pessoa tem alta compatibilidade com você. Será que é especial?',
    cost: 25, freeWithPlus: true,
  },
  sintonia_perdida: {
    icon: '💔', title: 'Sintonia Perdida', color: '#FF6B6B',
    gradient: ['#2E0A0A', '#4E1B1B'],
    message: 'Uma conexão especial não voltou. Talvez ainda dê tempo...',
    cost: 35, isPremium: true,
  },
  pensou_em_voce: {
    icon: '✨', title: 'Pensou em Você', color: '#FFD700',
    gradient: ['#2E2A0A', '#4E441B'],
    message: 'Esta pessoa visitou seu perfil 3 vezes hoje. Está pensando em você!',
    cost: 20, freeWithPlus: true,
  },
  cofre_cheio: {
    icon: '🗝️', title: 'Cofre Cheio', color: '#56CCF2',
    gradient: ['#0A1A2E', '#1B3D4E'],
    message: 'Seu Cofre está cheio. Saque os fragmentos para continuar acumulando.',
  },
};

export default function TriggerNotificationModal({
  visible, type, sintonia, notificationId, fragments,
  onClose, onNavigate, onGoToStore, onOpenVault,
}: Props) {
  const { wallet, refreshWallet } = useCoins();
  const [revealing,   setRevealing]   = useState(false);
  const [visitorData, setVisitorData] = useState<RevealResponse | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [isPlus,      setIsPlus]      = useState(false);

  const cfg  = TRIGGER_CONFIG[type];
  const cost = cfg.cost ?? 0;

  // Notificação nova no mesmo modal: começa do zero.
  useEffect(() => {
    setVisitorData(null);
    setError(null);
  }, [notificationId, visible]);

  // Só importa para os gatilhos grátis com a assinatura.
  useEffect(() => {
    if (!visible || !cfg.freeWithPlus) return;
    let alive = true;
    fetchGalaxiaPlusStatus()
      .then(s => { if (alive) setIsPlus(s.active === true); })
      .catch(() => { /* sem status: mostra o preço normal */ });
    return () => { alive = false; };
  }, [visible, cfg.freeWithPlus]);

  const coinsGratuitos  = wallet?.coinsGratuitos ?? 0;
  const coinsPremium    = wallet?.coinsPremium   ?? 0;
  const saldoDisponivel = cfg.isPremium ? coinsPremium : coinsGratuitos + coinsPremium;
  const free            = !!cfg.freeWithPlus && isPlus;
  const semSaldo        = !free && cost > 0 && saldoDisponivel < cost;

  async function handleReveal() {
    if (!notificationId || revealing) return;
    setRevealing(true);
    setError(null);
    try {
      const fn     = httpsCallable<RevealRequest, RevealResponse>(functions, 'revealTrigger');
      const result = await fn({ notificationId });
      setVisitorData(result.data);
      if (result.data.charged > 0) await refreshWallet();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não foi possível revelar.';
      setError(message);
    } finally {
      setRevealing(false);
    }
  }

  if (!visible) return null;

  const revealLabel = free
    ? '💜 Revelar grátis · Galáxia Plus'
    : `${cfg.isPremium ? '💎' : '✨'} Revelar por ${cost} ${cfg.isPremium ? 'Cristais Premium' : 'cristais'}`;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <LinearGradient colors={cfg.gradient} style={styles.card}>

          <Text style={styles.icon}>{cfg.icon}</Text>
          <Text style={[styles.title, { color: cfg.color }]}>{cfg.title}</Text>

          {typeof sintonia === 'number' && sintonia > 0 && (
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
                {typeof fragments === 'number' ? `${fragments} fragmentos no Cofre.\n` : ''}
                {cfg.message}
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: cfg.color }]}
                onPress={() => { onClose(); onOpenVault(); }}
                accessibilityRole="button"
                accessibilityLabel="Abrir o Cofre"
              >
                <Text style={styles.primaryBtnText}>🗝️ Abrir o Cofre</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── GATILHOS COM PERFIL ── */}
          {type !== 'cofre_cheio' && (
            <>
              <View style={styles.profileArea}>
                {visitorData ? (
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
                      accessibilityRole="button"
                      accessibilityLabel={`Ver perfil de ${visitorData.name}`}
                    >
                      <Text style={styles.primaryBtnText}>Ver perfil completo ›</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.blurredProfile}>
                    <View style={styles.blurredCircle}>
                      <Text style={styles.blurredIcon}>👤</Text>
                      <View style={styles.blurOverlay} />
                    </View>
                    <Text style={styles.blurredLabel}>Perfil oculto</Text>

                    {!semSaldo ? (
                      <TouchableOpacity
                        style={[styles.revealBtn, { borderColor: cfg.color }]}
                        onPress={handleReveal}
                        disabled={revealing || !notificationId}
                        accessibilityRole="button"
                        accessibilityLabel={revealLabel}
                      >
                        {revealing
                          ? <ActivityIndicator color={cfg.color} size="small" />
                          : <Text style={[styles.revealBtnText, { color: cfg.color }]}>{revealLabel}</Text>}
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.semSaldoContainer}>
                        <Text style={styles.semSaldoText}>
                          Você precisa de {cost} {cfg.isPremium ? 'Cristais Premium 💎' : 'cristais ✨'} para revelar.{'\n'}
                          Você tem {saldoDisponivel}.
                        </Text>
                        <TouchableOpacity
                          style={styles.comprarBtn}
                          onPress={() => { onClose(); onGoToStore(); }}
                          accessibilityRole="button"
                          accessibilityLabel="Comprar cristais"
                        >
                          <Text style={styles.comprarBtnText}>💎 Comprar Cristais</Text>
                        </TouchableOpacity>
                        {cfg.freeWithPlus && (
                          <Text style={styles.plusNote}>Grátis para quem tem a Galáxia Plus</Text>
                        )}
                        {cfg.isPremium && (
                          <Text style={styles.premiumNote}>⚠️ Sintonia Perdida exige Cristais Premium</Text>
                        )}
                      </View>
                    )}

                    {error && <Text style={styles.errorText}>{error}</Text>}
                  </View>
                )}
              </View>

              <Text style={styles.message}>{cfg.message}</Text>
            </>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeBtnText}>Fechar</Text>
          </TouchableOpacity>

        </LinearGradient>
      </View>
    </Modal>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: S.xl },
  card:             { width: '100%', borderRadius: R.xl, padding: S.xl, alignItems: 'center', gap: S.md, borderWidth: 1, borderColor: 'rgba(181,123,238,0.3)' },
  icon:             { fontSize: 56 },
  title:            { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold, textAlign: 'center' },
  sintoniaChip:     { borderRadius: R.full, borderWidth: 1, paddingHorizontal: S.lg, paddingVertical: S.xs },
  sintoniaText:     { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  profileArea:      { width: '100%', alignItems: 'center' },

  blurredProfile:   { alignItems: 'center', gap: S.md },
  blurredCircle:    { width: 100, height: 100, borderRadius: 50, overflow: 'hidden', position: 'relative', backgroundColor: COLORS.card },
  blurredIcon:      { fontSize: 60, textAlign: 'center', lineHeight: 100 },
  blurOverlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(13,13,26,0.85)' },
  blurredLabel:     { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },

  revealBtn:        { borderRadius: R.lg, borderWidth: 1, paddingVertical: S.sm, paddingHorizontal: S.lg, minHeight: 44, justifyContent: 'center' },
  revealBtnText:    { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },

  semSaldoContainer: { alignItems: 'center', gap: S.sm, width: '100%' },
  semSaldoText:     { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },
  comprarBtn:       { width: '100%', backgroundColor: '#FFD700', borderRadius: R.lg, paddingVertical: S.md, alignItems: 'center' },
  comprarBtnText:   { color: COLORS.background, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extrabold },
  plusNote:         { color: '#B57BEE', fontSize: FONT_SIZE.xs, textAlign: 'center' },
  premiumNote:      { color: '#FF6B6B', fontSize: FONT_SIZE.xs, textAlign: 'center' },
  errorText:        { color: '#FF6B6B', fontSize: FONT_SIZE.sm, textAlign: 'center' },

  revealedProfile:  { alignItems: 'center', gap: S.md },
  profilePhoto:     { width: 100, height: 100, borderRadius: 50 },
  photoPlaceholder: { backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  revealedName:     { color: COLORS.surface, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },

  message:          { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },
  primaryBtn:       { borderRadius: R.lg, paddingVertical: S.md, paddingHorizontal: S.xl, marginTop: S.sm },
  primaryBtnText:   { color: COLORS.background, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  closeBtn:         { paddingVertical: S.sm },
  closeBtnText:     { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
});