// ============================================
// LUMINA — EDITAR PRODUTO v1
// src/screens/marketplace/EditProductScreen.tsx
//
// Era uma tela provisória ("Em implementação final").
//
// O criador muda a DESCRIÇÃO, a CAPA e os ARQUIVOS. Título e preço
// ficam fixos.
// - Produto à venda: descrição e remoções valem na hora; capa e
//   arquivos novos passam pela moderação, e o produto continua à
//   venda com a versão aprovada. Arquivo removido continua
//   disponível para quem já comprou.
// - Rascunho ou rejeitado: tudo vale na hora, e o botão "Enviar para
//   análise" manda o produto inteiro para revisão.
// - Em análise: só leitura.
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Image,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import {
  getProduct, uploadProductCover, uploadProductFile,
  submitProductChanges, submitProductForReview, ProductWithChanges,
} from '../../services/marketplace/productService';
import { formatBytes, getFileIcon, validateProductFile } from '../../utils/productFileRules';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'EditProduct'>;

const MAX_DESCRIPTION = 1000;

interface NewFile { uri: string; name: string; mimeType: string; size: number }

export default function EditProductScreen() {
  const navigation = useNavigation<NavProp>();
  const { productId } = useRoute<RouteProps>().params;
  const { user } = useAuth();

  const [product, setProduct]   = useState<ProductWithChanges | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [newCoverUri, setNewCoverUri] = useState<string | null>(null);
  const [removed, setRemoved]         = useState<Set<string>>(new Set());
  const [newFiles, setNewFiles]       = useState<NewFile[]>([]);

  const [saving, setSaving]         = useState(false);
  const [progressLabel, setLabel]   = useState('');
  const [progress, setProgress]     = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const p = await getProduct(productId);
      if (!p || p.ownerId !== user.uid) {
        setError('Produto não encontrado.');
        return;
      }
      setProduct(p);
      setDescription(p.description ?? '');
      setNewCoverUri(null);
      setRemoved(new Set());
      setNewFiles([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o produto.');
    } finally {
      setLoading(false);
    }
  }, [productId, user]);

  useEffect(() => { load(); }, [load]);

  const status   = product?.status;
  const live     = status === 'approved';
  const locked   = status === 'pending';
  const files    = product?.files ?? [];

  const isActive = (f: { status?: string; removedAt?: unknown; storagePath: string }) =>
    f.status !== 'pending' && !f.removedAt && !removed.has(f.storagePath);
  const activeCount = files.filter(isActive).length;

  const descChanged = description.trim() !== (product?.description ?? '').trim();
  const hasChanges  = descChanged || !!newCoverUri || removed.size > 0 || newFiles.length > 0;

  async function pickCover() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8,
    });
    if (!result.canceled) setNewCoverUri(result.assets[0].uri);
  }

  async function addFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? 'application/octet-stream';
      const size = asset.size ?? 0;
      const names = [...files.map(f => f.name), ...newFiles.map(f => f.name)];
      const problem = validateProductFile(mimeType, size, asset.name, names);
      if (problem) {
        Alert.alert('Arquivo não adicionado', problem);
        return;
      }
      setNewFiles(prev => [...prev, { uri: asset.uri, name: asset.name, mimeType, size }]);
    } catch {
      Alert.alert('Erro', 'Não foi possível selecionar o arquivo.');
    }
  }

  function toggleRemove(path: string, active: boolean) {
    setRemoved(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
        return next;
      }
      // À venda precisa sobrar pelo menos um arquivo aprovado.
      if (live && active && activeCount <= 1) {
        Alert.alert('Mantenha um arquivo', 'O produto precisa manter pelo menos um arquivo aprovado à venda.');
        return prev;
      }
      next.add(path);
      return next;
    });
  }

  async function save() {
    if (!product || !hasChanges) return;
    setSaving(true);
    try {
      let newCoverPath: string | undefined;
      if (newCoverUri) {
        setLabel('Enviando capa…');
        setProgress(0);
        const handle = await uploadProductCover(productId, newCoverUri, p => setProgress(p.percentage));
        newCoverPath = (await handle.promise).storagePath;
      }

      const addFiles: Array<{ storagePath: string; name: string }> = [];
      for (let i = 0; i < newFiles.length; i++) {
        const f = newFiles[i];
        setLabel(`Enviando arquivo ${i + 1}/${newFiles.length}: ${f.name}`);
        setProgress(0);
        const handle = await uploadProductFile(productId, f.uri, f.name, p => setProgress(p.percentage));
        addFiles.push({ storagePath: (await handle.promise).storagePath, name: f.name });
      }

      setLabel('Salvando…');
      const res = await submitProductChanges({
        productId,
        description:  descChanged ? description.trim() : undefined,
        addFiles:     addFiles.length ? addFiles : undefined,
        removeFiles:  removed.size ? Array.from(removed) : undefined,
        newCoverPath,
      });

      Alert.alert(
        res.pendingReview && (newCoverPath || addFiles.length) ? '✅ Enviado para análise' : '✅ Alterações salvas',
        res.pendingReview && (newCoverPath || addFiles.length)
          ? 'A capa e os arquivos novos aparecem depois da aprovação. Seu produto continua à venda.'
          : undefined,
      );
      await load();
    } catch (e: unknown) {
      Alert.alert('Não foi possível salvar', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setSaving(false);
      setLabel('');
      setProgress(0);
    }
  }

  async function sendToReview() {
    if (!product || !user) return;
    if (hasChanges) {
      Alert.alert('Salve primeiro', 'Salve as alterações antes de enviar para análise.');
      return;
    }
    setSaving(true);
    try {
      await submitProductForReview(productId, user.uid);
      Alert.alert('✅ Enviado para análise', 'Nossa equipe vai analisar seu produto.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível enviar.');
    } finally {
      setSaving(false);
    }
  }

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
        <Text style={styles.backBtn}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Editar produto</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (loading) {
    return <ScreenContainer>{header}<ActivityIndicator color={colors.gold} style={{ flex: 1 }} /></ScreenContainer>;
  }

  if (error || !product) {
    return (
      <ScreenContainer>
        {header}
        <View style={styles.center}>
          <Text style={styles.bigIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error ?? 'Produto não encontrado.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {header}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{product.title}</Text>
        <Text style={styles.fixedHint}>
          {product.isFree ? 'Grátis' : `R$ ${product.price.toFixed(2).replace('.', ',')}`} · título e preço não podem ser alterados
        </Text>

        {locked && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>⏳ Em análise. Você poderá editar assim que o produto for aprovado ou rejeitado.</Text>
          </View>
        )}

        {live && product.hasPendingChanges && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>✏️ Há alterações em análise. O produto segue à venda com a versão aprovada.</Text>
          </View>
        )}

        {!product.hasPendingChanges && product.lastChangesRejection?.reason ? (
          <View style={[styles.notice, styles.noticeError]}>
            <Text style={styles.noticeErrorText}>Última alteração recusada: {product.lastChangesRejection.reason}</Text>
          </View>
        ) : null}

        {/* Capa */}
        <Text style={styles.section}>Capa</Text>
        <View style={styles.coverRow}>
          <View style={styles.coverCol}>
            <Text style={styles.coverLabel}>Atual</Text>
            {product.coverImage
              ? <Image source={{ uri: product.coverImage }} style={styles.coverImg} />
              : <View style={[styles.coverImg, styles.coverEmpty]}><Text>—</Text></View>}
          </View>
          {(newCoverUri || product.pendingCover?.url) ? (
            <View style={styles.coverCol}>
              <Text style={styles.coverLabel}>{newCoverUri ? 'Nova (não salva)' : 'Em análise'}</Text>
              <Image source={{ uri: newCoverUri ?? product.pendingCover!.url }} style={styles.coverImg} />
            </View>
          ) : null}
        </View>
        {!locked && (
          <TouchableOpacity style={styles.outlineBtn} onPress={pickCover} disabled={saving} accessibilityRole="button">
            <Text style={styles.outlineText}>🖼️ {newCoverUri ? 'Escolher outra capa' : 'Trocar capa'}</Text>
          </TouchableOpacity>
        )}

        {/* Descrição */}
        <Text style={styles.section}>Descrição</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Descreva o que você está vendendo…"
          placeholderTextColor={colors.gray}
          multiline
          maxLength={MAX_DESCRIPTION}
          editable={!locked && !saving}
        />
        <Text style={styles.counter}>{description.length}/{MAX_DESCRIPTION}</Text>

        {/* Arquivos */}
        <Text style={styles.section}>Arquivos do produto</Text>
        {files.map(f => {
          const willRemove = removed.has(f.storagePath);
          const wasRemoved = !!f.removedAt;
          const pending    = f.status === 'pending';
          return (
            <View key={f.storagePath} style={[styles.fileRow, (willRemove || wasRemoved) && styles.fileRowMuted]}>
              <Text style={styles.fileIcon}>{getFileIcon(f.mimeType ?? '')}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                <Text style={styles.fileMeta}>
                  {formatBytes(f.size)}
                  {pending ? ' · em análise' : ''}
                  {wasRemoved ? ' · removido (só para quem já comprou)' : ''}
                  {willRemove ? ' · será removido' : ''}
                </Text>
              </View>
              {!locked && !wasRemoved && (
                <TouchableOpacity
                  onPress={() => toggleRemove(f.storagePath, isActive({ ...f, storagePath: '' }))}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={willRemove ? `Manter ${f.name}` : `Remover ${f.name}`}
                >
                  <Text style={willRemove ? styles.undoText : styles.removeText}>{willRemove ? 'Desfazer' : 'Remover'}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {newFiles.map((f, i) => (
          <View key={`new_${i}`} style={[styles.fileRow, styles.fileRowNew]}>
            <Text style={styles.fileIcon}>{getFileIcon(f.mimeType)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
              <Text style={styles.fileMeta}>{formatBytes(f.size)} · novo (não salvo){live ? ' · passa por análise' : ''}</Text>
            </View>
            <TouchableOpacity onPress={() => setNewFiles(prev => prev.filter((_, j) => j !== i))} disabled={saving}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {!locked && (
          <TouchableOpacity style={styles.outlineBtn} onPress={addFile} disabled={saving} accessibilityRole="button">
            <Text style={styles.outlineText}>📎 Adicionar arquivo</Text>
          </TouchableOpacity>
        )}

        {live && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 A descrição e as remoções valem na hora. Capa e arquivos novos passam por análise antes de aparecer.
              Quem já comprou continua com todos os arquivos que recebeu.
            </Text>
          </View>
        )}

        {saving && progressLabel ? (
          <View style={styles.progressWrap}>
            <Text style={styles.progressLabel}>{progressLabel}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>
        ) : null}

        {!locked && (
          <TouchableOpacity
            style={[styles.saveBtn, (!hasChanges || saving) && styles.saveBtnDisabled]}
            onPress={save}
            disabled={!hasChanges || saving}
            accessibilityRole="button"
          >
            {saving ? <ActivityIndicator color={colors.background} /> : <Text style={styles.saveText}>💾 Salvar alterações</Text>}
          </TouchableOpacity>
        )}

        {(status === 'draft' || status === 'rejected') && (
          <TouchableOpacity style={styles.outlineBtn} onPress={sendToReview} disabled={saving} accessibilityRole="button">
            <Text style={styles.outlineText}>🚀 Enviar para análise</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  bigIcon: { fontSize: 48 },
  errorText: { color: colors.error, fontSize: fonts.sizes.md, textAlign: 'center' },
  retryBtn: { backgroundColor: colors.gold, borderRadius: borderRadius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryText: { color: colors.background, fontWeight: 'bold' },
  title: { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  fixedHint: { color: colors.gray, fontSize: fonts.sizes.xs, marginTop: 2 },
  notice: {
    marginTop: spacing.md, padding: spacing.sm, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gold + '66', backgroundColor: colors.gold + '11',
  },
  noticeText: { color: colors.gold, fontSize: fonts.sizes.sm, lineHeight: 19 },
  noticeError: { borderColor: colors.error + '66', backgroundColor: colors.error + '11' },
  noticeErrorText: { color: colors.error, fontSize: fonts.sizes.sm, lineHeight: 19 },
  section: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', marginTop: spacing.lg, marginBottom: spacing.sm },
  coverRow: { flexDirection: 'row', gap: spacing.md },
  coverCol: { flex: 1, gap: 4 },
  coverLabel: { color: colors.gray, fontSize: fonts.sizes.xs },
  coverImg: { width: '100%', aspectRatio: 4 / 3, borderRadius: borderRadius.sm, backgroundColor: colors.surface },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  input: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark, color: colors.white,
    padding: spacing.md, fontSize: fonts.sizes.md,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  counter: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'right', marginTop: 4 },
  fileRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.grayDark,
    marginBottom: spacing.xs, backgroundColor: colors.surface,
  },
  fileRowMuted: { opacity: 0.5 },
  fileRowNew: { borderColor: colors.gold + '66' },
  fileIcon: { fontSize: 22 },
  fileName: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  fileMeta: { color: colors.gray, fontSize: fonts.sizes.xs },
  removeText: { color: colors.error, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  undoText: { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  outlineBtn: {
    marginTop: spacing.sm, paddingVertical: spacing.sm, alignItems: 'center',
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.gold,
  },
  outlineText: { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  infoBox: {
    marginTop: spacing.md, padding: spacing.md, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gold + '44', backgroundColor: colors.gold + '11',
  },
  infoText: { color: colors.gold, fontSize: fonts.sizes.sm, lineHeight: 19 },
  progressWrap: { marginTop: spacing.md, gap: 4 },
  progressLabel: { color: colors.gold, fontSize: fonts.sizes.sm },
  progressBar: { height: 6, backgroundColor: colors.surface, borderRadius: borderRadius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.gold },
  saveBtn: { marginTop: spacing.lg, backgroundColor: colors.gold, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.45 },
  saveText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
});