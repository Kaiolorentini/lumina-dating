// ============================================
// LUMINA — MEU PAINEL (marketplace + criador)
// src/screens/marketplace/CreatorPanelScreen.tsx
//
// Entrega 1 do Painel do Criador (decisões de Kaio, 09/10/2026):
//  • Aba "Painel" no rodapé para todos, menos o superadmin (ele
//    entra por um card no Painel Admin — 8 abas não cabem).
//  • TUDO do marketplace saiu do Meu Perfil e veio para cá:
//      - Suas compras: Minhas Compras, Favoritos, Explorar;
//      - Área do criador: para quem vende, as ferramentas; para
//        quem ainda não vende, o caminho para virar criador
//        explicado passo a passo, com o status do pedido.
//  • Cada opção explica para que serve.
//  • Rodapé com os números do criador: Vendas e Faturamento em
//    "Este mês" e "Desde o início", e a Avaliação média.
//
// A mesma tela é a aba (MainTabs → CreatorHub) e a rota de pilha
// CreatorPanel (atalho do superadmin no Painel Admin).
//
// Entrega 2 (09/10/2026) — a parte que prende:
//  • 🎯 Meta do mês automática: bater o melhor dos 3 meses
//    anteriores (R$ 50 no começo), com barra de progresso e
//    comparação com o mês passado.
//  • 💡 Próximos passos: até 3 sugestões tiradas dos dados reais
//    (produto recusado, saldo para sacar, produto com visitas e
//    sem venda, campeão de vendas, mês parado, primeiro conteúdo).
//  • Gráfico dos últimos 6 meses no rodapé de números.
//  Sem nível de criador por enquanto (decisão de Kaio).
//  • Saldo disponível direto no card Meus Ganhos (e a pendência,
//    se houver) — a mesma escuta da carteira já usada nas sugestões.
//
// Balões (09/10/2026): faixa "N novidades" no topo, como a do
// Painel Admin, e balão em cada card — inclusive no "Seja criador"
// quando o pedido é recusado (creator_rejected).
//
// Leituras: o resumo do criador é UM documento (creatorStats),
// escutado só por quem vende. O pedido de criador só é escutado
// por quem ainda não vende. Os balões reaproveitam a escuta de
// notificações de useProfileBadges.
//
// 14/10/2026 (web T1) — COMPUTADOR. A aba esticava os cartões de 2
// em 2 pela tela inteira. No computador: conteúdo numa coluna de até
// 1200 px, cartões lado a lado (até 4 por linha) e os números do
// criador numa coluna à direita, sempre à vista. Celular e app: iguais.
// ============================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MP, MP_GRADIENT, MP_SHADOW, MP_FONT, spacing, borderRadius } from '../../theme/marketplace';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useCreatorRequests } from '../../hooks/useCreatorRequests';
import { useCreatorStats } from '../../hooks/useCreatorStats';
import { useProfileBadges } from '../../modules/profile/hooks/useProfileBadges';
import { formatBRL } from '../../services/marketplace/adminDashboardService';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import {
  CreatorMonth, CreatorStats, CreatorStatsBucket, FIRST_GOAL,
  currentDayOfMonth, currentMonthKey,
} from '../../services/marketplace/creatorStatsService';
import { listenToCreatorWallet } from '../../services/marketplace/creatorWalletService';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type StackRoute =
  | 'MyPurchases' | 'MyFavorites' | 'CreatorRequest' | 'CreateProduct'
  | 'MyProducts' | 'MyEarnings' | 'Withdrawal' | 'PaymentSetup';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function monthNameOf(key: string): string {
  return MONTH_NAMES[Number(key.slice(5, 7)) - 1] ?? key;
}

function currentMonthName(): string {
  return monthNameOf(currentMonthKey());
}

/** Mesmo mínimo do servidor (requestWithdrawal: MIN_WITHDRAWAL). */
const MIN_WITHDRAWAL = 10;
/** Visitas sem nenhum pedido a partir das quais vale sugerir capa/prévia. */
const VIEWS_WITHOUT_ORDER = 20;
/** Dia do mês a partir do qual "mês sem venda" vira sugestão. */
const QUIET_MONTH_DAY = 8;

/** "R$ 1,2 mil" para caber em cima da barra do gráfico. */
function compactBRL(value: number): string {
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1).replace('.', ',')} mil`;
  return `R$ ${Math.round(value)}`;
}

/** Altura da barra: mínimo visível quando há valor, traço quando zero. */
function barHeight(ratio: number): `${number}%` {
  return `${Math.max(ratio * 100, ratio > 0 ? 6 : 2)}%`;
}

// ============================================
// Peças visuais
// ============================================

function Badge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

interface OptionCardProps {
  icon: string;
  title: string;
  description: string;
  /** Número em destaque abaixo do título (ex.: saldo). */
  value?: string;
  /** Linha de alerta abaixo do valor (ex.: pendência). */
  valueNote?: string;
  count?: number;
  disabled?: boolean;
  disabledReason?: string;
  onPress: () => void;
}

function OptionCard({
  icon, title, description, value, valueNote, count = 0, disabled, disabledReason, onPress,
}: OptionCardProps) {
  const { isDesktop } = useBreakpoint();
  return (
    <TouchableOpacity
      style={[styles.optionCard, isDesktop && styles.optionCardDesktop, count > 0 && styles.optionCardAlert, disabled && styles.optionCardDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={count > 0 ? `${title}, ${count} novidades` : title}
      accessibilityHint={disabled && disabledReason ? disabledReason : description}
    >
      <View style={styles.optionIconWrap}>
        <Text style={styles.optionIcon}>{icon}</Text>
      </View>
      <Text style={styles.optionTitle}>{title}</Text>
      {!!value && <Text style={styles.optionValue}>{value}</Text>}
      {!!valueNote && <Text style={styles.optionValueNote}>{valueNote}</Text>}
      <Text style={styles.optionDescription}>
        {disabled && disabledReason ? disabledReason : description}
      </Text>
      <Badge count={count} />
    </TouchableOpacity>
  );
}

function Banner({ icon, text, tone }: { icon: string; text: string; tone: 'warn' | 'info' }) {
  return (
    <View style={[styles.banner, tone === 'warn' ? styles.bannerWarn : styles.bannerInfo]}>
      <Text style={styles.bannerIcon}>{icon}</Text>
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

// ============================================
// Quem ainda não vende: o caminho para virar criador
// ============================================

interface JourneyProps {
  uid: string | undefined;
  blockedReason: string | null;
  /** Recusa ainda não vista (notificação creator_rejected). */
  unseen: number;
  onOpenRequest: () => void;
}

function CreatorJourney({ uid, blockedReason, unseen, onOpenRequest }: JourneyProps) {
  const { request, loading, isPending, isApproved, isRejected } = useCreatorRequests(uid);

  if (loading) {
    return (
      <View style={styles.journeyCard}>
        <ActivityIndicator color={MP.gold} />
      </View>
    );
  }

  if (isApproved) {
    return (
      <View style={styles.journeyCard}>
        <Text style={styles.journeyIcon}>✅</Text>
        <Text style={styles.journeyTitle}>Pedido aprovado!</Text>
        <Text style={styles.journeyText}>
          Estamos liberando a sua área de criador. Ela aparece aqui em instantes — se demorar,
          feche e abra o app.
        </Text>
      </View>
    );
  }

  if (isPending) {
    return (
      <View style={styles.journeyCard}>
        <Text style={styles.journeyIcon}>⏳</Text>
        <Text style={styles.journeyTitle}>Seu pedido está em análise</Text>
        <Text style={styles.journeyText}>
          Nossa equipe está conferindo o seu pedido. Você recebe uma notificação assim que sair a
          resposta — não precisa fazer mais nada agora.
        </Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onOpenRequest} accessibilityRole="button">
          <Text style={styles.secondaryBtnText}>Ver meu pedido</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.journeyCard, unseen > 0 && styles.journeyCardAlert]}>
      <Badge count={unseen} />
      {isRejected ? (
        <>
          <Text style={styles.journeyIcon}>📝</Text>
          <Text style={styles.journeyTitle}>Seu último pedido não foi aprovado</Text>
          {!!request?.rejectionReason && (
            <Text style={styles.journeyReason}>Motivo: {request.rejectionReason}</Text>
          )}
          <Text style={styles.journeyText}>
            Você pode enviar um novo pedido quando quiser. Leia os termos com atenção antes.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.journeyIcon}>🎨</Text>
          <Text style={styles.journeyTitle}>Venda seus conteúdos no Lumina</Text>
          <Text style={styles.journeyText}>
            Fotos, vídeos, cursos e PDFs feitos por você podem virar renda. Veja como funciona:
          </Text>
        </>
      )}

      <View style={styles.steps}>
        <Step n={1} title="Envie o pedido" text="Leia e aceite os termos de criador. Leva um minuto." />
        <Step n={2} title="Nossa equipe analisa" text="Você recebe a resposta por notificação." />
        <Step n={3} title="Publique e receba" text="Cada venda rende 80% para você, com saque por Pix." />
      </View>

      <TouchableOpacity
        style={[styles.primaryBtnWrap, !!blockedReason && styles.disabled]}
        onPress={onOpenRequest}
        disabled={!!blockedReason}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!blockedReason }}
      >
        <LinearGradient colors={MP_GRADIENT.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>
            {isRejected ? 'Enviar novo pedido' : '🚀 Quero ser criador'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
      {!!blockedReason && <Text style={styles.disabledNote}>{blockedReason}</Text>}
    </View>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{n}</Text>
      </View>
      <View style={styles.stepBody}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepText}>{text}</Text>
      </View>
    </View>
  );
}

// ============================================
// Rodapé: os números do criador
// ============================================

function StatColumn({ label, bucket, highlight }: { label: string; bucket: CreatorStatsBucket; highlight?: boolean }) {
  return (
    <View style={[styles.statColumn, highlight && styles.statColumnHighlight]}>
      <Text style={[styles.statColumnLabel, highlight && styles.statColumnLabelHighlight]}>{label}</Text>

      <Text style={styles.statValue}>{bucket.sales}</Text>
      <Text style={styles.statLabel}>{bucket.sales === 1 ? 'venda' : 'vendas'}</Text>

      <Text style={[styles.statValue, styles.statMoney]}>{formatBRL(bucket.net)}</Text>
      <Text style={styles.statLabel}>faturamento</Text>

      {bucket.freeClaims > 0 && (
        <Text style={styles.statFree}>
          + {bucket.freeClaims} {bucket.freeClaims === 1 ? 'download grátis' : 'downloads grátis'}
        </Text>
      )}
    </View>
  );
}

// ============================================
// Gráfico dos últimos 6 meses (faturamento)
// ============================================

function MonthChart({ history }: { history: CreatorMonth[] }) {
  const max = Math.max(...history.map(m => m.bucket.net), 0);
  return (
    <View style={styles.chart}>
      <Text style={styles.chartTitle}>Faturamento dos últimos 6 meses</Text>
      <View style={styles.chartBars}>
        {history.map((m, index) => {
          const isCurrent = index === history.length - 1;
          const ratio = max > 0 ? m.bucket.net / max : 0;
          return (
            <View
              key={m.key}
              style={styles.chartColumn}
              accessible
              accessibilityLabel={`${monthNameOf(m.key)}: ${formatBRL(m.bucket.net)}, ${m.bucket.sales} vendas`}
            >
              <Text style={[styles.chartValue, isCurrent && styles.chartValueCurrent]} numberOfLines={1}>
                {m.bucket.net > 0 ? compactBRL(m.bucket.net) : '–'}
              </Text>
              <View style={styles.chartTrack}>
                {isCurrent ? (
                  <LinearGradient
                    colors={MP_GRADIENT.gold}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 0, y: 0 }}
                    style={[styles.chartBar, { height: barHeight(ratio) }]}
                  />
                ) : (
                  <View style={[styles.chartBar, styles.chartBarPast, { height: barHeight(ratio) }]} />
                )}
              </View>
              <Text style={[styles.chartLabel, isCurrent && styles.chartLabelCurrent]}>
                {monthNameOf(m.key).slice(0, 3)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ============================================
// 🎯 Meta do mês
// ============================================

function GoalCard({ stats }: { stats: CreatorStats }) {
  const monthName = currentMonthName();
  const earned    = stats.month.net;
  const goal      = stats.monthlyGoal;
  const progress  = goal > 0 ? Math.min(1, earned / goal) : 0;
  const reached   = earned >= goal;
  const previous  = stats.previousMonth.bucket.net;
  const prevName  = monthNameOf(stats.previousMonth.key);

  let comparison: { text: string; up: boolean } | null = null;
  if (previous > 0) {
    const pct = Math.round(((earned - previous) / previous) * 100);
    comparison = pct >= 0
      ? { text: `▲ ${pct}% em relação a ${prevName}`, up: true }
      : { text: `▼ ${Math.abs(pct)}% em relação a ${prevName} — ainda dá tempo`, up: false };
  } else if (earned > 0) {
    comparison = { text: `${prevName} não teve vendas: você já está à frente!`, up: true };
  }

  return (
    <LinearGradient
      colors={MP_GRADIENT.card}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.goalCard, reached && styles.goalCardReached]}
    >
      <View style={styles.goalHeader}>
        <Text style={styles.goalTitle}>🎯 Meta de {monthName}</Text>
        <Text style={styles.goalTarget}>{formatBRL(goal)}</Text>
      </View>

      <View
        style={styles.goalTrack}
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
        accessibilityLabel={`Meta do mês: ${Math.round(progress * 100)}%`}
      >
        <LinearGradient
          colors={reached ? MP_GRADIENT.gold : MP_GRADIENT.purple}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.goalFill, { width: `${Math.max(progress * 100, progress > 0 ? 4 : 0)}%` }]}
        />
      </View>

      <Text style={styles.goalStatus}>
        {reached
          ? '🎉 Meta batida! Você já igualou ou superou seu melhor mês recente.'
          : `${formatBRL(earned)} de ${formatBRL(goal)} · faltam ${formatBRL(Math.max(0, goal - earned))}`}
      </Text>

      {comparison && (
        <Text style={[styles.goalCompare, comparison.up ? styles.goalCompareUp : styles.goalCompareDown]}>
          {comparison.text}
        </Text>
      )}

      <Text style={styles.goalHint}>
        {goal === FIRST_GOAL && previous === 0
          ? `Meta inicial de ${formatBRL(FIRST_GOAL)}. Depois ela passa a ser o seu melhor mês dos últimos 3.`
          : 'A meta é o seu melhor faturamento dos últimos 3 meses. Bata e ela sobe junto com você.'}
      </Text>
    </LinearGradient>
  );
}

// ============================================
// 💡 Próximos passos
// ============================================

interface Suggestion {
  key: string;
  icon: string;
  title: string;
  text: string;
  tone: 'action' | 'win' | 'info';
  onPress: () => void;
}

interface SuggestionInputs {
  stats: CreatorStats;
  available: number;
  debt: number;
  sellBlocked: boolean;
  openProduct: (productId: string) => void;
  go: (route: StackRoute) => () => void;
}

/** Até 3 sugestões, da mais urgente para a mais motivadora. */
function buildSuggestions({ stats, available, debt, sellBlocked, openProduct, go }: SuggestionInputs): Suggestion[] {
  const list: Suggestion[] = [];
  const products = stats.products;
  const approved = products.filter(p => p.status === 'approved');
  const pending  = products.filter(p => p.status === 'pending');

  const rejected = products.find(p => p.status === 'rejected');
  if (rejected) {
    list.push({
      key: `rejected-${rejected.id}`, icon: '🛠️', tone: 'action',
      title: `“${rejected.title}” foi recusado`,
      text: 'Veja o motivo, ajuste o que foi pedido e envie de novo para revisão.',
      onPress: () => openProduct(rejected.id),
    });
  }

  if (available >= MIN_WITHDRAWAL && debt <= 0) {
    list.push({
      key: 'withdraw', icon: '💸', tone: 'win',
      title: `${formatBRL(available)} prontos para sacar`,
      text: 'O dinheiro já é seu. Peça o saque e receba por Pix.',
      onPress: go('Withdrawal'),
    });
  }

  if (approved.length === 0 && !sellBlocked) {
    list.push(pending.length > 0
      ? {
        key: 'pending', icon: '⏳', tone: 'info',
        title: `“${pending[0].title}” está em análise`,
        text: 'Assim que for aprovado, ele entra na vitrine. Enquanto isso, que tal preparar o próximo?',
        onPress: go('MyProducts'),
      }
      : {
        key: 'first', icon: '🚀', tone: 'action',
        title: 'Publique seu primeiro conteúdo',
        text: 'Capa, prévia e arquivo: em poucos minutos ele vai para revisão.',
        onPress: go('CreateProduct'),
      });
  }

  const stalled = approved
    .filter(p => p.views >= VIEWS_WITHOUT_ORDER && p.orders === 0)
    .sort((a, b) => b.views - a.views)[0];
  if (stalled) {
    list.push({
      key: `stalled-${stalled.id}`, icon: '👀', tone: 'action',
      title: `“${stalled.title}” teve ${stalled.views} visitas e nenhuma venda`,
      text: 'As pessoas estão olhando. Uma capa mais forte ou uma prévia nova pode virar a chave.',
      onPress: () => openProduct(stalled.id),
    });
  }

  if (approved.length > 0 && stats.month.sales === 0 && stats.month.freeClaims === 0 &&
      currentDayOfMonth() >= QUIET_MONTH_DAY && !sellBlocked) {
    list.push({
      key: 'quiet', icon: '✨', tone: 'action',
      title: `${currentMonthName()} ainda sem vendas`,
      text: 'Conteúdo novo dá mais motivos para visitarem seu perfil e sua vitrine.',
      onPress: go('CreateProduct'),
    });
  }

  const champion = approved
    .filter(p => p.orders > 0)
    .sort((a, b) => b.orders - a.orders || b.views - a.views)[0];
  if (champion) {
    const orders = `${champion.orders} ${champion.orders === 1 ? 'pedido' : 'pedidos'}`;
    list.push({
      key: `champion-${champion.id}`, icon: '🏆', tone: 'win',
      title: `“${champion.title}” é o seu campeão`,
      text: champion.views > 0
        ? `${orders} em ${champion.views} visitas. Um conteúdo no mesmo estilo tende a ir bem.`
        : `${orders}. Um conteúdo no mesmo estilo tende a ir bem.`,
      onPress: go('MyProducts'),
    });
  }

  return list.slice(0, 3);
}

function SuggestionList({ items }: { items: Suggestion[] }) {
  if (items.length === 0) {
    return (
      <View style={styles.suggestionEmpty}>
        <Text style={styles.suggestionEmptyText}>
          Tudo em dia por aqui. Novas dicas aparecem conforme seus conteúdos recebem visitas e vendas.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.suggestions}>
      {items.map(item => (
        <TouchableOpacity
          key={item.key}
          style={[
            styles.suggestion,
            item.tone === 'win' && styles.suggestionWin,
            item.tone === 'info' && styles.suggestionInfo,
          ]}
          onPress={item.onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          accessibilityHint={item.text}
        >
          <Text style={styles.suggestionIcon}>{item.icon}</Text>
          <View style={styles.suggestionBody}>
            <Text style={styles.suggestionTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.suggestionText}>{item.text}</Text>
          </View>
          <Text style={styles.suggestionArrow}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ============================================
// 📊 Rodapé de números
// ============================================

interface NumbersProps {
  stats: CreatorStats;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

function CreatorNumbers({ stats, loading, error, retry }: NumbersProps) {
  const monthName = useMemo(currentMonthName, []);
  const nothingYet = stats.total.sales === 0 && stats.total.freeClaims === 0;

  return (
    <View style={styles.numbersCard}>
      <Text style={styles.numbersTitle}>📊 Seus números</Text>
      <Text style={styles.numbersSubtitle}>
        Faturamento é o que fica para você, já sem a comissão do Lumina. Estornos saem do mês em que a
        venda aconteceu.
      </Text>

      {loading ? (
        <ActivityIndicator color={MP.gold} style={styles.numbersLoader} />
      ) : error ? (
        <TouchableOpacity style={styles.numbersError} onPress={retry} accessibilityRole="button">
          <Text style={styles.numbersErrorText}>⚠️ {error} Toque para tentar de novo.</Text>
        </TouchableOpacity>
      ) : (
        <>
          <View style={styles.statRow}>
            <StatColumn label={monthName} bucket={stats.month} highlight />
            <StatColumn label="Desde o início" bucket={stats.total} />
          </View>

          <MonthChart history={stats.history} />

          <View style={styles.ratingRow}>
            <Text style={styles.ratingStar}>⭐</Text>
            {stats.averageRating !== null ? (
              <Text style={styles.ratingText}>
                <Text style={styles.ratingValue}>{stats.averageRating.toFixed(1).replace('.', ',')}</Text>
                {'  '}avaliação média · {stats.reviewsCount}{' '}
                {stats.reviewsCount === 1 ? 'avaliação' : 'avaliações'}
              </Text>
            ) : (
              <Text style={styles.ratingText}>
                Sem avaliações ainda. Elas aparecem quando quem comprou avaliar seus conteúdos.
              </Text>
            )}
          </View>

          {nothingYet && (
            <Text style={styles.emptyNumbers}>
              Sua primeira venda aparece aqui na hora em que o pagamento for confirmado.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

// ============================================
// Tela
// ============================================

export default function CreatorPanelScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { role, isBlocked, loading: permLoading } = useUserPermissions(user?.uid);
  const { marketplaceEnabled: marketplaceOn, loading: settingsLoading } = useAppSettings();
  // Enquanto as configurações carregam, trata como ligado: evita
  // piscar o aviso de manutenção e travar botões por um instante.
  const marketplaceEnabled = settingsLoading || marketplaceOn;
  const badges = useProfileBadges(user?.uid);
  const { isDesktop } = useBreakpoint();

  // Mesma regra do canSell do perfil público: criador, admin e
  // superadmin vendem. Pelo papel gravado — o ban de marketplace
  // já devolve o papel para 'user' (previousRole) no servidor.
  const canSell = role === 'creator' || role === 'admin' || role === 'superadmin';

  // Por que criar/vender está travado agora (null = liberado).
  const sellBlockedReason = isBlocked
    ? 'Pausado enquanto sua conta estiver com restrição no marketplace.'
    : !marketplaceEnabled
      ? 'Pausado enquanto o marketplace estiver em manutenção.'
      : null;

  // `as never`: mesmo padrão do Painel Admin para rotas sem parâmetro.
  const go = (route: StackRoute) => () => navigation.navigate(route as never);
  const openProduct = (productId: string) => navigation.navigate('EditProduct', { productId });

  // Números do criador: UMA escuta, compartilhada por meta,
  // sugestões e rodapé. Quem não vende não escuta nada.
  const creatorStats = useCreatorStats(user?.uid, canSell);

  // Saldo, só para a sugestão "prontos para sacar".
  // Saldo: sugestão "prontos para sacar" e o valor no card Meus Ganhos.
  // `loaded` evita mostrar "R$ 0,00" antes da carteira chegar.
  const [wallet, setWallet] = useState<{ available: number; debt: number; loaded: boolean }>(
    { available: 0, debt: 0, loaded: false },
  );
  useEffect(() => {
    if (!user?.uid || !canSell) return undefined;
    return listenToCreatorWallet(user.uid, w => {
      setWallet({
        available: Math.max(0, Number(w?.availableBalance ?? 0) || 0),
        debt:      Math.max(0, Number(w?.debtBalance ?? 0) || 0),
        loaded:    true,
      });
    });
  }, [user?.uid, canSell]);

  const suggestions = canSell && !creatorStats.loading && !creatorStats.error
    ? buildSuggestions({
      stats: creatorStats.stats,
      available: wallet.available,
      debt: wallet.debt,
      sellBlocked: !!sellBlockedReason,
      openProduct,
      go,
    })
    : [];

  const goToTab = (screen: 'Home' | 'Marketplace') => {
    navigation.dispatch(CommonActions.navigate({ name: 'MainTabs', params: { screen } }));
  };

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else goToTab('Home');
  };

  return (
    <ScreenContainer>
      <LinearGradient colors={MP_GRADIENT.screen} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Text style={styles.headerBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meu Painel</Text>
        <TouchableOpacity
          onPress={() => goToTab('Home')}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Ir para o início"
        >
          <Text style={styles.headerHome}>🏠</Text>
        </TouchableOpacity>
      </View>

      {permLoading ? (
        <ActivityIndicator color={MP.gold} style={styles.screenLoader} />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.dContent]} showsVerticalScrollIndicator={false}>
          <View style={isDesktop ? styles.dRow : styles.mobileFlow}>
          <View style={isDesktop ? styles.dMain : styles.mobileFlow}>
          {/* Boas-vindas */}
          <LinearGradient
            colors={MP_GRADIENT.featured}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Text style={styles.heroKicker}>{canSell ? 'ÁREA DO CRIADOR' : 'MARKETPLACE'}</Text>
            <Text style={styles.heroTitle}>
              {canSell ? 'Seu espaço de criador' : 'Seu espaço no marketplace'}
            </Text>
            <Text style={styles.heroText}>
              {canSell
                ? 'Daqui você cria, acompanha e recebe pelos seus conteúdos. Escolha o próximo passo.'
                : 'Suas compras, seus favoritos e o caminho para vender os seus próprios conteúdos.'}
            </Text>
          </LinearGradient>

          {/* Faixa de novidades, como a do Painel Admin. Aqui são
              NOVIDADES (notificações não vistas de cada área), não
              pendências: somem ao abrir a área correspondente. */}
          {badges.panel > 0 && (
            <View style={styles.newsBanner} accessibilityRole="text">
              <Text style={styles.newsBannerText}>
                {badges.panel === 1
                  ? '✨ 1 novidade no seu painel — veja o card com o balão'
                  : `✨ ${badges.panel} novidades no seu painel — veja os cards com balão`}
              </Text>
            </View>
          )}

          {isBlocked && (
            <Banner
              tone="warn"
              icon="⚠️"
              text="Sua conta está com restrição no marketplace. Suas compras continuam disponíveis; criar e vender ficam pausados até o fim da restrição."
            />
          )}
          {!marketplaceEnabled && (
            <Banner
              tone="info"
              icon="🛠️"
              text="O marketplace está em manutenção. Suas compras continuam disponíveis normalmente."
            />
          )}

          {/* Área do criador */}
          {canSell ? (
            <>
              {!creatorStats.loading && !creatorStats.error && (
                <>
                  <GoalCard stats={creatorStats.stats} />

                  <SectionHeader
                    title="💡 Próximos passos"
                    subtitle="Sugestões a partir das suas visitas, vendas e saldo."
                  />
                  <SuggestionList items={suggestions} />
                </>
              )}

              <SectionHeader
                title="Área do criador"
                subtitle="Tudo o que você precisa para publicar e receber."
              />

              <TouchableOpacity
                style={[styles.createWrap, !!sellBlockedReason && styles.disabled]}
                onPress={go('CreateProduct')}
                disabled={!!sellBlockedReason}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityState={{ disabled: !!sellBlockedReason }}
                accessibilityLabel="Criar novo produto"
              >
                <LinearGradient colors={MP_GRADIENT.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.createCard}>
                  <Text style={styles.createIcon}>＋</Text>
                  <View style={styles.createBody}>
                    <Text style={styles.createTitle}>Criar novo produto</Text>
                    <Text style={styles.createText}>
                      {sellBlockedReason ?? 'Envie capa, prévia e arquivos. Nossa equipe revisa antes de entrar na vitrine.'}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <View style={[styles.grid, isDesktop && styles.dGrid]}>
                <OptionCard
                  icon="📁"
                  title="Meus Produtos"
                  description="Status da revisão, edição e retirada de cada conteúdo."
                  count={badges.products}
                  onPress={go('MyProducts')}
                />
                <OptionCard
                  icon="💰"
                  title="Meus Ganhos"
                  value={wallet.loaded ? formatBRL(wallet.available) : undefined}
                  valueNote={wallet.loaded && wallet.debt > 0 ? `Pendência de ${formatBRL(wallet.debt)}` : undefined}
                  description={wallet.loaded ? 'disponível para saque · extrato de vendas e estornos.' : 'Saldo disponível, extrato de vendas e estornos.'}
                  count={badges.earnings}
                  onPress={go('MyEarnings')}
                />
                <OptionCard
                  icon="💸"
                  title="Sacar via Pix"
                  description="Transfira o saldo disponível para a sua conta."
                  onPress={go('Withdrawal')}
                />
                <OptionCard
                  icon="💳"
                  title="Recebimento"
                  description="Cadastre ou confira a chave Pix que recebe os saques."
                  onPress={go('PaymentSetup')}
                />
              </View>
            </>
          ) : (
            <>
              <SectionHeader
                title="Seja criador"
                subtitle="Transforme o que você produz em renda."
              />
              <CreatorJourney
                uid={user?.uid}
                blockedReason={sellBlockedReason}
                unseen={badges.creator}
                onOpenRequest={go('CreatorRequest')}
              />
            </>
          )}

          {/* Compras — para todos */}
          <SectionHeader
            title="Suas compras"
            subtitle="O que você comprou ou salvou no marketplace."
          />
          <View style={[styles.grid, isDesktop && styles.dGrid]}>
            <OptionCard
              icon="📦"
              title="Minhas Compras"
              description="Abra seus conteúdos, avalie e peça reembolso em até 7 dias."
              count={badges.purchases}
              onPress={go('MyPurchases')}
            />
            <OptionCard
              icon="❤️"
              title="Favoritos"
              description="Os conteúdos que você salvou para decidir depois."
              onPress={go('MyFavorites')}
            />
            {marketplaceEnabled && !isBlocked && (
              <OptionCard
                icon="🛍️"
                title="Explorar"
                description="Descubra conteúdos novos dos criadores na vitrine."
                onPress={() => goToTab('Marketplace')}
              />
            )}
          </View>

          </View>

          {/* Rodapé — números do criador (no computador: coluna à direita) */}
          {canSell && (
            <View style={isDesktop ? styles.dAside : styles.mobileFlow}>
              <CreatorNumbers
                stats={creatorStats.stats}
                loading={creatorStats.loading}
                error={creatorStats.error}
                retry={creatorStats.retry}
              />
            </View>
          )}
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 0.5, borderBottomColor: MP.borderGold,
  },
  headerBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { color: MP.gold, fontSize: 28 },
  headerHome: { fontSize: 20 },
  headerTitle: { color: MP.text, fontSize: MP_FONT.size.lg, fontWeight: MP_FONT.weight.bold },
  screenLoader: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  disabled: { opacity: 0.5 },

  hero: {
    borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: MP.borderStrong,
    ...MP_SHADOW.purpleGlow,
  },
  heroKicker: {
    color: MP.goldLight, fontSize: MP_FONT.size.xs, fontWeight: MP_FONT.weight.heavy,
    letterSpacing: MP_FONT.tracking.wider,
  },
  heroTitle: {
    color: MP.text, fontSize: MP_FONT.size.xxl, fontWeight: MP_FONT.weight.heavy,
    marginTop: spacing.xs,
  },
  heroText: { color: MP.textSoft, fontSize: MP_FONT.size.md, marginTop: spacing.xs, lineHeight: 20 },

  newsBanner: {
    backgroundColor: MP.goldSubtle, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: MP.borderGold, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  newsBannerText: { color: MP.goldLight, fontSize: MP_FONT.size.sm, fontWeight: MP_FONT.weight.bold, textAlign: 'center' },

  banner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    borderRadius: borderRadius.md, borderWidth: 1, padding: spacing.md,
  },
  bannerWarn: { backgroundColor: 'rgba(255, 77, 109, 0.10)', borderColor: 'rgba(255, 77, 109, 0.45)' },
  bannerInfo: { backgroundColor: MP.purpleSubtle, borderColor: MP.border },
  bannerIcon: { fontSize: 18 },
  bannerText: { flex: 1, color: MP.textSoft, fontSize: MP_FONT.size.sm, lineHeight: 18 },

  sectionHeader: { marginTop: spacing.sm },
  sectionTitle: {
    color: MP.text, fontSize: MP_FONT.size.lg, fontWeight: MP_FONT.weight.bold,
  },
  sectionSubtitle: { color: MP.textMuted, fontSize: MP_FONT.size.sm, marginTop: 2 },

  createWrap: { borderRadius: borderRadius.lg, ...MP_SHADOW.goldGlow },
  createCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: borderRadius.lg, padding: spacing.md,
  },
  createIcon: {
    color: MP.textOnGold, fontSize: 30, fontWeight: MP_FONT.weight.heavy,
    width: 44, textAlign: 'center',
  },
  createBody: { flex: 1 },
  createTitle: { color: MP.textOnGold, fontSize: MP_FONT.size.lg, fontWeight: MP_FONT.weight.heavy },
  createText: { color: MP.textOnGold, fontSize: MP_FONT.size.sm, marginTop: 2, opacity: 0.85 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  // ── Computador (14/10/2026) ──
  // gap em vez de space-between: com 3 cartões na linha, o
  // space-between deixava um buraco no meio.
  optionCardDesktop: { width: 'auto', flexGrow: 1, flexBasis: 210, maxWidth: '49%', marginRight: 0 },
  dGrid:      { justifyContent: 'flex-start', columnGap: 12, rowGap: 12 },
  dContent:   { width: '100%', maxWidth: 1200, alignSelf: 'center', padding: 28 },
  dRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  dMain:      { flex: 1, minWidth: 0, gap: spacing.md },
  dAside:     { width: 380 },
  mobileFlow: { gap: spacing.md },
  optionCard: {
    width: '48.5%', backgroundColor: MP.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: MP.border, padding: spacing.md, minHeight: 140,
    ...MP_SHADOW.card,
  },
  optionCardAlert: { borderColor: MP.borderGold },
  optionCardDisabled: { opacity: 0.5 },
  optionIconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: MP.purpleSubtle,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  optionIcon: { fontSize: 20 },
  optionTitle: { color: MP.text, fontSize: MP_FONT.size.md, fontWeight: MP_FONT.weight.bold },
  optionValue: {
    color: MP.gold, fontSize: MP_FONT.size.xl, fontWeight: MP_FONT.weight.heavy, marginTop: spacing.xs,
  },
  optionValueNote: { color: MP.error, fontSize: MP_FONT.size.xs, fontWeight: MP_FONT.weight.bold, marginTop: 2 },
  optionDescription: { color: MP.textMuted, fontSize: MP_FONT.size.xs, marginTop: spacing.xs, lineHeight: 15 },

  badge: {
    position: 'absolute', top: spacing.sm, right: spacing.sm,
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: MP.error, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: MP_FONT.weight.bold },

  journeyCard: {
    backgroundColor: MP.surface, borderRadius: borderRadius.lg, borderWidth: 1,
    borderColor: MP.border, padding: spacing.lg, alignItems: 'center', ...MP_SHADOW.card,
  },
  journeyCardAlert: { borderColor: MP.borderGold },
  journeyIcon: { fontSize: 40, marginBottom: spacing.sm },
  journeyTitle: {
    color: MP.text, fontSize: MP_FONT.size.lg, fontWeight: MP_FONT.weight.bold, textAlign: 'center',
  },
  journeyReason: {
    color: MP.goldLight, fontSize: MP_FONT.size.sm, textAlign: 'center', marginTop: spacing.sm,
  },
  journeyText: {
    color: MP.textSoft, fontSize: MP_FONT.size.sm, textAlign: 'center', marginTop: spacing.sm, lineHeight: 19,
  },
  steps: { alignSelf: 'stretch', marginTop: spacing.md, gap: spacing.sm },
  step: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stepNumber: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: MP.goldSubtle,
    borderWidth: 1, borderColor: MP.borderGold, alignItems: 'center', justifyContent: 'center',
  },
  stepNumberText: { color: MP.gold, fontSize: MP_FONT.size.sm, fontWeight: MP_FONT.weight.heavy },
  stepBody: { flex: 1 },
  stepTitle: { color: MP.text, fontSize: MP_FONT.size.md, fontWeight: MP_FONT.weight.semibold },
  stepText: { color: MP.textMuted, fontSize: MP_FONT.size.sm, marginTop: 1 },

  primaryBtnWrap: { alignSelf: 'stretch', marginTop: spacing.lg, borderRadius: borderRadius.full },
  primaryBtn: {
    borderRadius: borderRadius.full, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    minHeight: 48,
  },
  primaryBtnText: { color: MP.textOnGold, fontSize: MP_FONT.size.md, fontWeight: MP_FONT.weight.heavy },
  secondaryBtn: {
    alignSelf: 'stretch', marginTop: spacing.md, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: MP.borderGold, paddingVertical: 12, alignItems: 'center', minHeight: 44,
  },
  secondaryBtnText: { color: MP.gold, fontSize: MP_FONT.size.md, fontWeight: MP_FONT.weight.bold },
  disabledNote: { color: MP.textMuted, fontSize: MP_FONT.size.xs, marginTop: spacing.sm, textAlign: 'center' },

  numbersCard: {
    marginTop: spacing.md, backgroundColor: MP.bgElevated, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: MP.borderGold, padding: spacing.md,
  },
  numbersTitle: { color: MP.text, fontSize: MP_FONT.size.lg, fontWeight: MP_FONT.weight.bold },
  numbersSubtitle: { color: MP.textMuted, fontSize: MP_FONT.size.xs, marginTop: 2, lineHeight: 15 },
  numbersLoader: { marginVertical: spacing.lg },
  numbersError: {
    marginTop: spacing.md, padding: spacing.sm, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: 'rgba(255, 77, 109, 0.45)',
  },
  numbersErrorText: { color: MP.error, fontSize: MP_FONT.size.xs, textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statColumn: {
    flex: 1, backgroundColor: MP.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: MP.border, padding: spacing.md, alignItems: 'center',
  },
  statColumnHighlight: { borderColor: MP.borderGold, backgroundColor: MP.surfaceRaised },
  statColumnLabel: {
    color: MP.textMuted, fontSize: MP_FONT.size.xs, fontWeight: MP_FONT.weight.bold,
    letterSpacing: MP_FONT.tracking.wide, textTransform: 'uppercase', marginBottom: spacing.sm,
  },
  statColumnLabelHighlight: { color: MP.goldLight },
  statValue: { color: MP.text, fontSize: MP_FONT.size.xxl, fontWeight: MP_FONT.weight.heavy },
  statMoney: { color: MP.gold, fontSize: MP_FONT.size.xl, marginTop: spacing.sm },
  statLabel: { color: MP.textMuted, fontSize: MP_FONT.size.xs },
  statFree: { color: MP.free, fontSize: MP_FONT.size.xs, marginTop: spacing.sm, textAlign: 'center' },
  ratingRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md,
    backgroundColor: MP.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: MP.border,
    padding: spacing.md,
  },
  ratingStar: { fontSize: 22 },
  ratingText: { flex: 1, color: MP.textSoft, fontSize: MP_FONT.size.sm, lineHeight: 18 },
  ratingValue: { color: MP.gold, fontSize: MP_FONT.size.xl, fontWeight: MP_FONT.weight.heavy },
  chart: { marginTop: spacing.md },
  chartTitle: {
    color: MP.textMuted, fontSize: MP_FONT.size.xs, fontWeight: MP_FONT.weight.bold,
    letterSpacing: MP_FONT.tracking.wide, textTransform: 'uppercase', marginBottom: spacing.sm,
  },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  chartColumn: { flex: 1, alignItems: 'center' },
  chartValue: { color: MP.textMuted, fontSize: 9, marginBottom: 4 },
  chartValueCurrent: { color: MP.goldLight, fontWeight: MP_FONT.weight.bold },
  chartTrack: {
    width: '100%', height: 90, justifyContent: 'flex-end',
    backgroundColor: MP.purpleSubtle, borderRadius: borderRadius.sm, overflow: 'hidden',
  },
  chartBar: { width: '100%', borderRadius: borderRadius.sm },
  chartBarPast: { backgroundColor: MP.purple },
  chartLabel: { color: MP.textMuted, fontSize: MP_FONT.size.xs, marginTop: 4 },
  chartLabelCurrent: { color: MP.gold, fontWeight: MP_FONT.weight.bold },

  goalCard: {
    borderRadius: borderRadius.lg, borderWidth: 1, borderColor: MP.borderStrong,
    padding: spacing.md, ...MP_SHADOW.card,
  },
  goalCardReached: { borderColor: MP.borderGold, ...MP_SHADOW.goldGlow },
  goalHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  goalTitle: { color: MP.text, fontSize: MP_FONT.size.lg, fontWeight: MP_FONT.weight.bold },
  goalTarget: { color: MP.gold, fontSize: MP_FONT.size.lg, fontWeight: MP_FONT.weight.heavy },
  goalTrack: {
    height: 12, borderRadius: 6, backgroundColor: MP.bg, marginTop: spacing.md,
    overflow: 'hidden', borderWidth: 1, borderColor: MP.border,
  },
  goalFill: { height: '100%', borderRadius: 6 },
  goalStatus: {
    color: MP.textSoft, fontSize: MP_FONT.size.sm, marginTop: spacing.sm, fontWeight: MP_FONT.weight.semibold,
  },
  goalCompare: { fontSize: MP_FONT.size.sm, marginTop: spacing.xs, fontWeight: MP_FONT.weight.bold },
  goalCompareUp: { color: MP.success },
  goalCompareDown: { color: MP.purpleLight },
  goalHint: { color: MP.textMuted, fontSize: MP_FONT.size.xs, marginTop: spacing.sm, lineHeight: 15 },

  suggestions: { gap: spacing.sm },
  suggestion: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: MP.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: MP.borderStrong, padding: spacing.md, minHeight: 64,
  },
  suggestionWin: { borderColor: MP.borderGold, backgroundColor: MP.surfaceRaised },
  suggestionInfo: { borderColor: MP.border },
  suggestionIcon: { fontSize: 24, width: 32, textAlign: 'center' },
  suggestionBody: { flex: 1 },
  suggestionTitle: { color: MP.text, fontSize: MP_FONT.size.md, fontWeight: MP_FONT.weight.bold },
  suggestionText: { color: MP.textMuted, fontSize: MP_FONT.size.xs, marginTop: 2, lineHeight: 15 },
  suggestionArrow: { color: MP.gold, fontSize: 24 },
  suggestionEmpty: {
    backgroundColor: MP.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: MP.border, padding: spacing.md,
  },
  suggestionEmptyText: { color: MP.textMuted, fontSize: MP_FONT.size.sm, textAlign: 'center', lineHeight: 18 },

  emptyNumbers: { color: MP.textMuted, fontSize: MP_FONT.size.xs, marginTop: spacing.md, textAlign: 'center' },
});

