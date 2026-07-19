import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Card } from '../../components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT , alpha} from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { useCreatorRequests } from '../../hooks/useCreatorRequests';
import { createCreatorRequest, cancelCreatorRequest } from '../../services/marketplace/creatorService';
import ScreenContainer from '../../components/ScreenContainer';

export default function CreatorRequestScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { request, loading, isPending, isApproved, isRejected } = useCreatorRequests(user?.uid);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  async function handleSubmit() {
    if (!user) return;
    if (!accepted) {
      Alert.alert('Termos', 'Você precisa aceitar os termos para continuar.');
      return;
    }
    setSubmitting(true);
    try {
      await createCreatorRequest(user.uid);
      Alert.alert('✅ Solicitação enviada!', 'Nossa equipe analisará em breve.');
    } catch (error: any) {
      Alert.alert('Erro', error.message ?? 'Não foi possível enviar a solicitação.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!request || !user) return;
    Alert.alert('Cancelar solicitação', 'Tem certeza?', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim, cancelar', style: 'destructive',
        onPress: async () => {
          try {
            await cancelCreatorRequest(request.id, user.uid);
            Alert.alert('Solicitação cancelada.');
          } catch (error: any) {
            Alert.alert('Erro', error.message);
          }
        },
      },
    ]);
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Ser Criador</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={COLORS.gold} />
        ) : isApproved ? (
          <Card padding={SPACING.lg} style={{ alignItems: 'center', marginBottom: SPACING.lg }}>
            <Text style={styles.statusIcon}>✅</Text>
            <Text style={styles.statusTitle}>Você já é um criador!</Text>
            <Text style={styles.statusText}>Acesse "Meus Produtos" para começar a publicar.</Text>
            <Button label="Ir para Meus Produtos" onPress={() => navigation.goBack()} variant="primary" fullWidth style={{ marginTop: SPACING.md }} />
          </Card>
        ) : isPending ? (
          <Card padding={SPACING.lg} style={{ alignItems: 'center', marginBottom: SPACING.lg }}>
            <Text style={styles.statusIcon}>⏳</Text>
            <Text style={styles.statusTitle}>Solicitação em análise</Text>
            <Text style={styles.statusText}>
              Nossa equipe analisará sua solicitação em breve.
            </Text>
            <Button label="Cancelar solicitação" onPress={handleCancel} variant="ghost" textStyle={{ color: COLORS.error }} fullWidth style={{ marginTop: SPACING.md }} />
          </Card>
        ) : isRejected ? (
          <Card padding={SPACING.lg} style={{ alignItems: 'center', marginBottom: SPACING.lg }}>
            <Text style={styles.statusIcon}>❌</Text>
            <Text style={styles.statusTitle}>Solicitação rejeitada</Text>
            {request?.rejectionReason && (
              <Text style={styles.statusText}>Motivo: {request.rejectionReason}</Text>
            )}
            <Text style={styles.statusText}>Você pode enviar uma nova solicitação.</Text>
          </Card>
        ) : null}

        {(!request || isRejected) && (
          <>
            <Text style={styles.sectionTitle}>O que você pode fazer como criador</Text>
            <Card padding={SPACING.md}>
              <Text style={styles.benefit}>📦 Publicar produtos digitais</Text>
              <Text style={styles.benefit}>💰 Ganhar 80% de cada venda</Text>
              <Text style={styles.benefit}>📊 Ver analytics dos produtos</Text>
              <Text style={styles.benefit}>💳 Sacar via Pix</Text>
              <Text style={styles.benefit}>⭐ Receber avaliações</Text>
            </Card>

            <Text style={styles.sectionTitle}>Termos e condições</Text>
            <Card padding={SPACING.md}>
              <Text style={styles.termsText}>
                • Apenas conteúdo original é permitido{'\n'}
                • Plágio resulta em banimento permanente{'\n'}
                • A Lumina retém 20% de comissão por venda{'\n'}
                • Você é responsável pelo conteúdo publicado
              </Text>
            </Card>

            <Button
              label={accepted ? '✅ Aceito os termos e condições' : '⬜ Aceito os termos e condições'}
              onPress={() => setAccepted(!accepted)}
              variant="ghost"
              fullWidth
              style={{ marginBottom: SPACING.md }}
            />

            <Button
              label="🚀 Solicitar acesso como criador"
              onPress={handleSubmit}
              loading={submitting}
              disabled={!accepted || submitting}
              variant="primary"
              fullWidth
            />
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    borderBottomWidth: 0.5, borderBottomColor: alpha(COLORS.gold, 0.27),
  },
  // backBtn removed — now uses Button
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  content: { padding: SPACING.md },
  statusIcon: { fontSize: 64, marginBottom: SPACING.md },
  statusTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.sm },
  statusText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body, textAlign: 'center' },
  sectionTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.sm, marginTop: SPACING.md },
  benefit: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body },
  termsText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body, lineHeight: 24 },
  // statusCard/benefitsCard/termsCard/checkBox/submitBtn/actionBtn/cancelBtn removed — now uses Card/Button
});
