// ============================================
// LUMINA — CHAMADO (conversa)
// src/modules/support/screens/SupportTicketScreen.tsx
//
// Mesma tela para o usuário e para o admin. Quando quem abre é
// admin e o chamado é de outra pessoa: aparecem as respostas do
// questionário, o aparelho, a prioridade e o botão Resolver.
// Abrir a tela apaga o balão do lado de quem abriu.
// ============================================

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image, Modal,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import { useUserPermissions } from '../../../hooks/useUserPermissions';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { categoryById } from '../supportQuestionnaire';
import {
  listenTicket, listenMessages, replyTicket, resolveTicket, markTicketRead,
  getAttachmentUrl, uploadSupportImage, SupportTicket, SupportMessage, STATUS_LABEL,
} from '../services/supportService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'SupportTicket'>;

const PRIORITY_LABEL = { urgent: '🚨 Urgente', normal: 'Normal', low: 'Baixa' } as const;

function formatTime(d: Date | null): string {
  if (!d) return '';
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function SupportTicketScreen() {
  const navigation = useNavigation<NavProp>();
  const { ticketId } = useRoute<RouteProps>().params;
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin } = useUserPermissions(user?.uid);

  const [ticket, setTicket]     = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [text, setText]         = useState('');
  const [image, setImage]       = useState<{ uri: string; base64: string } | null>(null);
  const [sending, setSending]   = useState(false);
  const [resolving, setResolving] = useState(false);
  const [viewer, setViewer]     = useState<string | null>(null);
  const listRef = useRef<FlatList<SupportMessage>>(null);

  const isOwner   = !!ticket && ticket.uid === user?.uid;
  const adminMode = !!ticket && !isOwner && (isAdmin || isSuperAdmin);

  useEffect(() => {
    const unsubTicket = listenTicket(ticketId,
      t => { setTicket(t); setLoading(false); if (!t) setError('Chamado não encontrado.'); },
      () => { setError('Não foi possível abrir o chamado.'); setLoading(false); });
    const unsubMessages = listenMessages(ticketId, setMessages, () => {});
    return () => { unsubTicket(); unsubMessages(); };
  }, [ticketId]);

  // Balão some ao abrir — do lado de quem abriu.
  useEffect(() => {
    if (!ticket) return;
    const unread = isOwner ? ticket.unreadForUser : adminMode && ticket.unreadForAdmin;
    if (unread) markTicketRead(ticketId).catch(() => {});
  }, [ticket, isOwner, adminMode, ticketId]);

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
    if (!result.canceled && result.assets[0]?.base64) {
      setImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  }

  async function send() {
    if (!user?.uid || (!text.trim() && !image)) return;
    setSending(true);
    try {
      const attachmentPath = image ? await uploadSupportImage(user.uid, image.base64) : null;
      await replyTicket(ticketId, text.trim(), attachmentPath);
      setText('');
      setImage(null);
    } catch (e: unknown) {
      Alert.alert('Mensagem não enviada', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setSending(false);
    }
  }

  function confirmResolve() {
    Alert.alert('Marcar como resolvido?', 'O usuário é avisado e o chamado é encerrado.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Resolver',
        onPress: async () => {
          setResolving(true);
          try { await resolveTicket(ticketId); }
          catch (e: unknown) { Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível resolver.'); }
          finally { setResolving(false); }
        },
      },
    ]);
  }

  async function openAttachment(path: string) {
    try {
      setViewer(await getAttachmentUrl(ticketId, path));
    } catch (e: unknown) {
      Alert.alert('Anexo', e instanceof Error ? e.message : 'Não foi possível abrir.');
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Chamado" showBack showHome />
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      </View>
    );
  }

  if (error || !ticket) {
    return (
      <View style={styles.container}>
        <Header title="Chamado" showBack showHome />
        <View style={styles.center}><Text style={styles.errorText}>{error ?? 'Chamado não encontrado.'}</Text></View>
      </View>
    );
  }

  const cat = categoryById(ticket.category);
  const resolved = ticket.status === 'resolved';

  const detailsHeader = (
    <View style={styles.details}>
      <Text style={styles.detailsTitle}>{cat?.icon ?? '🆘'} {ticket.categoryLabel}</Text>
      <Text style={styles.detailsStatus}>
        {STATUS_LABEL[ticket.status]}{adminMode ? ` · ${PRIORITY_LABEL[ticket.priority]}` : ''} · aberto em {formatTime(ticket.createdAt)}
      </Text>

      {ticket.answers.map(a => (
        <View key={a.questionId} style={styles.answerRow}>
          <Text style={styles.answerQ}>{a.question}</Text>
          <Text style={styles.answerA}>{a.labels.join(', ')}{a.text ? ` — ${a.text}` : ''}</Text>
        </View>
      ))}

      {ticket.attachmentPath && (
        <TouchableOpacity onPress={() => openAttachment(ticket.attachmentPath!)}>
          <Text style={styles.attachLink}>📎 Ver print enviado</Text>
        </TouchableOpacity>
      )}

      {adminMode && (
        <View style={styles.adminBox}>
          <Text style={styles.adminLine}>👤 {ticket.userName || ticket.uid} · {ticket.context.role}{ticket.context.galaxiaPlus ? ' · 💜 Galáxia Plus' : ''}</Text>
          <Text style={styles.adminLine}>
            📱 {ticket.device.platform} {ticket.device.osVersion}{ticket.device.model ? ` · ${ticket.device.model}` : ''} · app {ticket.device.appVersion} ({ticket.device.runtimeVersion})
          </Text>
          <View style={styles.adminActions}>
            <TouchableOpacity style={styles.adminBtn} onPress={() => navigation.navigate('AdminUserDetail', { userId: ticket.uid })}>
              <Text style={styles.adminBtnText}>Ver usuário</Text>
            </TouchableOpacity>
            {ticket.reportedUid && (
              <TouchableOpacity style={styles.adminBtn} onPress={() => navigation.navigate('AdminUserDetail', { userId: ticket.reportedUid! })}>
                <Text style={styles.adminBtnText}>Ver denunciado</Text>
              </TouchableOpacity>
            )}
          </View>
          {!resolved && (
            <TouchableOpacity style={styles.resolveBtn} onPress={confirmResolve} disabled={resolving}>
              {resolving ? <ActivityIndicator color={colors.background} /> : <Text style={styles.resolveText}>✅ Marcar como resolvido</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title={adminMode ? 'Chamado (admin)' : 'Meu chamado'} showBack showHome />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={detailsHeader}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {adminMode ? 'Nenhuma mensagem ainda. Responda abaixo.' : 'Recebemos seu chamado. A resposta aparece aqui.'}
            </Text>
          }
          renderItem={({ item }) => {
            const mine = (item.author === 'admin') === adminMode;
            return (
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={styles.bubbleAuthor}>{item.author === 'admin' ? 'Suporte Lumina' : (adminMode ? ticket.userName || 'Usuário' : 'Você')}</Text>
                {item.text ? <Text style={styles.bubbleText}>{item.text}</Text> : null}
                {item.attachmentPath && (
                  <TouchableOpacity onPress={() => openAttachment(item.attachmentPath!)}>
                    <Text style={styles.attachLink}>📎 Ver imagem</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.bubbleTime}>{formatTime(item.createdAt)}</Text>
              </View>
            );
          }}
        />

        {resolved ? (
          <View style={styles.resolvedBar}>
            <Text style={styles.resolvedText}>
              ✅ Chamado resolvido.{isOwner ? ' Se precisar, abra um novo em Suporte.' : ''}
            </Text>
          </View>
        ) : (
          <View style={styles.composer}>
            {image && (
              <View style={styles.pendingImage}>
                <Image source={{ uri: image.uri }} style={styles.pendingThumb} />
                <TouchableOpacity onPress={() => setImage(null)}><Text style={styles.removeText}>✕</Text></TouchableOpacity>
              </View>
            )}
            <View style={styles.composerRow}>
              <TouchableOpacity onPress={pickImage} style={styles.attachBtn} accessibilityLabel="Anexar imagem">
                <Text style={{ fontSize: 20 }}>📎</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.composerInput}
                placeholder="Escreva sua mensagem"
                placeholderTextColor={colors.gray}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={2000}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (sending || (!text.trim() && !image)) && styles.sendDisabled]}
                onPress={send}
                disabled={sending || (!text.trim() && !image)}
                accessibilityLabel="Enviar"
              >
                {sending ? <ActivityIndicator color={colors.background} size="small" /> : <Text style={styles.sendText}>➤</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal visible={viewer !== null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <TouchableOpacity style={styles.viewer} activeOpacity={1} onPress={() => setViewer(null)}>
          {viewer && <Image source={{ uri: viewer }} style={styles.viewerImage} resizeMode="contain" />}
          <Text style={styles.viewerHint}>Toque para fechar</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  errorText: { color: colors.error, fontSize: fonts.sizes.md, textAlign: 'center' },
  list:      { padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  details: {
    padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.grayDark, gap: spacing.xs, marginBottom: spacing.sm,
  },
  detailsTitle:  { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  detailsStatus: { color: colors.gray, fontSize: fonts.sizes.xs, marginBottom: spacing.xs },
  answerRow:     { gap: 1 },
  answerQ:       { color: colors.gray, fontSize: fonts.sizes.xs },
  answerA:       { color: colors.white, fontSize: fonts.sizes.sm },
  attachLink:    { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold', marginTop: 4 },
  adminBox: {
    marginTop: spacing.sm, padding: spacing.sm, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gold + '55', gap: spacing.xs,
  },
  adminLine:    { color: colors.white, fontSize: fonts.sizes.xs },
  adminActions: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  adminBtn:     { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gold },
  adminBtnText: { color: colors.gold, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  resolveBtn:   { marginTop: spacing.xs, backgroundColor: colors.success, borderRadius: borderRadius.sm, padding: spacing.sm, alignItems: 'center' },
  resolveText:  { color: colors.background, fontWeight: 'bold' },
  emptyText:    { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center', marginTop: spacing.md },
  bubble:       { maxWidth: '85%', padding: spacing.sm, borderRadius: borderRadius.md, gap: 2 },
  bubbleMine:   { alignSelf: 'flex-end', backgroundColor: colors.gold + '22', borderWidth: 1, borderColor: colors.gold + '55' },
  bubbleOther:  { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.grayDark },
  bubbleAuthor: { color: colors.gold, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  bubbleText:   { color: colors.white, fontSize: fonts.sizes.md, lineHeight: 21 },
  bubbleTime:   { color: colors.gray, fontSize: 10, alignSelf: 'flex-end' },
  resolvedBar:  { padding: spacing.md, borderTopWidth: 0.5, borderTopColor: colors.grayDark, backgroundColor: colors.surface },
  resolvedText: { color: colors.success, fontSize: fonts.sizes.sm, textAlign: 'center' },
  composer:     { borderTopWidth: 0.5, borderTopColor: colors.grayDark, padding: spacing.sm, backgroundColor: colors.surface, gap: spacing.xs },
  pendingImage: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pendingThumb: { width: 48, height: 48, borderRadius: borderRadius.sm },
  removeText:   { color: colors.error, fontWeight: 'bold', fontSize: fonts.sizes.md },
  composerRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  attachBtn:    { padding: spacing.sm },
  composerInput: {
    flex: 1, maxHeight: 120, backgroundColor: colors.background, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark, color: colors.white, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  sendBtn:      { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.4 },
  sendText:     { color: colors.background, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  viewer:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImage:  { width: '100%', height: '80%' },
  viewerHint:   { color: colors.gray, marginTop: spacing.md },
});