// ============================================
// CHECKOUT SCREEN
//
// ⚠️ API_TODO #13:
// Quando ASAAS_API_KEY estiver configurada:
// 1. Exibir QR Code Pix recebido de createAsaasPayment
// 2. Implementar polling de status a cada 5s
// 3. Navegar para ContentViewer após pagamento confirmado
//
// GET /sales/{saleId} → verificar status == 'paid'
// ============================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts, spacing, borderRadius } from '../../theme';

export default function CheckoutScreen() {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pagamento</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.center}>
        <Text style={styles.icon}>⏳</Text>
        <Text style={styles.title}>Pagamentos em breve</Text>
        <Text style={styles.subtitle}>
          A integração com Asaas está sendo configurada.{'\n'}
          Em breve você poderá pagar via Pix ou Cartão.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Voltar</Text>
        </TouchableOpacity>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  icon: { fontSize: 64, marginBottom: spacing.md },
  title: { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold', marginBottom: spacing.md },
  subtitle: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  btn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  btnText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
});