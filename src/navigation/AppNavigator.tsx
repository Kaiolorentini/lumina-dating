import React, { useEffect, useState, useRef } from 'react';
import { Alert, Text, View, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Notifications from 'expo-notifications';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { COLLECTIONS } from '../core/constants';
import PushInitializer from '../modules/notifications/components/PushInitializer';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { CoinsProvider } from '../context/CoinsContext';
import SplashScreen from '../screens/Onboarding/SplashScreen';
import FragmentsScreen from '../modules/engagement/screens/FragmentsScreen';
import AppLoadingScreen from '../screens/Onboarding/LoadingScreen';
import { LoginScreen, RegisterScreen } from '../modules/auth';
import { ProfileSetupScreen } from '../modules/profile';
import { HomeScreen } from '../modules/home';
import { ChatScreen } from '../modules/chat';
import SintoniasScreen from '../screens/Chat/SintoniasScreen';
import { StoreScreen } from '../modules/economy';
import { COLORS, FONT_SIZE } from '../theme/tokens';
import { NotificationsScreen } from '../modules/notifications';
import EngagementInitializer from '../components/EngagementInitializer';
import UpdateChecker from '../components/UpdateChecker';
import { RootStackParamList, TabParamList } from './types';
import VaultScreen from '../modules/engagement/screens/VaultScreen';
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
import AdminUserDetailScreen from '../screens/admin/AdminUserDetailScreen';
import MissionsScreen from '../modules/engagement/screens/MissionsScreen';
import FaiscaScreen from '../modules/engagement/screens/FaiscaScreen';
import AchievementsScreen from '../modules/engagement/screens/AchievementsScreen';
import DestinyCardScreen from '../modules/engagement/screens/DestinyCardScreen';
import AdminLoadingScreen from '../screens/admin/AdminLoadingScreen';
import RankingScreen from '../modules/engagement/screens/RankingScreen';
import PremiumToolsScreen from '../modules/premium/screens/PremiumToolsScreen';
import PrestigeScreen from '../modules/engagement/screens/PrestigeScreen';
import {
  AdminProductsModerationScreen,
  AdminSalesScreen,
  AdminRefundRequestsScreen,
  AdminFraudFlagsScreen,
  AdminCouponsScreen,
  AdminReportsScreen,
  AdminProductReviewScreen,
} from '../screens/admin/AdminPlaceholderScreens';

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
          backgroundColor: COLORS.card,
          borderTopColor:  COLORS.gold,
          borderTopWidth:  0.5,
          height:          60 + insets.bottom,
          paddingBottom:   insets.bottom > 0 ? insets.bottom : 8,
          paddingTop:      4,
        },
        tabBarActiveTintColor:   COLORS.gold,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: {
          fontSize: FONT_SIZE.overline,
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
              <Text style={{ fontSize: FONT_SIZE.title, color }}>✦</Text>
              {unreadNotifs > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />


      <Tab.Screen name="Sintonias" component={SintoniasScreen}
        options={{
          tabBarLabel: 'Sintonias',
          tabBarIcon: ({ color }) => (
            <View>
              <Text style={{ fontSize: FONT_SIZE.title, color }}>✨</Text>
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
          tabBarIcon: ({ color }) => <Text style={{ fontSize: FONT_SIZE.title, color }}>✨</Text>,
        }}
      />

      <Tab.Screen name="Marketplace" component={MarketplaceHomeScreen}
        options={{
          tabBarLabel:   'Marketplace',
          tabBarIcon:    ({ color }) => <Text style={{ fontSize: FONT_SIZE.title, color }}>🛍️</Text>,
          tabBarButton:  showMarketplace ? undefined : hideTabButton,
          tabBarItemStyle: showMarketplace ? {} : { width: 0, height: 0 },
        }}
      />

      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color }) => (
            <View>
              <Text style={{ fontSize: FONT_SIZE.title, color }}>👤</Text>
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
            tabBarIcon:  ({ color }) => <Text style={{ fontSize: FONT_SIZE.title, color }}>👑</Text>,
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
      <Stack.Screen name="AdminSales"            component={AdminSalesScreen} />
      <Stack.Screen name="AdminRefundRequests"   component={AdminRefundRequestsScreen} />
      <Stack.Screen name="AdminWithdrawals"      component={AdminWithdrawalsScreen} />
      <Stack.Screen name="AdminFraudFlags"       component={AdminFraudFlagsScreen} />
      <Stack.Screen name="AdminUserSearch"       component={AdminUserSearchScreen} />
      <Stack.Screen name="AdminUserDetail"       component={AdminUserDetailScreen} />
      <Stack.Screen name="AdminCoupons"          component={AdminCouponsScreen} />
      <Stack.Screen name="AdminReports"          component={AdminReportsScreen} />
      <Stack.Screen name="AdminProductReview"    component={AdminProductReviewScreen} />
      <Stack.Screen name="DestinyCard" component={DestinyCardScreen} />
      <Stack.Screen name="Missions" component={MissionsScreen} />
      <Stack.Screen name="Faisca" component={FaiscaScreen} />
      <Stack.Screen name="Fragments" component={FragmentsScreen} />
      <Stack.Screen name="Vault" component={VaultScreen} />
      <Stack.Screen name="Achievements" component={AchievementsScreen} />
      <Stack.Screen name="Ranking" component={RankingScreen} />
      <Stack.Screen name="Prestige" component={PrestigeScreen} />
      <Stack.Screen name="PremiumTools" component={PremiumToolsScreen} />
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
  const { isSuperAdmin, isBlocked, loading: permLoading } = useUserPermissions(user?.uid);
  const { marketplaceEnabled }  = useAppSettings();
  const canAccessAdminPanel     = isSuperAdmin;
  const [adminBootReady, setAdminBootReady] = useState(_adminBootDone);
  const [inAppNotif, setInAppNotif]         = useState<InAppNotifState | null>(null);

  usePushNotifications();

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
      case 'sale_completed':
      case 'withdrawal_paid':
      case 'withdrawal_rejected': navigationRef.current.navigate('MyEarnings'); break;
      case 'purchase_confirmed':
      case 'refund_processed':    navigationRef.current.navigate('MyPurchases'); break;
      case 'creator_approved':
      case 'product_approved':    navigationRef.current.navigate('MyProducts');  break;
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
        sale_completed:       { title: '💰 Venda realizada!',      onPress: () => navigationRef.current?.navigate('MyEarnings') },
        purchase_confirmed:   { title: '📦 Compra confirmada!',    onPress: () => navigationRef.current?.navigate('MyPurchases') },
        creator_approved:     { title: '🎨 Você é um Criador!',    onPress: () => navigationRef.current?.navigate('MyProducts') },
        product_approved:     { title: '✅ Produto aprovado!',     onPress: () => navigationRef.current?.navigate('MyProducts') },
        refund_processed:     { title: '↩️ Reembolso processado',  onPress: () => navigationRef.current?.navigate('MyPurchases') },
        withdrawal_paid:      { title: '💸 Saque pago!',           onPress: () => navigationRef.current?.navigate('MyEarnings') },
        withdrawal_rejected:  { title: '❌ Saque rejeitado',       onPress: () => navigationRef.current?.navigate('MyEarnings') },
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

  if (!hasProfile) return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </Stack.Navigator>
  );

  if (permLoading) return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={AppLoadingScreen} />
    </Stack.Navigator>
  );

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
      <PushInitializer />
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
    <SafeAreaProvider>
      <AuthProvider>
        <CoinsProvider>
          <NavigationContainer ref={navigationRef}>
            <AppContent />
          </NavigationContainer>
        </CoinsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  badge: {
    position:        'absolute',
    top:             -4,
    right:           -8,
    backgroundColor: COLORS.gold,
    borderRadius:    8,
    minWidth:        16,
    height:          16,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color:      COLORS.background,
    fontSize:   9,
    fontWeight: 'bold',
  },
});