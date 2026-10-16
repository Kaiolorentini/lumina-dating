// ============================================
// LUMINA — MOLDURA DAS TELAS NO COMPUTADOR (T0)
// src/components/web/DesktopScreenFrame.tsx
//
// 14/10/2026. No computador, as telas da pilha (perfil de outra
// pessoa, produto, missões, suporte, admin…) abriam esticadas de
// ponta a ponta do monitor. O AppNavigator agora passa cada uma por
// esta moldura (screenLayout), SÓ no computador:
//   • fundo do app em toda a janela;
//   • a tela numa coluna central (980 px; telas de admin 1320 px),
//     com borda e sombra discretas — cara de site, não de celular
//     esticado;
//   • marca "✦ Lumina" no canto, que leva para a Home.
// Voltar e 🏠 continuam no cabeçalho de cada tela (como no app).
// Celular, tablet e app: a moldura não é usada.
//
// Telas que ganharem layout próprio de computador entram em
// FULL_BLEED_ROUTES e deixam de usar a coluna.
//
// T1 (14/10/2026): também nas telas de entrada (login, cadastro,
// termos, verificação…), numa coluna de formulário (640 px). Sem
// `onHome` (antes do login não há Home), a marca aparece sem link.
// ============================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';
import { CONTENT_MAX_WIDTH } from '../../utils/breakpoints';
import HoverPressable from './HoverPressable';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { FrameWidthContext } from '../../hooks/useAvailableWidth';

/** Largura da coluna das telas comuns. */
const DEFAULT_COLUMN = 980;

/** Telas que já têm layout próprio de computador (ocupam tudo). */
export const FULL_BLEED_ROUTES = new Set<string>([
  'MainTabs',
  'UserChat',
  'Splash',
]);

/** Telas de entrada: coluna de formulário. */
const GATE_ROUTES = new Set<string>([
  'Login', 'Register', 'TermsGate', 'ProfileOnboarding', 'AgeVerificationGate',
  'VerificationPendingGate', 'AccountBannedGate', 'GateError',
]);

/** Admin com listas em grade (T3): coluna larga. Telas de detalhe
 *  do admin (usuário, produto, verificação, relatórios) ficam na
 *  coluna normal — texto em 1.300 px cansa a leitura. */
const ADMIN_WIDE_ROUTES = new Set<string>([
  'Admin', 'AdminPanel', 'AdminDashboard',
  'AdminCoupons', 'AdminCreatorRequests', 'AdminFraudFlags', 'AdminProductsModeration',
  'AdminRefundRequests', 'AdminSales', 'AdminSupport', 'AdminUserSearch', 'AdminWithdrawals',
]);

/** T4: formulários de uma coluna — campos em 640 px leem melhor. */
const FORM_ROUTES = new Set<string>([
  'PaymentSetup', 'Withdrawal', 'CreatorRequest', 'SupportNew',
  'DeleteAccount', 'ProfileSetup', 'Interests',
]);

/** T4: telas de leitura e progresso (texto, listas verticais) — 820 px.
 *  T5: Missões, Cofre e XP saíram daqui (viraram painel de 2 colunas),
 *  e Editar produto saiu dos formulários (tem a prévia ao lado). */
const READING_ROUTES = new Set<string>([
  'CreatorAgreement', 'Support', 'SupportTicket', 'Notifications', 'Faisca', 'Fragments',
  'Prestige', 'GalaxiaPlus', 'PremiumTools', 'Titles',
  'MyEarnings', 'DestinyCard',
]);

export function columnWidthFor(routeName: string): number {
  if (GATE_ROUTES.has(routeName)) return CONTENT_MAX_WIDTH.form;
  if (FORM_ROUTES.has(routeName)) return CONTENT_MAX_WIDTH.form;
  if (READING_ROUTES.has(routeName)) return CONTENT_MAX_WIDTH.reading;
  return ADMIN_WIDE_ROUTES.has(routeName) ? CONTENT_MAX_WIDTH.wide : DEFAULT_COLUMN;
}

interface Props {
  routeName: string;
  /** Sem onHome (telas de entrada), a marca não é link. */
  onHome?:   () => void;
  children:  React.ReactNode;
}

export default function DesktopScreenFrame({ routeName, onHome, children }: Props) {
  const { width } = useBreakpoint();
  if (FULL_BLEED_ROUTES.has(routeName)) return <>{children}</>;
  const column = columnWidthFor(routeName);
  // A marca só aparece quando sobra margem ao lado da coluna.
  const showBrand = width - column >= 2 * 170;

  return (
    <View style={styles.backdrop}>
      {showBrand && onHome && (
      <HoverPressable
        onPress={onHome}
        accessibilityRole="link"
        accessibilityLabel="Lumina — ir para o início"
        style={styles.brand}
        hoverStyle={styles.brandHover}
      >
        <Text style={styles.brandMark}>✦</Text>
        <Text style={styles.brandText}>Lumina</Text>
      </HoverPressable>
      )}
      {showBrand && !onHome && (
        <View style={styles.brand} accessibilityRole="header">
          <Text style={styles.brandMark}>✦</Text>
          <Text style={styles.brandText}>Lumina</Text>
        </View>
      )}

      <View style={[styles.column, { maxWidth: column }]}>
        {/* Telas que medem a largura (useAvailableWidth) usam a da coluna. */}
        <FrameWidthContext.Provider value={Math.min(column, width - 48)}>
          {children}
        </FrameWidthContext.Provider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#080808',
    paddingTop: 20,
    paddingHorizontal: 24,
  },
  brand: {
    position: 'absolute',
    top: 22,
    left: 24,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  brandHover: { backgroundColor: colors.surface },
  brandMark:  { color: colors.gold, fontSize: 20 },
  brandText:  { color: colors.gold, fontSize: fonts.sizes.lg, fontWeight: 'bold', letterSpacing: 2 },
  column: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#242424',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
  },
});
