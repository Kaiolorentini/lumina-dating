import React, { useEffect, useState } from 'react';
import UpdateChecker from '../components/UpdateChecker';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import PushInitializer from '../modules/notifications/components/PushInitializer';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { CoinsProvider } from '../context/CoinsContext';
import SplashScreen from '../screens/Onboarding/SplashScreen';
import { LoginScreen, RegisterScreen } from '../modules/auth';
import { ProfileSetupScreen } from '../modules/profile';
import { HomeScreen } from '../modules/home';
import { ChatScreen } from '../modules/chat';
import SintoniasScreen from '../screens/Chat/SintoniasScreen';
import { StoreScreen } from '../modules/economy';
import { colors } from '../theme';
import { NotificationsScreen } from '../modules/notifications';
import EngagementInitializer from '../components/EngagementInitializer';
import { RootStackParamList, TabParamList } from './types';
import AIProfileScreen from '../screens/Home/AIProfileScreen';
import MediaScreen from '../modules/media/screens/MediaScreen';
import ProfileScreen from '../modules/profile/screens/ProfileScreen';
import RealProfileScreen from '../screens/Profile/RealProfileScreen';
import UserChatScreen from '../modules/chat/screens/UserChatScreen';
import RequestsScreen from '../modules/profile/screens/RequestsScreen';
import BlockedScreen from '../screens/Profile/BlockedScreen';
import { LoadingScreen } from '../shared/components';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TabNavigator() {
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
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Descobrir',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color: color }}>✦</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Media"
        component={MediaScreen}
        options={{
          tabBarLabel: 'Mídia',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color: color }}>📸</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Sintonias"
        component={SintoniasScreen}
        options={{
          tabBarLabel: 'Sintonias',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color: color }}>💬</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Store"
        component={StoreScreen}
        options={{
          tabBarLabel: 'Loja',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color: color }}>💰</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color: color }}>👤</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading, hasProfile } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
      </Stack.Navigator>
    );
  }

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
      </Stack.Navigator>
    );
  }

  if (!hasProfile) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="AIProfile" component={AIProfileScreen} />
      <Stack.Screen name="RealProfile" component={RealProfileScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="UserChat" component={UserChatScreen} />
      <Stack.Screen
        name="ProfileSetup"
        component={ProfileSetupScreen}
        initialParams={{ editMode: true }}
      />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Requests" component={RequestsScreen} />
      <Stack.Screen name="Blocked" component={BlockedScreen} />
    </Stack.Navigator>
  );
}
export default function AppNavigator() {
  return (
    <AuthProvider>
      <CoinsProvider>
        <NavigationContainer>
          <EngagementInitializer />
          <PushInitializer />
          <UpdateChecker />
          <RootNavigator />
        </NavigationContainer>
      </CoinsProvider>
    </AuthProvider>
  );
}