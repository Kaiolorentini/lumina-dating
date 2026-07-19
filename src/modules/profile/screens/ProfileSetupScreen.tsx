import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card, Input } from '../../../components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';
import { useAuth } from '../../../context/AuthContext';
import { RootStackParamList } from '../../../navigation/types';
import { Gender, Preference } from '../../../shared/types';
import { useProfileSetup } from '../hooks/useProfileSetup';
import ScreenContainer from '../../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const GENDER_OPTIONS: { label: string; value: Gender }[] = [
  { label: 'Masculino', value: 'masculino' },
  { label: 'Feminino', value: 'feminino' },
  { label: 'Trans', value: 'trans' },
  { label: 'Nao-binario', value: 'nao-binario' },
];

const PREFERENCE_OPTIONS: { label: string; value: Preference }[] = [
  { label: 'Homens', value: 'homens' },
  { label: 'Mulheres', value: 'mulheres' },
  { label: 'Trans', value: 'trans' },
  { label: 'Todos', value: 'todos' },
];

export default function ProfileSetupScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<any>();
  const { setHasProfile } = useAuth();
  const [saved, setSaved] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const editMode = route.params?.editMode === true;

  const {
    name, setName,
    age, setAge,
    city, setCity,
    state, setState,
    bio, setBio,
    cpf, setCpf,
    gender, setGender,
    preferences, togglePreference,
    photoURI, pickPhoto,
    loading, error, isEditing,
    save,
  } = useProfileSetup({ editMode });

  useEffect(() => {
    if (isEditing && !editMode) {
      console.log('Perfil ja existe, redirecionando...');
      setHasProfile(true);
      setTimeout(() => {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'MainTabs' }],
          })
        );
      }, 100);
    }
  }, [isEditing]);

  async function handleSave() {
    const success = await save();
    if (success) {
      if (editMode) {
        if (navigation.canGoBack()) navigation.goBack();
      } else {
        setSaved(true);
      }
    }
  }

  function handleContinue() {
    if (continuing) return;
    setContinuing(true);
    setHasProfile(true);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      })
    );
  }

  if (saved) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successStar}>*</Text>
        <Text style={styles.successTitle}>Perfil criado!</Text>
        <Text style={styles.successSubtitle}>
          Sua jornada comeca agora. Descubra conexoes unicas e encontre sua Sintonia perfeita.
        </Text>
        <Button
          label="Descobrir conexoes"
          onPress={handleContinue}
          loading={continuing}
          disabled={continuing}
          variant="primary"
          fullWidth
        />
        <Card padding={S.md} style={{ borderWidth: 1, borderColor: COLORS.gold + '44', gap: S.xs }}>
          <Text style={styles.successFeature}>10 Modelos IA esperando por voce</Text>
          <Text style={styles.successFeature}>Sistema de Sintonia exclusivo</Text>
          <Text style={styles.successFeature}>Chat em tempo real</Text>
          <Text style={styles.successFeature}>Perfis compativeis com voce</Text>
        </Card>
      </View>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.logo}>*</Text>
          <Text style={styles.title}>
            {isEditing ? 'Editar Perfil' : 'Seu Perfil'}
          </Text>
          <Text style={styles.subtitle}>
            Essas informacoes geram sua Sintonia
          </Text>
        </View>

        <TouchableOpacity style={styles.photoContainer} onPress={pickPhoto}>
          {photoURI ? (
            <Image source={{ uri: photoURI }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoIcon}>+</Text>
              <Text style={styles.photoText}>Adicionar foto</Text>
            </View>
          )}
        </TouchableOpacity>

        <Input label="Nome *" placeholder="Seu nome" value={name} onChangeText={setName} />
        <Input label="Idade *" placeholder="Sua idade" value={age} onChangeText={setAge} keyboardType="numeric" />
        <Input label="Cidade *" placeholder="Sua cidade" value={city} onChangeText={setCity} />
        <Input label="Estado *" placeholder="Ex: SP, RJ, MG" value={state} onChangeText={setState} autoCapitalize="characters" />
        <Input label="Bio" placeholder="Fale um pouco sobre voce..." value={bio} onChangeText={setBio} multiline maxLength={300} />
        <Input label="CPF (para compras)" placeholder="000.000.000-00" value={cpf} onChangeText={setCpf} keyboardType="numeric" />
        <Card padding={S.md} style={{ borderWidth: 1, borderColor: COLORS.gold + '33' }}>
          <Text style={styles.cpfInfoTitle}>Por que pedimos seu CPF?</Text>
          <Text style={styles.cpfInfoText}>
            O CPF é necessário apenas para processar pagamentos de compras no
            marketplace, conforme exigido pela regulamentação do Banco Central
            para transações via Pix.
          </Text>
          <Text style={styles.cpfInfoText}>
            É totalmente opcional — preencha somente se desejar comprar conteúdos.
            Você pode adicioná-lo depois, a qualquer momento, aqui no seu perfil.
          </Text>
          <Text style={styles.cpfPrivacyText}>
            🔒 Seu CPF é armazenado com segurança, nunca é exibido para outros
            usuários e jamais será compartilhado ou usado para qualquer
            finalidade sem a sua permissão.
          </Text>
        </Card>

        <Text style={styles.label}>Genero *</Text>
        <View style={styles.optionsRow}>
          {GENDER_OPTIONS.map(option => (
            <Button
              key={option.value}
              label={option.label}
              variant="ghost"
              onPress={() => setGender(option.value)}
              style={{
                ...(gender === option.value ? { borderColor: COLORS.gold, backgroundColor: COLORS.gold + '22' } : { borderColor: COLORS.border, backgroundColor: COLORS.card }),
              }}
              textStyle={{
                color: gender === option.value ? COLORS.gold : COLORS.textSecondary,
                fontWeight: gender === option.value ? FONT_WEIGHT.bold : 'normal',
              }}
            />
          ))}
        </View>

        <Text style={styles.label}>Tenho interesse em *</Text>
        <View style={styles.optionsRow}>
          {PREFERENCE_OPTIONS.map(option => (
            <Button
              key={option.value}
              label={option.label}
              variant="ghost"
              onPress={() => togglePreference(option.value)}
              style={{
                ...(preferences.includes(option.value) ? { borderColor: COLORS.gold, backgroundColor: COLORS.gold + '22' } : { borderColor: COLORS.border, backgroundColor: COLORS.card }),
              }}
              textStyle={{
                color: preferences.includes(option.value) ? COLORS.gold : COLORS.textSecondary,
                fontWeight: preferences.includes(option.value) ? FONT_WEIGHT.bold : 'normal',
              }}
            />
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={isEditing ? 'Salvar alteracoes' : 'Salvar e continuar'}
          onPress={handleSave}
          loading={loading}
          disabled={loading}
          variant="primary"
          fullWidth
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const S = SPACING;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg },
  successContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  successStar: { fontSize: 72, color: COLORS.gold },
  successTitle: {
    fontSize: FONT_SIZE.xxl,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 2,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: FONT_SIZE.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: SPACING.md,
  },
  successFeature: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.body,
    lineHeight: 22,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    marginTop: SPACING.lg,
  },
  logo: { fontSize: FONT_SIZE.display, color: COLORS.gold },
  title: {
    fontSize: FONT_SIZE.xxl,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 2,
    marginTop: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZE.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  photoContainer: { alignSelf: 'center', marginBottom: SPACING.xl },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoIcon: { fontSize: 32 },
  photoText: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.xs,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.caption,
    marginBottom: SPACING.xs,
    letterSpacing: 1,
  },
  cpfInfoTitle: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
  },
  cpfInfoText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    lineHeight: 18,
  },
  cpfPrivacyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    lineHeight: 18,
    marginTop: SPACING.xs,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  error: {
    color: COLORS.error,
    fontSize: FONT_SIZE.caption,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
});