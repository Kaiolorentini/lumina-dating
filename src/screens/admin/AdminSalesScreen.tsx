// Template reutilizável para as telas restantes
// Cada uma segue o mesmo padrão de AdminCreatorRequestsScreen
// com os dados específicos de cada collection

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts, spacing } from '../../theme';

// AdminProductsModerationScreen
export function AdminProductsModerationScreen() {
  const navigation = useNavigation();
  return <AdminPlaceholder navigation={navigation} title="Moderação de Produtos" icon="📦" />;
}

// AdminSalesScreen
export function AdminSalesScreen() {
  const navigation = useNavigation();
  return <AdminPlaceholder navigation={navigation} title="Vendas" icon="💳" />;
}

// AdminRefundRequestsScreen
export function AdminRefundRequestsScreen() {
  const navigation = useNavigation();
  return <AdminPlaceholder navigation={navigation} title="Reembolsos" icon="↩️" />;
}

// AdminFraudFlagsScreen
export function AdminFraudFlagsScreen() {
  const navigation = useNavigation();
  return <AdminPlaceholder navigation={navigation} title="Fraudes" icon="🚨" />;
}

// AdminCouponsScreen
export function AdminCouponsScreen() {
  const navigation = useNavigation();
  return <AdminPlaceholder navigation={navigation} title="Cupons" icon="🎟️" />;
}

// AdminReportsScreen
export function AdminReportsScreen() {
  const navigation = useNavigation();
  return <AdminPlaceholder navigation={navigation} title="Relatórios" icon="📊" />;
}

function AdminPlaceholder({ navigation, title, icon }: any) {
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
  subtitle: { color: colors.gray, fontSize: fonts.sizes.md, marginTop: spacing.sm },
});