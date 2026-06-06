import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { COLLECTIONS } from '../core/constants';
import PushInitializer from '../modules/notifications/components/PushInitializer';
import { AuthProvider, useAuth } from '../context/AuthContext';
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
import AIProfileScreen from '../screens/Home/AIProfileScreen';
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
import AdminUserDetailScreen from '../screens/admin/AdminUserDetailScreen';
import {
  AdminProductsModerationScreen,
  AdminSalesScreen,
  AdminRefundRequestsScreen,
  AdminFraudFlagsScreen,
  AdminCouponsScreen,
  AdminReportsScreen,
} from '../screens/admin/AdminPlaceholderScreens';


const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const navigationRef = React.createRef<any>();

function TabNavigator() {
  const { user } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const unsubscribersRef = useRef<(() => void)[]>([]);

  // ← ADICIONADO: hooks do marketplace
  const { marketplaceEnabled } = useAppSettings();
 const { isBlocked, isAdmin } = useUserPermissions(user?.uid);

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

        const chatId = generateChatId(user.uid, otherUserId);
        const messagesRef = collection(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES);
        const unreadQ = query(
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

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.gold,
          borderTopWidth: 0.5,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.gray,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: 'bold',
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
            <Text style={styles.badgeText}>
              {unreadNotifs > 9 ? '9+' : unreadNotifs}
            </Text>
          </View>
        )}
      </View>
    ),
  }}
/>
      <Tab.Screen name="Media" component={MediaScreen}
        options={{
          tabBarLabel: 'Midia',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📸</Text>
          ),
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
            <Text style={styles.badgeText}>
              {unreadMessages > 9 ? '9+' : unreadMessages}
            </Text>
          </View>
        )}
      </View>
    ),
  }}
/>
      <Tab.Screen name="Store" component={StoreScreen}
        options={{
          tabBarLabel: 'Moedas',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>💰</Text>
          ),
        }}
      />
      {/* ← ADICIONADO: tab Marketplace — visível apenas se habilitado e não bloqueado */}
      {marketplaceEnabled && !isBlocked && (
        <Tab.Screen name="Marketplace" component={MarketplaceHomeScreen}
          options={{
            tabBarLabel: 'Marketplace',
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 20, color }}>🛍️</Text>
            ),
          }}
        />
      )}
      
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color }) => (
            <View>
              <Text style={{ fontSize: 20, color }}>👤</Text>
              {totalProfileBadge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {totalProfileBadge > 9 ? '9+' : totalProfileBadge}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      {/* ← ADICIONADO: tab Admin — visível apenas para admin/superadmin */}
      // DEPOIS (correto):
{isAdmin && (
  <Tab.Screen name="Admin" component={AdminDashboardScreen}
    options={{
      tabBarLabel: 'Admin',
      tabBarIcon: ({ color }) => (
        <Text style={{ fontSize: 20, color }}>👑</Text>
      ),
    }}
  />
)}
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function SetupStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </Stack.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="AIProfile" component={AIProfileScreen} />
      <Stack.Screen name="RealProfile" component={RealProfileScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="UserChat" component={UserChatScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen}
        initialParams={{ editMode: true }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Requests" component={RequestsScreen} />
      <Stack.Screen name="Blocked" component={BlockedScreen} />
      <Stack.Screen name="PaymentSetup" component={PaymentSetupScreen} />
      {/* ← ADICIONADO: telas do marketplace */}
      <Stack.Screen name="MarketplaceHome" component={MarketplaceHomeScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="MyPurchases" component={MyPurchasesScreen} />
      <Stack.Screen name="ContentViewer" component={ContentViewerScreen} />
      <Stack.Screen name="MyProducts" component={MyProductsScreen} />
      <Stack.Screen name="CreateProduct" component={CreateProductScreen} />
      <Stack.Screen name="EditProduct" component={EditProductScreen} />
      <Stack.Screen name="MyFavorites" component={MyFavoritesScreen} />
      <Stack.Screen name="MyEarnings" component={MyEarningsScreen} />
      <Stack.Screen name="Withdrawal" component={WithdrawalScreen} />
      <Stack.Screen name="CreatorRequest" component={CreatorRequestScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      {/* Admin — protegido por role no hook */}
<Stack.Screen name="AdminPanel" component={AdminDashboardScreen} />
<Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
<Stack.Screen name="AdminCreatorRequests" component={AdminCreatorRequestsScreen} />
<Stack.Screen name="AdminProductsModeration" component={AdminProductsModerationScreen} />
<Stack.Screen name="AdminSales" component={AdminSalesScreen} />
<Stack.Screen name="AdminRefundRequests" component={AdminRefundRequestsScreen} />
<Stack.Screen name="AdminWithdrawals" component={AdminWithdrawalsScreen} />
<Stack.Screen name="AdminFraudFlags" component={AdminFraudFlagsScreen} />
<Stack.Screen name="AdminUserSearch" component={AdminUserSearchScreen} />
<Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} />
<Stack.Screen name="AdminCoupons" component={AdminCouponsScreen} />
<Stack.Screen name="AdminReports" component={AdminReportsScreen} />
    </Stack.Navigator>
  );
}

function AppContent() {
  const { user, loading, hasProfile } = useAuth();

  const [showSplash, setShowSplash] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const lastNotifId = useRef<string>('');

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    if (!showSplash && user) {
      setShowLoading(true);
      const loadingTimer = setTimeout(() => {
        setShowLoading(false);
      }, 7000);
      return () => clearTimeout(loadingTimer);
    }
  }, [showSplash, user]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      const id = response.notification.request.identifier;
      if (id === lastNotifId.current) return;
      lastNotifId.current = id;

      if (!navigationRef.current) return;

      if (data?.type === 'message') {
        navigationRef.current.navigate('UserChat', {
          userId: data.senderId,
          userName: data.senderName,
          userPhoto: data.userPhoto || '',
        });
      } else if (data?.type === 'request') {
        navigationRef.current.navigate('Requests');
      }
    });

    return () => sub.remove();
  }, []);

  if (showSplash) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
      </Stack.Navigator>
    );
  }

  if (showLoading || loading) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={AppLoadingScreen} />
      </Stack.Navigator>
    );
  }

  if (!user) return <AuthStack />;
  if (!hasProfile) return <SetupStack />;
  return <MainStack />;
}

function InAppNotificationHandler() {
  const { inAppNotif, dismissInAppNotif } = usePushNotifications();

  if (!inAppNotif) return null;

  return (
    <InAppNotification
      title={inAppNotif.title}
      message={inAppNotif.message}
      type={inAppNotif.type}
      onDismiss={dismissInAppNotif}
      onPress={() => {
        if (!navigationRef.current) return;
        if (inAppNotif.type === 'message') {
          navigationRef.current.navigate('UserChat', {
            userId: inAppNotif.data?.senderId,
            userName: inAppNotif.data?.senderName,
            userPhoto: inAppNotif.data?.userPhoto || '',
          });
        } else if (inAppNotif.type === 'request') {
          navigationRef.current.navigate('Requests');
        }
      }}
    />
  );
}

export default function AppNavigator() {
  return (
    <AuthProvider>
      <CoinsProvider>
        <NavigationContainer ref={navigationRef}>
          <EngagementInitializer />
          <PushInitializer />
          <UpdateChecker />
          <AppContent />
          <InAppNotificationHandler />
        </NavigationContainer>
      </CoinsProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: 'bold',
  },
});