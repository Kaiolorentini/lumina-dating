import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts, spacing, borderRadius } from '../../theme';
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ser Criador</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors.gold} />
        ) : isApproved ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusIcon}>✅</Text>
            <Text style={styles.statusTitle}>Você já é um criador!</Text>
            <Text style={styles.statusText}>Acesse "Meus Produtos" para começar a publicar.</Text>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.actionBtnText}>Ir para Meus Produtos</Text>
            </TouchableOpacity>
          </View>
        ) : isPending ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusIcon}>⏳</Text>
            <Text style={styles.statusTitle}>Solicitação em análise</Text>
            <Text style={styles.statusText}>
              Nossa equipe analisará sua solicitação em breve.
            </Text>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>Cancelar solicitação</Text>
            </TouchableOpacity>
          </View>
        ) : isRejected ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusIcon}>❌</Text>
            <Text style={styles.statusTitle}>Solicitação rejeitada</Text>
            {request?.rejectionReason && (
              <Text style={styles.statusText}>Motivo: {request.rejectionReason}</Text>
            )}
            <Text style={styles.statusText}>Você pode enviar uma nova solicitação.</Text>
          </View>
        ) : null}

        {(!request || isRejected) && (
          <>
            <Text style={styles.sectionTitle}>O que você pode fazer como criador</Text>
            <View style={styles.benefitsCard}>
              <Text style={styles.benefit}>📦 Publicar produtos digitais</Text>
              <Text style={styles.benefit}>💰 Ganhar 80% de cada venda</Text>
              <Text style={styles.benefit}>📊 Ver analytics dos produtos</Text>
              <Text style={styles.benefit}>💳 Sacar via Pix</Text>
              <Text style={styles.benefit}>⭐ Receber avaliações</Text>
            </View>

            <Text style={styles.sectionTitle}>Termos e condições</Text>
            <View style={styles.termsCard}>
              <Text style={styles.termsText}>
                • Apenas conteúdo original é permitido{'\n'}
                • Plágio resulta em banimento permanente{'\n'}
                • A Lumina retém 20% de comissão por venda{'\n'}
                • Você é responsável pelo conteúdo publicado
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.checkBox, accepted && styles.checkBoxActive]}
              onPress={() => setAccepted(!accepted)}
            >
              <Text style={styles.checkBoxText}>
                {accepted ? '✅' : '⬜'} Aceito os termos e condições
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, (!accepted || submitting) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!accepted || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.submitBtnText}>🚀 Solicitar acesso como criador</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  content: { padding: spacing.md },
  statusCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.lg,
  },
  statusIcon: { fontSize: 64, marginBottom: spacing.md },
  statusTitle: { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold', marginBottom: spacing.sm },
  statusText: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
  sectionTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', marginBottom: spacing.sm, marginTop: spacing.md },
  benefitsCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md,
  },
  benefit: { color: colors.white, fontSize: fonts.sizes.md },
  termsCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md,
  },
  termsText: { color: colors.gray, fontSize: fonts.sizes.md, lineHeight: 24 },
  checkBox: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md,
  },
  checkBoxActive: { borderColor: colors.gold, backgroundColor: colors.gold + '11' },
  checkBoxText: { color: colors.white, fontSize: fonts.sizes.md },
  submitBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
  actionBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.md, width: '100%',
  },
  actionBtnText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
  cancelBtn: {
    backgroundColor: 'transparent', borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.error, padding: spacing.md, alignItems: 'center', marginTop: spacing.md, width: '100%',
  },
  cancelBtnText: { color: colors.error, fontSize: fonts.sizes.md },
});