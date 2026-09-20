import React, { useEffect, useState, useRef } from 'react';
import { Alert, Text, View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Notifications from 'expo-notifications';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { COLLECTIONS } from '../core/constants';
// PushInitializer removido: ele só chamava usePushNotifications(),
// que o AppContent já chama no topo. As duas instâncias
// registravam listeners próprios do expo-notifications e cada
// notificação chegava duplicada.
import { AuthProvider, useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';
import { CoinsProvider } from '../context/CoinsContext';
import SplashScreen from '../screens/Onboarding/SplashScreen';
import AppLoadingScreen from '../screens/Onboarding/LoadingScreen';
import { LoginScreen, RegisterScreen } from '../modules/auth';
import { ProfileSetupScreen } from '../modules/profile';
import { HomeScreen } from '../modules/home';
import { ChatScreen } from '../modules/chat';
import SintoniasScreen from '../screens/Chat/SintoniasScreen';
import { StoreScreen } from '../modules/economy';
import { colors } from '../theme';
import { NotificationsScreen } from '../modules/notifications';
import EngagementInitializer from '../components/EngagementInitializer';
import UpdateChecker from '../components/UpdateChecker';
import { RootStackParamList, TabParamList } from './types';
import { resolveAccessGate } from './accessGate';
import { APP_TERMS_VERSION } from '../config/terms';
import TermsAcceptScreen from '../screens/Onboarding/TermsAcceptScreen';
import AgeVerificationScreen from '../screens/Onboarding/AgeVerificationScreen';
import VerificationPendingScreen from '../screens/Onboarding/VerificationPendingScreen';
import AccountBannedScreen from '../screens/Onboarding/AccountBannedScreen';
import GateErrorScreen from '../screens/Onboarding/GateErrorScreen';

import MediaScreen from '../modules/media/screens/MediaScreen';
import ProfileScreen from '../modules/profile/screens/ProfileScreen';
import RealProfileScreen from '../screens/Profile/RealProfileScreen';
import UserChatScreen from '../modules/chat/screens/UserChatScreen';
import RequestsScreen from '../modules/profile/screens/RequestsScreen';
import BlockedScreen from '../screens/Profile/BlockedScreen';
import { listenToRequests, getConexoesAceitas } from '../modules/profile/services/requestsService';
import { listenToNotifications } from '../modules/notifications/services/notificationService';
import { generateChatId } from '../modules/chat/services/messageService';
import InAppNotification from '../components/InAppNotification';
import { usePushNotifications } from '../modules/notifications/hooks/usePushNotifications';
import PaymentSetupScreen from '../screens/marketplace/PaymentSetupScreen';
import MarketplaceHomeScreen from '../screens/marketplace/MarketplaceHomeScreen';
import ProductDetailScreen from '../screens/marketplace/ProductDetailScreen';
import MyPurchasesScreen from '../screens/marketplace/MyPurchasesScreen';
import ContentViewerScreen from '../screens/marketplace/ContentViewerScreen';
import MyProductsScreen from '../screens/marketplace/MyProductsScreen';
import CreateProductScreen from '../screens/marketplace/CreateProductScreen';
import EditProductScreen from '../screens/marketplace/EditProductScreen';
import MyFavoritesScreen from '../screens/marketplace/MyFavoritesScreen';
import MyEarningsScreen from '../screens/marketplace/MyEarningsScreen';
import WithdrawalScreen from '../screens/marketplace/WithdrawalScreen';
import CreatorRequestScreen from '../screens/marketplace/CreatorRequestScreen';
import CheckoutScreen from '../screens/marketplace/CheckoutScreen';
import { useAppSettings } from '../hooks/useAppSettings';
import { useUserPermissions } from '../hooks/useUserPermissions';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminCreatorRequestsScreen from '../screens/admin/AdminCreatorRequestsScreen';
import AdminWithdrawalsScreen from '../screens/admin/AdminWithdrawalsScreen';
import AdminUserSearchScreen from '../screens/admin/AdminUserSearchScreen';
import AdminBlockedUsersScreen from '../screens/admin/AdminBlockedUsersScreen';
import AdminAgeVerificationScreen from '../screens/admin/AdminAgeVerificationScreen';
import AdminUserDetailScreen from '../screens/admin/AdminUserDetailScreen';
import AdminLoadingScreen from '../screens/admin/AdminLoadingScreen';
import DestinyCardScreen from '../modules/engagement/screens/DestinyCardScreen';
import FaiscaScreen from '../modules/engagement/screens/FaiscaScreen';
import MissionsScreen from '../modules/engagement/screens/MissionsScreen';
import FragmentsScreen from '../modules/engagement/screens/FragmentsScreen';
import VaultScreen from '../modules/engagement/screens/VaultScreen';
import XPScreen from '../modules/engagement/screens/XPScreen';
import AchievementsScreen from '../modules/engagement/screens/AchievementsScreen';
import BadgesScreen from '../modules/engagement/screens/BadgesScreen';
import BadgesShopScreen from '../modules/economy/screens/BadgesShopScreen';
import FramesShopScreen from '../modules/economy/screens/FramesShopScreen';
import CrystalPacksScreen from '../modules/economy/screens/CrystalPacksScreen';
import BoostsScreen from '../modules/economy/screens/BoostsScreen';
import RankingScreen from '../modules/engagement/screens/RankingScreen';
import PrestigeScreen from '../modules/engagement/screens/PrestigeScreen';
import PremiumToolsScreen from '../modules/premium/screens/PremiumToolsScreen';
import AdminInflationScreen from '../screens/admin/AdminInflationScreen';
import AdminCurationScreen from '../screens/admin/AdminCurationScreen';
import VisitorsScreen from '../modules/premium/screens/VisitorsScreen';
import {
  AdminProductsModerationScreen,
  AdminProductReviewScreen,
  AdminSalesScreen,
  AdminRefundRequestsScreen,
  AdminFraudFlagsScreen,
  AdminCouponsScreen,
  AdminReportsScreen,
} from '../screens/admin/AdminPlaceholderScreens';
import FramesScreen from '../modules/engagement/screens/FramesScreen';


const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<TabParamList>();

const navigationRef = React.createRef<NavigationContainerRef<RootStackParamList>>();

const NavigationPermissionsContext = React.createContext({
  isBlocked:          false,
  isSuperAdmin:       false,
  marketplaceEnabled: false,
});

const hideTabButton = () => null;

// ============================================
// TAB NAVIGATOR
// ============================================
function TabNavigator() {
  const { user }  = useAuth();
  const insets    = useSafeAreaInsets();
  const [unreadMessages,  setUnreadMessages]  = useState(0);
  const [unreadNotifs,    setUnreadNotifs]    = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const unsubscribersRef = useRef<(() => void)[]>([]);

  const { isBlocked, isSuperAdmin, marketplaceEnabled } = React.useContext(NavigationPermissionsContext);
  const canAccessAdminPanel = isSuperAdmin;

  useEffect(() => {
    if (!user?.uid) return;

    const unsubRequests = listenToRequests(user.uid, requests => {
      setPendingRequests(requests.length);
    });

    const unsubNotifs = listenToNotifications(user.uid, notifs => {
      setUnreadNotifs(notifs.filter(n => !n.read).length);
    });

    unsubscribersRef.current.forEach(unsub => unsub());
    unsubscribersRef.current = [];

    const counts: Record<string, number> = {};

    getConexoesAceitas(user.uid).then(conexoes => {
      conexoes.forEach(conexao => {
        const otherUserId = conexao.fromUserId === user.uid
          ? conexao.toUserId
          : conexao.fromUserId;

        const chatId      = generateChatId(user.uid, otherUserId);
        const messagesRef = collection(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES);
        const unreadQ     = query(
          messagesRef,
          where('read', '==', false),
          where('senderId', '==', otherUserId)
        );

        const unsub = onSnapshot(unreadQ, snap => {
          counts[otherUserId] = snap.size;
          const total = Object.values(counts).reduce((a, b) => a + b, 0);
          setUnreadMessages(total);
        });

        unsubscribersRef.current.push(unsub);
      });
    }).catch(console.error);

    return () => {
      unsubRequests();
      unsubNotifs();
      unsubscribersRef.current.forEach(unsub => unsub());
      unsubscribersRef.current = [];
    };
  }, [user?.uid]);

  const totalProfileBadge = pendingRequests;
  const showMarketplace   = marketplaceEnabled && !isBlocked;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor:  colors.gold,
          borderTopWidth:  0.5,
          height:          60 + insets.bottom,
          paddingBottom:   insets.bottom > 0 ? insets.bottom : 8,
          paddingTop:      4,
        },
        tabBarActiveTintColor:   colors.gold,
        tabBarInactiveTintColor: colors.gray,
        tabBarLabelStyle: {
          fontSize:     10,
          fontWeight:   'bold',
          letterSpacing: 0.5,
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen}
        options={{
          tabBarLabel: 'Descobrir',
          tabBarIcon: ({ color }) => (
            <View>
              <Text style={{ fontSize: 20, color }}>✦</Text>
              {unreadNotifs > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />

      <Tab.Screen name="Media" component={MediaScreen}
        options={{
          tabBarLabel: 'Mídia',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📸</Text>,
        }}
      />

      <Tab.Screen name="Sintonias" component={SintoniasScreen}
        options={{
          tabBarLabel: 'Sintonias',
          tabBarIcon: ({ color }) => (
            <View>
              <Text style={{ fontSize: 20, color }}>✨</Text>
              {unreadMessages > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />

      {/* ✅ FASE 1 — Cristais de Sintonia substituindo Moedas */}
      <Tab.Screen name="Store" component={StoreScreen}
        options={{
          tabBarLabel: 'Cristais',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>✨</Text>,
        }}
      />

      <Tab.Screen name="Marketplace" component={MarketplaceHomeScreen}
        options={{
          tabBarLabel:   'Marketplace',
          tabBarIcon:    ({ color }) => <Text style={{ fontSize: 20, color }}>🛍️</Text>,
          tabBarButton:  showMarketplace ? undefined : hideTabButton,
          tabBarItemStyle: showMarketplace ? {} : { width: 0, height: 0 },
        }}
      />

      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color }) => (
            <View>
              <Text style={{ fontSize: 20, color }}>👤</Text>
              {totalProfileBadge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{totalProfileBadge > 9 ? '9+' : totalProfileBadge}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />

      {canAccessAdminPanel && (
        <Tab.Screen name="Admin" component={AdminDashboardScreen}
          options={{
            tabBarLabel: 'Admin',
            tabBarIcon:  ({ color }) => <Text style={{ fontSize: 20, color }}>👑</Text>,
          }}
        />
      )}
    </Tab.Navigator>
  );
}

// ============================================
// STACKS
// ============================================
function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs"              component={TabNavigator} />
      <Stack.Screen name="RealProfile"           component={RealProfileScreen} />
      <Stack.Screen name="UserChat"              component={UserChatScreen} />
      <Stack.Screen name="ProfileSetup"          component={ProfileSetupScreen} initialParams={{ editMode: true }} />
      <Stack.Screen name="Notifications"         component={NotificationsScreen} />
      <Stack.Screen name="Requests"              component={RequestsScreen} />
      <Stack.Screen name="Blocked"               component={BlockedScreen} />
      <Stack.Screen name="PaymentSetup"          component={PaymentSetupScreen} />
      <Stack.Screen name="MarketplaceHome"       component={MarketplaceHomeScreen} />
      <Stack.Screen name="ProductDetail"         component={ProductDetailScreen} />
      <Stack.Screen name="MyPurchases"           component={MyPurchasesScreen} />
      <Stack.Screen name="ContentViewer"         component={ContentViewerScreen} />
      <Stack.Screen name="MyProducts"            component={MyProductsScreen} />
      <Stack.Screen name="CreateProduct"         component={CreateProductScreen} />
      <Stack.Screen name="EditProduct"           component={EditProductScreen} />
      <Stack.Screen name="MyFavorites"           component={MyFavoritesScreen} />
      <Stack.Screen name="MyEarnings"            component={MyEarningsScreen} />
      <Stack.Screen name="Withdrawal"            component={WithdrawalScreen} />
      <Stack.Screen name="CreatorRequest"        component={CreatorRequestScreen} />
      <Stack.Screen name="Checkout"              component={CheckoutScreen} />
      <Stack.Screen name="AdminPanel"            component={AdminDashboardScreen} />
      <Stack.Screen name="AdminDashboard"        component={AdminDashboardScreen} />
      <Stack.Screen name="AdminCreatorRequests"  component={AdminCreatorRequestsScreen} />
      <Stack.Screen name="AdminProductsModeration" component={AdminProductsModerationScreen} />
      {/* Rota estava tipada no RootStackParamList e usada em dois
          pontos (card da moderação e push de review), mas nunca foi
          registrada aqui — o React Navigation avisava no console e
          o toque não fazia nada. */}
      <Stack.Screen name="AdminProductReview"    component={AdminProductReviewScreen} />
      <Stack.Screen name="AdminSales"            component={AdminSalesScreen} />
      <Stack.Screen name="AdminRefundRequests"   component={AdminRefundRequestsScreen} />
      <Stack.Screen name="AdminWithdrawals"      component={AdminWithdrawalsScreen} />
      <Stack.Screen name="AdminFraudFlags"       component={AdminFraudFlagsScreen} />
      <Stack.Screen name="AdminBlockedUsers"     component={AdminBlockedUsersScreen} />
      <Stack.Screen name="AdminAgeVerification"  component={AdminAgeVerificationScreen} />
      <Stack.Screen name="AdminUserSearch"       component={AdminUserSearchScreen} />
      <Stack.Screen name="AdminUserDetail"       component={AdminUserDetailScreen} />
      <Stack.Screen name="AdminCoupons"          component={AdminCouponsScreen} />
      <Stack.Screen name="AdminReports"          component={AdminReportsScreen} />
      <Stack.Screen name="AdminInflation"        component={AdminInflationScreen} />
      <Stack.Screen name="AdminCuration"         component={AdminCurationScreen} />
      <Stack.Screen name="Faisca" component={FaiscaScreen} />
      <Stack.Screen name="DestinyCard" component={DestinyCardScreen} />
      <Stack.Screen name="Missions" component={MissionsScreen} />
      <Stack.Screen name="Fragments" component={FragmentsScreen} />
      <Stack.Screen name="Vault" component={VaultScreen} />
      <Stack.Screen name="XP" component={XPScreen} />
      <Stack.Screen name="Achievements" component={AchievementsScreen} />
      <Stack.Screen name="Ranking" component={RankingScreen} />
      <Stack.Screen name="Prestige" component={PrestigeScreen} />
      <Stack.Screen name="PremiumTools" component={PremiumToolsScreen} />
      <Stack.Screen name="Visitors" component={VisitorsScreen} />
      <Stack.Screen name="Frames" component={FramesScreen} />
      <Stack.Screen name="Badges" component={BadgesScreen} />
      <Stack.Screen name="FramesShop" component={FramesShopScreen} />
      <Stack.Screen name="BadgesShop" component={BadgesShopScreen} />
      <Stack.Screen name="CrystalPacks" component={CrystalPacksScreen} />
      <Stack.Screen name="Boosts" component={BoostsScreen} />
    </Stack.Navigator>
  );
}

// ============================================
// APP CONTENT
// ============================================
interface InAppNotifState {
  title:    string;
  message:  string;
  type:     string;
  onPress?: () => void;
}

let _adminBootDone = false;

function AppContent() {
  const { user, loading: authLoading, hasProfile } = useAuth();
  const {
    isSuperAdmin, isBlocked, loading: permLoading,
    accessGate, loadError, retry,
  } = useUserPermissions(user?.uid);
  const { marketplaceEnabled }  = useAppSettings();
  const canAccessAdminPanel     = isSuperAdmin;
  const [adminBootReady, setAdminBootReady] = useState(_adminBootDone);
  const [inAppNotif, setInAppNotif]         = useState<InAppNotifState | null>(null);
  // Sai de 'pending' para 'verification' quando a pessoa toca
  // em "Enviar novas fotos" na tela de rejeitado.
  const [forceCapture, setForceCapture]     = useState(false);

  usePushNotifications();

  // Renova o token de Auth quando a conta é aprovada. As custom
  // claims da PARTE 9 vivem no token, e sem o refresh as
  // primeiras leituras depois da aprovação dariam
  // permission-denied. Hoje é inofensivo e prepara o terreno.
  const wasVerifiedRef = useRef(false);
  useEffect(() => {
    if (!accessGate.ageVerified) return;
    if (wasVerifiedRef.current) return;
    wasVerifiedRef.current = true;

    auth.currentUser?.getIdToken(true).catch(error => {
      console.warn('[AppContent] Refresh do token falhou:', error);
    });
  }, [accessGate.ageVerified]);

  function handleNotificationNavigation(data: Record<string, any>) {
    if (!navigationRef.current) return;
    const type = data?.type as string;
    switch (type) {
      case 'message':
        if (data.senderId && data.senderName && data.senderPhoto) {
          navigationRef.current.navigate('UserChat', {
            userId: data.senderId, userName: data.senderName, userPhoto: data.senderPhoto,
          });
        }
        break;
      case 'request':          navigationRef.current.navigate('Requests');     break;
      // Sintonia fechada pela outra pessoa. O modal aparece pelo
      // EngagementInitializer ao abrir o app; aqui o toque no
      // push leva direto ao perfil de quem sintonizou.
      case 'sintonia_criada':
        if (data.sintoniaWith) {
          navigationRef.current.navigate('RealProfile', { userId: data.sintoniaWith });
        }
        break;
      case 'sale_completed':
      case 'withdrawal_paid':
      case 'withdrawal_rejected': navigationRef.current.navigate('MyEarnings'); break;
      case 'purchase_confirmed':
      case 'refund_processed':    navigationRef.current.navigate('MyPurchases'); break;
      case 'creator_approved':
      case 'product_approved':    navigationRef.current.navigate('MyProducts');  break;
      // A aprovação troca a árvore sozinha pelo onSnapshot do
      // useUserPermissions — o push só traz a pessoa de volta
      // ao app, não precisa navegar para nada.
      case 'age_verification_approved':
      case 'age_verification_rejected':
        break;
      // Push para o admin quando alguém envia documento.
      case 'age_verification_pending':
        navigationRef.current.navigate('AdminAgeVerification');
        break;
      // Push de moderação enviado pelo notifySuperAdmins quando um
      // criador submete produto. Sem este case o admin tocava na
      // notificação e nada acontecia — o switch caía no default.
      case 'product_review_new':
        if (data.productId) {
          navigationRef.current.navigate('AdminProductReview', { productId: data.productId });
        } else {
          navigationRef.current.navigate('AdminProductsModeration');
        }
        break;
      case 'screenshot_warning':
        Alert.alert('⚠️ Aviso', data?.message ?? 'Ação proibida detectada em conteúdo protegido.');
        break;
      case 'screenshot_warning_ban':
        Alert.alert('🚫 Conta suspensa', data?.message ?? 'Sua conta foi suspensa por violação de política.');
        break;
    }
  }

  useEffect(() => {
    const tapSub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, any>;
      handleNotificationNavigation(data);
    });

    const receiveSub = Notifications.addNotificationReceivedListener(notification => {
      if (!user) return;
      const data = notification.request.content.data as Record<string, any>;
      const type = data?.type as string;
      const body = notification.request.content.body ?? '';

      const typeMap: Record<string, { title: string; onPress: () => void }> = {
        message:              { title: notification.request.content.title ?? 'Nova mensagem', onPress: () => { if (data.senderId) navigationRef.current?.navigate('UserChat', { userId: data.senderId, userName: data.senderName, userPhoto: data.senderPhoto }); } },
        request:              { title: 'Nova solicitação',         onPress: () => navigationRef.current?.navigate('Requests') },
        sintonia_criada:      { title: '✦ Sintonia!',              onPress: () => { if (data.sintoniaWith) navigationRef.current?.navigate('RealProfile', { userId: data.sintoniaWith }); } },
        sale_completed:       { title: '💰 Venda realizada!',      onPress: () => navigationRef.current?.navigate('MyEarnings') },
        purchase_confirmed:   { title: '📦 Compra confirmada!',    onPress: () => navigationRef.current?.navigate('MyPurchases') },
        creator_approved:     { title: '🎨 Você é um Criador!',    onPress: () => navigationRef.current?.navigate('MyProducts') },
        product_approved:     { title: '✅ Produto aprovado!',     onPress: () => navigationRef.current?.navigate('MyProducts') },
        refund_processed:     { title: '↩️ Reembolso processado',  onPress: () => navigationRef.current?.navigate('MyPurchases') },
        withdrawal_paid:      { title: '💸 Saque pago!',           onPress: () => navigationRef.current?.navigate('MyEarnings') },
        withdrawal_rejected:  { title: '❌ Saque rejeitado',       onPress: () => navigationRef.current?.navigate('MyEarnings') },
        marketplace_banned:   { title: '🚫 Marketplace suspenso',  onPress: () => {} },
        marketplace_unbanned: { title: '✅ Acesso liberado',       onPress: () => {} },
      };

      const config = typeMap[type];
      if (config) setInAppNotif({ title: config.title, message: body, type, onPress: config.onPress });
    });

    return () => { tapSub.remove(); receiveSub.remove(); };
  }, [user]);

  console.log('[APP STATE]', { authLoading, permLoading, user: !!user, hasProfile, canAccessAdminPanel, adminBootReady });

  if (authLoading) return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={AppLoadingScreen} />
    </Stack.Navigator>
  );

  if (!user) return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login"    component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );

  // permLoading ANTES do perfil: o gate precisa do status da
  // verificação para decidir a etapa, e ele vem daqui. Antes o
  // !hasProfile vinha primeiro — para quem já tem conta a
  // diferença é imperceptível.
  if (permLoading) return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={AppLoadingScreen} />
    </Stack.Navigator>
  );

  // ============================================
  // GATE DE ACESSO
  // ============================================
  // Ordem e regras vivem em navigation/accessGate.ts — função
  // pura, legível e testável, em vez de if espalhados aqui.
  //
  // Cada etapa é uma árvore de UMA tela, com nome exclusivo:
  // nome repetido entre árvores faz o React Navigation
  // preservar a rota errada na troca (foi o bug do
  // ProfileSetup/ProfileOnboarding).
  //
  // ISTO É UX, NÃO SEGURANÇA: um APK modificado pula qualquer
  // tela. A barreira real são as Rules e as CFs.
  const gateStep = resolveAccessGate({
    hasProfile,
    isBlocked,
    isSuperAdmin,
    loadError,
    accessGate,
    currentTermsVersion: APP_TERMS_VERSION,
  });

  if (gateStep === 'error') return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GateError">
        {() => <GateErrorScreen onRetry={retry} />}
      </Stack.Screen>
    </Stack.Navigator>
  );

  if (gateStep === 'blocked') return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AccountBannedGate" component={AccountBannedScreen} />
    </Stack.Navigator>
  );

  if (gateStep === 'terms') return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TermsGate">
        {/* Sem onAccepted próprio: a CF grava
            acceptedAppTermsVersion e o onSnapshot do
            useUserPermissions troca a árvore sozinho. */}
        {() => <TermsAcceptScreen onAccepted={() => {}} />}
      </Stack.Screen>
    </Stack.Navigator>
  );

  // Nome DIFERENTE de 'ProfileSetup' (que existe na MainStack).
  // Com o mesmo nome nas duas árvores, o React Navigation preservava
  // a rota ativa na troca e o app reabria o formulário de perfil —
  // vazio, porque a rota da MainStack tem initialParams editMode: true.
  if (gateStep === 'profile') return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileOnboarding" component={ProfileSetupScreen} />
    </Stack.Navigator>
  );

  // 'rejected' com forceCapture abre a captura para reenviar.
  if (gateStep === 'verification' || (gateStep === 'rejected' && forceCapture)) return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AgeVerificationGate">
        {() => (
          <AgeVerificationScreen
            onSubmitted={() => setForceCapture(false)}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );

  if (gateStep === 'pending' || gateStep === 'rejected') return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VerificationPendingGate">
        {() => (
          <VerificationPendingScreen
            onResubmit={() => setForceCapture(true)}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );

  // gateStep === 'app' daqui para baixo.
  if (canAccessAdminPanel && !adminBootReady) return (
    <AdminLoadingScreen onFinish={() => { _adminBootDone = true; setAdminBootReady(true); }} />
  );

  return (
    <NavigationPermissionsContext.Provider value={{
      isBlocked,
      isSuperAdmin,
      marketplaceEnabled: marketplaceEnabled ?? false,
    }}>
      <EngagementInitializer />
      <UpdateChecker />
      <MainStack />
      {inAppNotif && (
        <InAppNotification
          title={inAppNotif.title}
          message={inAppNotif.message}
          type={inAppNotif.type as any}
          onPress={inAppNotif.onPress}
          onDismiss={() => setInAppNotif(null)}
        />
      )}
    </NavigationPermissionsContext.Provider>
  );
}

// ============================================
// ROOT
// ============================================
export default function AppNavigator() {
  return (
    <AuthProvider>
      <CoinsProvider>
        <NavigationContainer ref={navigationRef}>
          <AppContent />
        </NavigationContainer>
      </CoinsProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  badge: {
    position:        'absolute',
    top:             -4,
    right:           -8,
    backgroundColor: colors.gold,
    borderRadius:    8,
    minWidth:        16,
    height:          16,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color:      colors.background,
    fontSize:   9,
    fontWeight: 'bold',
  },
});