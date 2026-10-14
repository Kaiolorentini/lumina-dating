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
// v5.2: progressMission send_message ao enviar (fire-and-forget)
// ============================================

import React from 'react';
import { View, StyleSheet } from 'react-native';
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
  const { isPhone } = useBreakpoint();

  const targetUserId:    string = route.params?.userId;
  const targetUserName:  string = route.params?.userName;
  const targetUserPhoto: string = route.params?.userPhoto;

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
});
