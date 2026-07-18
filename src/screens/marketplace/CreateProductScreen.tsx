import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import {
  createProduct,
  uploadProductCover,
  uploadProductFile,
  updateProduct,
  submitProductForReview,
} from '../../services/marketplace/productService';
import { ProductCategory } from '../../shared/types/marketplace';
import ScreenContainer from '../../components/ScreenContainer';

const CATEGORIES: { label: string; value: ProductCategory }[] = [
  { label: 'Fotos', value: 'fotos' },
  { label: 'Vídeos', value: 'videos' },
  { label: 'Cursos', value: 'cursos' },
  { label: 'PDFs', value: 'pdfs' },
  { label: 'Outros', value: 'outros' },
];

const TOTAL_STEPS = 5;

// Limites por tipo de arquivo
const SIZE_LIMITS: Record<string, number> = {
  'image': 20 * 1024 * 1024,   // 20MB
  'video': 500 * 1024 * 1024,  // 500MB
  'application/pdf': 100 * 1024 * 1024, // 100MB
};

function getMaxSize(mimeType: string): number {
  if (mimeType.startsWith('image/')) return SIZE_LIMITS['image'];
  if (mimeType.startsWith('video/')) return SIZE_LIMITS['video'];
  if (mimeType === 'application/pdf') return SIZE_LIMITS['application/pdf'];
  return 500 * 1024 * 1024;
}

function getProductFileType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'imagem';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'outro';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('zip')) return '📦';
  return '📁';
}

interface SelectedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

export default function CreateProductScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('');

  // Campos do produto
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProductCategory>('fotos');
  const [price, setPrice] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [tags, setTags] = useState('');

  // Arquivos pagos
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);

  function goNext() { setStep(s => Math.min(s + 1, TOTAL_STEPS)); }
  function goBack() {
    if (step === 1) navigation.goBack();
    else setStep(s => s - 1);
  }

  // ============================================
  // Pick cover image
  // ============================================
  async function handlePickCover() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  }

  // ============================================
  // Pick paid file (DocumentPicker)
  // ============================================
  async function handlePickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? 'application/octet-stream';
      const size = asset.size ?? 0;
      const maxSize = getMaxSize(mimeType);

      // Validar MIME — rejeitar executáveis
      const blocked = ['application/x-msdownload', 'application/x-executable', 'text/x-shellscript'];
      if (blocked.includes(mimeType)) {
        Alert.alert('Arquivo não permitido', 'Este tipo de arquivo não é aceito.');
        return;
      }

      // Validar tamanho
      if (size > maxSize) {
        Alert.alert(
          'Arquivo muito grande',
          `Limite para este tipo: ${formatBytes(maxSize)}.\nSeu arquivo: ${formatBytes(size)}.`
        );
        return;
      }

      // Evitar duplicata pelo nome
      if (selectedFiles.some(f => f.name === asset.name)) {
        Alert.alert('Arquivo já adicionado', `"${asset.name}" já está na lista.`);
        return;
      }

      setSelectedFiles(prev => [...prev, {
        uri: asset.uri,
        name: asset.name,
        mimeType,
        size,
      }]);
    } catch {
      Alert.alert('Erro', 'Não foi possível selecionar o arquivo.');
    }
  }

  function handleRemoveFile(index: number) {
    Alert.alert(
      'Remover arquivo?',
      `"${selectedFiles[index].name}" será removido.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover', style: 'destructive',
          onPress: () => setSelectedFiles(prev => prev.filter((_, i) => i !== index)),
        },
      ]
    );
  }

  // ============================================
  // Save draft + upload all
  // ============================================
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

      // 1. Criar produto
      setUploadLabel('Criando produto...');
      const id = await createProduct(user.uid, {
        title: title.trim(),
        description: description.trim(),
        price: parsedPrice,
        category,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      setProductId(id);

      // 2. Upload capa
      if (coverUri) {
        setUploadLabel('Enviando capa...');
        const coverHandle = await uploadProductCover(id, coverUri, p => {
          setUploadProgress(p.percentage);
        });
        const coverResult = await coverHandle.promise;
        if (coverResult.downloadURL) {
          await updateProduct(id, user.uid, { coverImage: coverResult.downloadURL });
        }
      }

      // 3. Upload arquivos pagos
      if (selectedFiles.length > 0) {
        const uploadedFiles: Array<{
          storagePath: string;
          type: any;
          name: string;
          size: number;
          mimeType: string;
        }> = [];

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          setUploadLabel(`Enviando arquivo ${i + 1}/${selectedFiles.length}: ${file.name}`);
          setUploadProgress(0);

          const handle = await uploadProductFile(id, file.uri, file.name, p => {
            setUploadProgress(p.percentage);
          });
          const result = await handle.promise;

          uploadedFiles.push({
            storagePath: result.storagePath,
            type: getProductFileType(file.mimeType) as any,
            name: file.name,
            size: file.size,
            mimeType: file.mimeType,
          });
        }

        await updateProduct(id, user.uid, { files: uploadedFiles });
      }

      Alert.alert('✅ Rascunho salvo!', 'Revise os dados e envie para aprovação.');
      goNext();
    } catch (error: any) {
      Alert.alert('Erro', error.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
      setUploadProgress(0);
      setUploadLabel('');
    }
  }

  // ============================================
  // Submit for review
  // ============================================
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
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo Produto</Text>
        <Text style={styles.stepLabel}>{step}/{TOTAL_STEPS}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` as any }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* ETAPA 1 — Informações */}
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

        {/* ETAPA 2 — Arquivos pagos */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>Arquivos do produto</Text>
            <Text style={styles.stepSubtitle}>
              Estes arquivos serão liberados após a compra.
            </Text>

            {/* Lista de arquivos selecionados */}
            {selectedFiles.length > 0 ? (
              <View style={styles.fileList}>
                {selectedFiles.map((file, index) => (
                  <View key={index} style={styles.fileItem}>
                    <Text style={styles.fileIcon}>{getFileIcon(file.mimeType)}</Text>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                      <Text style={styles.fileMeta}>{formatBytes(file.size)}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.fileRemove}
                      onPress={() => handleRemoveFile(index)}
                    >
                      <Text style={styles.fileRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Botão adicionar arquivo */}
            <TouchableOpacity style={styles.uploadArea} onPress={handlePickFile}>
              <Text style={styles.uploadIcon}>📎</Text>
              <Text style={styles.uploadText}>
                {selectedFiles.length > 0 ? 'Adicionar outro arquivo' : 'Selecionar arquivo'}
              </Text>
              <Text style={styles.uploadSubtext}>
                PDF, imagens, vídeos, ZIP{'\n'}
                Imagens: máx 20MB · PDF: 100MB · Vídeo: 500MB
              </Text>
            </TouchableOpacity>

            {selectedFiles.length === 0 && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ Pelo menos 1 arquivo é obrigatório para enviar para revisão.
                </Text>
              </View>
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

        {/* ETAPA 3 — Capa */}
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
                  <Text style={styles.uploadSubtext}>Recomendado: 1200x900px · máx 20MB</Text>
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
              <Text style={styles.reviewRow}>🖼️ Capa: <Text style={styles.reviewValue}>{coverUri ? 'Selecionada' : '⚠️ Não selecionada'}</Text></Text>
              <Text style={styles.reviewRow}>📦 Arquivos: <Text style={styles.reviewValue}>{selectedFiles.length} arquivo(s)</Text></Text>
            </View>

            {/* Upload progress */}
            {saving && uploadProgress > 0 && (
              <View>
                <Text style={styles.uploadLabel}>{uploadLabel}</Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressBarFill, { width: `${uploadProgress}%` as any }]} />
                </View>
                <Text style={styles.progressText}>{uploadProgress}%</Text>
              </View>
            )}

            {saving && uploadProgress === 0 && uploadLabel !== '' && (
              <View style={styles.savingRow}>
                <ActivityIndicator color={colors.gold} size="small" />
                <Text style={styles.savingText}>{uploadLabel}</Text>
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
                  {productId ? '🚀 Enviar para revisão' : '💾 Salvar e continuar'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.prevBtn} onPress={goBack}>
              <Text style={styles.prevBtnText}>← Anterior</Text>
            </TouchableOpacity>
          </View>
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
  // File list
  fileList: {
    borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, marginBottom: spacing.md, overflow: 'hidden',
  },
  fileItem: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.grayDark, gap: spacing.sm,
  },
  fileIcon: { fontSize: 24 },
  fileInfo: { flex: 1 },
  fileName: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  fileMeta: { color: colors.gray, fontSize: fonts.sizes.xs },
  fileRemove: { padding: spacing.xs },
  fileRemoveText: { color: colors.error, fontSize: fonts.sizes.md },
  // Upload area
  uploadArea: {
    borderWidth: 2, borderColor: colors.grayDark, borderStyle: 'dashed',
    borderRadius: borderRadius.md, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.md,
  },
  uploadIcon: { fontSize: 40, marginBottom: spacing.sm },
  uploadText: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', marginBottom: spacing.xs },
  uploadSubtext: { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center', lineHeight: 20 },
  warningBox: {
    backgroundColor: colors.gold + '11', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gold + '44',
    padding: spacing.md, marginBottom: spacing.md,
  },
  warningText: { color: colors.gold, fontSize: fonts.sizes.sm },
  // Cover
  coverPicker: {
    borderWidth: 2, borderColor: colors.grayDark, borderStyle: 'dashed',
    borderRadius: borderRadius.md, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.md,
  },
  coverPickerSuccess: { color: colors.success ?? '#4CAF50', fontSize: fonts.sizes.md, fontWeight: 'bold' },
  // Price
  freeToggle: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md,
  },
  freeToggleActive: { borderColor: colors.gold, backgroundColor: colors.gold + '11' },
  freeToggleText: { color: colors.white, fontSize: fonts.sizes.md },
  // Navigation
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
  // Review
  reviewCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md,
  },
  reviewRow: { color: colors.gray, fontSize: fonts.sizes.md },
  reviewValue: { color: colors.white, fontWeight: 'bold' },
  // Upload progress
  uploadLabel: { color: colors.gold, fontSize: fonts.sizes.sm, marginBottom: spacing.xs },
  progressBar: {
    height: 6, backgroundColor: colors.surface, borderRadius: borderRadius.full,
    marginBottom: spacing.xs, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: colors.gold },
  progressText: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'right', marginBottom: spacing.md },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  savingText: { color: colors.gray, fontSize: fonts.sizes.sm },
  saveBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
});