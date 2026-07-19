import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../../components/ui';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT , alpha} from '../../theme/tokens';
import ScreenContainer from '../../components/ScreenContainer';

export default function EditProductScreen() {
  const navigation = useNavigation();
  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Editar Produto</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.center}>
        <Text style={styles.icon}>✏️</Text>
        <Text style={styles.title}>Edição de produto</Text>
        <Text style={styles.subtitle}>Em implementação final</Text>
      </View>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 64, marginBottom: SPACING.md },
  title: { color: COLORS.textPrimary, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold },
  subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body, marginTop: SPACING.sm },
});
