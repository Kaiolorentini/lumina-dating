import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Button, Card, Input } from '../../components/ui';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS , alpha} from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import {
  createProduct, uploadProductCover, uploadProductFile,
  updateProduct, submitProductForReview,
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
const SIZE_LIMITS: Record<string, number> = {
  'image': 20 * 1024 * 1024,
  'video': 500 * 1024 * 1024,
  'application/pdf': 100 * 1024 * 1024,
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
  uri: string; name: string; mimeType: string; size: number;
}

export default function CreateProductScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProductCategory>('fotos');
  const [price, setPrice] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [tags, setTags] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);

  function goNext() { setStep(s => Math.min(s + 1, TOTAL_STEPS)); }
  function goBack() { if (step === 1) navigation.goBack(); else setStep(s => s - 1); }

  async function handlePickCover() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  }

  async function handlePickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? 'application/octet-stream';
      const size = asset.size ?? 0;
      const maxSize = getMaxSize(mimeType);
      const blocked = ['application/x-msdownload', 'application/x-executable', 'text/x-shellscript'];
      if (blocked.includes(mimeType)) { Alert.alert('Arquivo não permitido', 'Este tipo de arquivo não é aceito.'); return; }
      if (size > maxSize) { Alert.alert('Arquivo muito grande', `Limite para este tipo: ${formatBytes(maxSize)}.\nSeu arquivo: ${formatBytes(size)}.`); return; }
      if (selectedFiles.some(f => f.name === asset.name)) { Alert.alert('Arquivo já adicionado', `"${asset.name}" já está na lista.`); return; }
      setSelectedFiles(prev => [...prev, { uri: asset.uri, name: asset.name, mimeType, size }]);
    } catch { Alert.alert('Erro', 'Não foi possível selecionar o arquivo.'); }
  }

  function handleRemoveFile(index: number) {
    Alert.alert('Remover arquivo?', `"${selectedFiles[index].name}" será removido.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => setSelectedFiles(prev => prev.filter((_, i) => i !== index)) },
    ]);
  }

  async function handleSaveDraft() {
    if (!user || !title.trim()) { Alert.alert('Erro', 'Informe pelo menos o título.'); return; }
    setSaving(true);
    try {
      const parsedPrice = isFree ? 0 : parseFloat(price.replace(',', '.'));
      if (!isFree && (isNaN(parsedPrice) || parsedPrice <= 0)) { Alert.alert('Erro', 'Informe um preço válido.'); return; }
      setUploadLabel('Criando produto...');
      const id = await createProduct(user.uid, { title: title.trim(), description: description.trim(), price: parsedPrice, category, tags: tags.split(',').map(t => t.trim()).filter(Boolean) });
      setProductId(id);
      if (coverUri) {
        setUploadLabel('Enviando capa...');
        const coverHandle = await uploadProductCover(id, coverUri, p => setUploadProgress(p.percentage));
        const coverResult = await coverHandle.promise;
        if (coverResult.downloadURL) await updateProduct(id, user.uid, { coverImage: coverResult.downloadURL });
      }
      if (selectedFiles.length > 0) {
        const uploadedFiles: Array<{ storagePath: string; type: any; name: string; size: number; mimeType: string }> = [];
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          setUploadLabel(`Enviando arquivo ${i + 1}/${selectedFiles.length}: ${file.name}`);
          setUploadProgress(0);
          const handle = await uploadProductFile(id, file.uri, file.name, p => setUploadProgress(p.percentage));
          const result = await handle.promise;
          uploadedFiles.push({ storagePath: result.storagePath, type: getProductFileType(file.mimeType) as any, name: file.name, size: file.size, mimeType: file.mimeType });
        }
        await updateProduct(id, user.uid, { files: uploadedFiles });
      }
      Alert.alert('✅ Rascunho salvo!', 'Revise os dados e envie para aprovação.');
      goNext();
    } catch (error: any) { Alert.alert('Erro', error.message ?? 'Não foi possível salvar.'); } finally { setSaving(false); setUploadProgress(0); setUploadLabel(''); }
  }

  async function handleSubmit() {
    if (!productId || !user) return;
    setSaving(true);
    try {
      await submitProductForReview(productId, user.uid);
      Alert.alert('✅ Enviado para revisão!', 'Nossa equipe analisará seu produto em breve.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error: any) { Alert.alert('Erro', error.message ?? 'Não foi possível enviar para revisão.'); } finally { setSaving(false); }
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Button label="‹" variant="ghost" onPress={goBack} />
        <Text style={styles.headerTitle}>Novo Produto</Text>
        <Text style={styles.stepLabel}>{step}/{TOTAL_STEPS}</Text>
      </View>
      <View style={styles.progress}><View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` as any }]} /></View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>Informações básicas</Text>
            <Input label="Título *" value={title} onChangeText={setTitle} placeholder="Nome do seu produto" maxLength={100} />
            <Input label="Descrição" value={description} onChangeText={setDescription} placeholder="Descreva o que está vendendo..." multiline maxLength={1000} />
            <Text style={styles.label}>Categoria</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map(cat => (
                <Button
                  key={cat.value}
                  label={cat.label}
                  variant="ghost"
                  onPress={() => setCategory(cat.value)}
                  style={{
                    flex: 1, borderWidth: 1, alignItems: 'center',
                    borderColor: category === cat.value ? COLORS.gold : COLORS.border,
                    backgroundColor: category === cat.value ? alpha(COLORS.gold, 0.13) : COLORS.card,
                  }}
                  textStyle={{
                    color: category === cat.value ? COLORS.gold : COLORS.textSecondary,
                  }}
                />
              ))}
            </View>
            <Input label="Tags (separadas por vírgula)" value={tags} onChangeText={setTags} placeholder="ex: fotografia, natureza, arte" />
            <Button label="Próximo →" onPress={goNext} variant="primary" fullWidth />
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>Arquivos do produto</Text>
            <Text style={styles.stepSubtitle}>Estes arquivos serão liberados após a compra.</Text>
            {selectedFiles.length > 0 && (
              <View style={styles.fileList}>
                {selectedFiles.map((file, index) => (
                  <Card key={index} padding={SPACING.sm} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                    <Text style={styles.fileIcon}>{getFileIcon(file.mimeType)}</Text>
                    <View style={styles.fileInfo}><Text style={styles.fileName} numberOfLines={1}>{file.name}</Text><Text style={styles.fileMeta}>{formatBytes(file.size)}</Text></View>
                    <Button label="✕" variant="ghost" onPress={() => handleRemoveFile(index)} />
                  </Card>
                ))}
              </View>
            )}
            <Card padding={SPACING.lg} style={{ alignItems: 'center' }} onPress={handlePickFile}>
              <Text style={styles.uploadIcon}>📎</Text>
              <Text style={styles.uploadText}>{selectedFiles.length > 0 ? 'Adicionar outro arquivo' : 'Selecionar arquivo'}</Text>
              <Text style={styles.uploadSubtext}>PDF, imagens, vídeos, ZIP{'\n'}Imagens: máx 20MB · PDF: 100MB · Vídeo: 500MB</Text>
            </Card>
            {selectedFiles.length === 0 && (
              <Card padding={SPACING.md} style={{ borderWidth: 1, borderColor: alpha(COLORS.error, 0.27) }}>
                <Text style={styles.warningText}>⚠️ Pelo menos 1 arquivo é obrigatório para enviar para revisão.</Text>
              </Card>
            )}
            <View style={styles.navRow}>
              <Button label="← Anterior" onPress={goBack} variant="ghost" />
              <Button label="Próximo →" onPress={goNext} variant="primary" />
            </View>
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>Capa e prévias</Text>
            <Text style={styles.stepSubtitle}>A capa aparece no feed do marketplace.</Text>
            <Card padding={SPACING.lg} style={{ alignItems: 'center' }} onPress={handlePickCover}>
              {coverUri ? <Text style={{ color: COLORS.success, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold }}>✅ Capa selecionada</Text> : <><Text style={styles.uploadIcon}>🖼️</Text><Text style={styles.uploadText}>Selecionar capa</Text><Text style={styles.uploadSubtext}>Recomendado: 1200x900px · máx 20MB</Text></>}
            </Card>
            <View style={styles.navRow}>
              <Button label="← Anterior" onPress={goBack} variant="ghost" />
              <Button label="Próximo →" onPress={goNext} variant="primary" />
            </View>
          </View>
        )}

        {step === 4 && (
          <View>
            <Text style={styles.stepTitle}>Preço</Text>
            <Button label={isFree ? '✅ Produto gratuito' : '⬜ Produto gratuito'} onPress={() => setIsFree(!isFree)} variant="ghost" fullWidth />
            {!isFree && (
              <Input label="Preço (R$)" value={price} onChangeText={setPrice} placeholder="Ex: 29,90" keyboardType="decimal-pad" />
            )}
            <View style={styles.navRow}>
              <Button label="← Anterior" onPress={goBack} variant="ghost" />
              <Button label="Próximo →" onPress={goNext} variant="primary" />
            </View>
          </View>
        )}

        {step === 5 && (
          <View>
            <Text style={styles.stepTitle}>Revisão final</Text>
            <Card padding={SPACING.md}>
              <Text style={styles.reviewRow}>📝 Título: <Text style={styles.reviewValue}>{title || '—'}</Text></Text>
              <Text style={styles.reviewRow}>📁 Categoria: <Text style={styles.reviewValue}>{category}</Text></Text>
              <Text style={styles.reviewRow}>💰 Preço: <Text style={styles.reviewValue}>{isFree ? 'Grátis' : `R$ ${price}`}</Text></Text>
              <Text style={styles.reviewRow}>🖼️ Capa: <Text style={styles.reviewValue}>{coverUri ? 'Selecionada' : '⚠️ Não selecionada'}</Text></Text>
              <Text style={styles.reviewRow}>📦 Arquivos: <Text style={styles.reviewValue}>{selectedFiles.length} arquivo(s)</Text></Text>
            </Card>
            {saving && uploadProgress > 0 && (
              <View><Text style={styles.uploadLabel}>{uploadLabel}</Text><View style={styles.progressBar}><View style={[styles.progressBarFill, { width: `${uploadProgress}%` as any }]} /></View><Text style={styles.progressText}>{uploadProgress}%</Text></View>
            )}
            {saving && uploadProgress === 0 && uploadLabel !== '' && (
              <View style={styles.savingRow}><ActivityIndicator color={COLORS.gold} size="small" /><Text style={styles.savingText}>{uploadLabel}</Text></View>
            )}
            <Button label={productId ? '🚀 Enviar para revisão' : '💾 Salvar e continuar'} onPress={productId ? handleSubmit : handleSaveDraft} loading={saving} disabled={saving} variant="primary" fullWidth />
            <Button label="← Anterior" onPress={goBack} variant="ghost" fullWidth />
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: alpha(COLORS.gold, 0.27) },
  // backBtn removed — now uses Button
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  stepLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  progress: { height: 3, backgroundColor: COLORS.border },
  progressFill: { height: 3, backgroundColor: COLORS.gold },
  content: { padding: SPACING.md },
  stepTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.sm },
  stepSubtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body, marginBottom: SPACING.md },
  // input/inputMultiline/label removed — now uses Input
  label: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, marginBottom: SPACING.xs, marginTop: SPACING.md },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  // catChip/catChipActive/catChipText/catChipTextActive removed — now uses Button
  fileList: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md, overflow: 'hidden' },
  // fileItem removed — now uses Card
  fileIcon: { fontSize: 24 },
  fileInfo: { flex: 1 },
  fileName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  fileMeta: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  // fileRemove/fileRemoveText removed — now uses Button
  // uploadArea removed — now uses Card
  uploadIcon: { fontSize: 40, marginBottom: SPACING.sm },
  uploadText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs },
  uploadSubtext: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, textAlign: 'center', lineHeight: 20 },
  warningText: { color: COLORS.gold, fontSize: FONT_SIZE.caption },
  // coverPicker/coverPickerSuccess removed — now uses Card
  // freeToggle/freeToggleActive/freeToggleText removed — now uses Button
  navRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  // nextBtn/nextBtnText removed — now uses Button
  // prevBtn/prevBtnText removed — now uses Button
  // reviewCard removed — now uses Card
  reviewRow: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body },
  reviewValue: { color: COLORS.textPrimary, fontWeight: FONT_WEIGHT.bold },
  uploadLabel: { color: COLORS.gold, fontSize: FONT_SIZE.caption, marginBottom: SPACING.xs },
  progressBar: { height: 6, backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.full, marginBottom: SPACING.xs, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: COLORS.gold },
  progressText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, textAlign: 'right', marginBottom: SPACING.md },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  savingText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  // saveBtn/saveBtnDisabled/saveBtnText removed — now uses Button
});
