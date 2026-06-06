import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts, spacing } from '../../theme';

function AdminPlaceholder({ title, icon }: { title: string; icon: string }) {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.center}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Implementação completa na FASE 11</Text>
      </View>
    </View>
  );
}

export function AdminProductsModerationScreen() {
  return <AdminPlaceholder title="Moderação de Produtos" icon="📦" />;
}

export function AdminSalesScreen() {
  return <AdminPlaceholder title="Vendas" icon="💳" />;
}

export function AdminRefundRequestsScreen() {
  return <AdminPlaceholder title="Reembolsos" icon="↩️" />;
}

export function AdminFraudFlagsScreen() {
  return <AdminPlaceholder title="Fraudes" icon="🚨" />;
}

export function AdminCouponsScreen() {
  return <AdminPlaceholder title="Cupons" icon="🎟️" />;
}

export function AdminReportsScreen() {
  return <AdminPlaceholder title="Relatórios" icon="📊" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 64, marginBottom: spacing.md },
  title: { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  subtitle: { color: colors.gray, fontSize: fonts.sizes.md, marginTop: spacing.md },
});