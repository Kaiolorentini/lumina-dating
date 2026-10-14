// ============================================
// LUMINA — USER CHAT SCREEN v5.3
// src/modules/chat/screens/UserChatScreen.tsx
//
// v5.3 (13/10/2026, web D6): o corpo do chat foi para
// components/ChatConversation (o mesmo código, agora reutilizado no
// painel das Sintonias do computador). Esta tela só lê os parâmetros
// da rota e mostra a conversa com o Header de sempre. No tablet e no
// computador a conversa fica numa coluna de leitura (até 820 px) em
// vez de esticar até as bordas do monitor. Celular e app: iguais.
//
// D7: no COMPUTADOR esta tela não abre sozinha — ela fecha e leva às
// Sintonias com a conversa aberta ao lado (chatWith), o mesmo lugar
// de sempre. Celular, tablet e app: a tela de chat de sempre.
//
// v5.2: progressMission send_message ao enviar (fire-and-forget)
// ============================================

import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../../theme';
import { RootStackParamList } from '../../../navigation/types';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { pageContentStyle } from '../../../components/layout/PageContainer';
import ChatConversation from '../components/ChatConversation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function UserChatScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<any>();
  const { isPhone, isDesktop } = useBreakpoint();

  const targetUserId:    string = route.params?.userId;
  const targetUserName:  string = route.params?.userName;
  const targetUserPhoto: string = route.params?.userPhoto;

  useEffect(() => {
    if (!isDesktop || !targetUserId) return;
    if (navigation.canGoBack()) navigation.goBack();
    (navigation as any).navigate('MainTabs', { screen: 'Sintonias', params: { chatWith: targetUserId } });
  }, [isDesktop, targetUserId, navigation]);

  if (isDesktop && targetUserId) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.column, pageContentStyle('reading', isPhone)]}>
        <ChatConversation
          variant="screen"
          targetUserId={targetUserId}
          targetUserName={targetUserName}
          targetUserPhoto={targetUserPhoto}
          onBlocked={() => navigation.goBack()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  column:    { flex: 1 },
  center:    { alignItems: 'center', justifyContent: 'center' },
});
