import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import {
  createProduct,
  uploadProductCover,
  submitProductForReview,
} from '../../services/marketplace/productService';
import { ProductCategory } from '../../shared/types/marketplace';

const CATEGORIES: { label: string; value: ProductCategory }[] = [
  { label: 'Fotos', value: 'fotos' },
  { label: 'Vídeos', value: 'videos' },
  { label: 'Cursos', value: 'cursos' },
  { label: 'PDFs', value: 'pdfs' },
  { label: 'Outros', value: 'outros' },
];

const TOTAL_STEPS = 5;

export default function CreateProductScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Campos
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProductCategory>('fotos');
  const [price, setPrice] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [tags, setTags] = useState('');

  function goNext() { setStep(s => Math.min(s + 1, TOTAL_STEPS)); }
  function goBack() {
    if (step === 1) navigation.goBack();
    else setStep(s => s - 1);
  }

  async function handlePickCover() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  }

  async function handleSaveDraft() {
    if (!user || !title.trim()) {
      Alert.alert('Erro', 'Informe pelo menos o título.');
      return;
    }
    setSaving(true);
    try {
      const parsedPrice = isFree ? 0 : parseFloat(price.replace(',', '.'));
      if (!isFree && (isNaN(parsedPrice) || parsedPrice <= 0)) {
        Alert.alert('Erro', 'Informe um preço válido.');
        return;
      }

      const id = await createProduct(user.uid, {
        title: title.trim(),
        description: description.trim(),
        price: parsedPrice,
        category,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      });

      setProductId(id);

      if (coverUri) {
        const handle = await uploadProductCover(id, coverUri, p => {
          setUploadProgress(p.percentage);
        });
        await handle.promise;
      }

      Alert.alert('✅ Rascunho salvo!', 'Continue adicionando arquivos.');
      goNext();
    } catch (error: any) {
      Alert.alert('Erro', error.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  }

  async function handleSubmit() {
    if (!productId || !user) return;
    setSaving(true);
    try {
      await submitProductForReview(productId, user.uid);
      Alert.alert(
        '✅ Enviado para revisão!',
        'Nossa equipe analisará seu produto em breve.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (error: any) {
      Alert.alert('Erro', error.message ?? 'Não foi possível enviar para revisão.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo Produto</Text>
        <Text style={styles.stepLabel}>{step}/{TOTAL_STEPS}</Text>
      </View>

      {/* Indicador */}
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ETAPA 1 — Informações básicas */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>Informações básicas</Text>

            <Text style={styles.label}>Título *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Nome do seu produto"
              placeholderTextColor={colors.gray}
              maxLength={100}
            />

            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Descreva o que está vendendo..."
              placeholderTextColor={colors.gray}
              multiline
              maxLength={1000}
            />

            <Text style={styles.label}>Categoria</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.catChip, category === cat.value && styles.catChipActive]}
                  onPress={() => setCategory(cat.value)}
                >
                  <Text style={[styles.catChipText, category === cat.value && styles.catChipTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Tags (separadas por vírgula)</Text>
            <TextInput
              style={styles.input}
              value={tags}
              onChangeText={setTags}
              placeholder="ex: fotografia, natureza, arte"
              placeholderTextColor={colors.gray}
            />

            <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
              <Text style={styles.nextBtnText}>Próximo →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ETAPA 2 — Arquivos */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>Arquivos do produto</Text>
            <Text style={styles.stepSubtitle}>
              Adicione os arquivos que o comprador receberá após a compra.
            </Text>

            <View style={styles.uploadPlaceholder}>
              <Text style={styles.uploadIcon}>📎</Text>
              <Text style={styles.uploadText}>Upload de arquivos</Text>
              <Text style={styles.uploadSubtext}>
                PDF, imagens, vídeos, ZIP{'\n'}Máximo 500MB por arquivo
              </Text>
              {/* ⚠️ API_TODO #15: implementar uploadProductFile() aqui */}
              <Text style={styles.todoText}>
                🔧 Upload de arquivos pagos disponível em breve
              </Text>
            </View>

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.prevBtn} onPress={goBack}>
                <Text style={styles.prevBtnText}>← Anterior</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
                <Text style={styles.nextBtnText}>Próximo →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ETAPA 3 — Capa e prévias */}
        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>Capa e prévias</Text>
            <Text style={styles.stepSubtitle}>
              A capa aparece no feed do marketplace.
            </Text>

            <TouchableOpacity style={styles.coverPicker} onPress={handlePickCover}>
              {coverUri ? (
                <Text style={styles.coverPickerSuccess}>✅ Capa selecionada</Text>
              ) : (
                <>
                  <Text style={styles.uploadIcon}>🖼️</Text>
                  <Text style={styles.uploadText}>Selecionar capa</Text>
                  <Text style={styles.uploadSubtext}>Recomendado: 1200x900px</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.prevBtn} onPress={goBack}>
                <Text style={styles.prevBtnText}>← Anterior</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
                <Text style={styles.nextBtnText}>Próximo →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ETAPA 4 — Preço */}
        {step === 4 && (
          <View>
            <Text style={styles.stepTitle}>Preço</Text>

            <TouchableOpacity
              style={[styles.freeToggle, isFree && styles.freeToggleActive]}
              onPress={() => setIsFree(!isFree)}
            >
              <Text style={styles.freeToggleText}>
                {isFree ? '✅ Produto gratuito' : '⬜ Produto gratuito'}
              </Text>
            </TouchableOpacity>

            {!isFree && (
              <>
                <Text style={styles.label}>Preço (R$)</Text>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="Ex: 29,90"
                  placeholderTextColor={colors.gray}
                  keyboardType="decimal-pad"
                />
              </>
            )}

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.prevBtn} onPress={goBack}>
                <Text style={styles.prevBtnText}>← Anterior</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
                <Text style={styles.nextBtnText}>Próximo →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ETAPA 5 — Revisão */}
        {step === 5 && (
          <View>
            <Text style={styles.stepTitle}>Revisão final</Text>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewRow}>📝 Título: <Text style={styles.reviewValue}>{title || '—'}</Text></Text>
              <Text style={styles.reviewRow}>📁 Categoria: <Text style={styles.reviewValue}>{category}</Text></Text>
              <Text style={styles.reviewRow}>💰 Preço: <Text style={styles.reviewValue}>{isFree ? 'Grátis' : `R$ ${price}`}</Text></Text>
              <Text style={styles.reviewRow}>🖼️ Capa: <Text style={styles.reviewValue}>{coverUri ? 'Selecionada' : 'Não selecionada'}</Text></Text>
            </View>

            {uploadProgress > 0 && (
              <View style={styles.progressBar}>
                <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
                <Text style={styles.progressText}>{uploadProgress}%</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={productId ? handleSubmit : handleSaveDraft}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.saveBtnText}>
                  {productId ? '🚀 Enviar para revisão' : '💾 Salvar e enviar'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.prevBtn} onPress={goBack}>
              <Text style={styles.prevBtnText}>← Anterior</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  stepLabel: { color: colors.gray, fontSize: fonts.sizes.sm },
  progress: { height: 3, backgroundColor: colors.grayDark },
  progressFill: { height: 3, backgroundColor: colors.gold },
  content: { padding: spacing.md },
  stepTitle: { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold', marginBottom: spacing.sm },
  stepSubtitle: { color: colors.gray, fontSize: fonts.sizes.md, marginBottom: spacing.md },
  label: { color: colors.gray, fontSize: fonts.sizes.sm, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark, color: colors.white,
    padding: spacing.md, fontSize: fonts.sizes.md,
  },
  inputMultiline: { height: 100, textAlignVertical: 'top' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  catChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.grayDark,
  },
  catChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  catChipText: { color: colors.gray, fontSize: fonts.sizes.sm },
  catChipTextActive: { color: colors.background, fontWeight: 'bold' },
  uploadPlaceholder: {
    borderWidth: 2, borderColor: colors.grayDark, borderStyle: 'dashed',
    borderRadius: borderRadius.md, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.md,
  },
  uploadIcon: { fontSize: 48, marginBottom: spacing.sm },
  uploadText: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', marginBottom: spacing.xs },
  uploadSubtext: { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center' },
  todoText: { color: colors.gold, fontSize: fonts.sizes.sm, marginTop: spacing.md, textAlign: 'center' },
  coverPicker: {
    borderWidth: 2, borderColor: colors.grayDark, borderStyle: 'dashed',
    borderRadius: borderRadius.md, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.md,
  },
  coverPickerSuccess: { color: colors.success, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  freeToggle: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md,
  },
  freeToggleActive: { borderColor: colors.gold, backgroundColor: colors.gold + '11' },
  freeToggleText: { color: colors.white, fontSize: fonts.sizes.md },
  navRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  nextBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    padding: spacing.md, flex: 1, alignItems: 'center', marginTop: spacing.md,
  },
  nextBtnText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
  prevBtn: {
    backgroundColor: 'transparent', borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, flex: 1, alignItems: 'center', marginTop: spacing.md,
  },
  prevBtnText: { color: colors.gray, fontSize: fonts.sizes.md },
  reviewCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md,
  },
  reviewRow: { color: colors.gray, fontSize: fonts.sizes.md },
  reviewValue: { color: colors.white, fontWeight: 'bold' },
  progressBar: {
    height: 20, backgroundColor: colors.surface, borderRadius: borderRadius.full,
    marginBottom: spacing.md, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: colors.gold },
  progressText: { position: 'absolute', right: spacing.sm, color: colors.white, fontSize: fonts.sizes.xs },
  saveBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
});