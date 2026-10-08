// ============================================
// LUMINA — REVIEW FORM MODAL
// src/components/marketplace/ReviewFormModal.tsx
//
// Nota (obrigatória) + comentário (opcional, até 500). Usado no
// detalhe do produto e em Minhas Compras, sempre pelo hook
// useReviewComposer — o modal só desenha e devolve os valores.
//
// O servidor valida de novo (nota, tamanho, contatos e links); o
// aviso aqui é só para a pessoa não descobrir a regra no erro.
// ============================================

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MP, MP_GRADIENT, MP_FONT, spacing, borderRadius } from '../../theme/marketplace';
import { StarRating, RATING_LABELS } from './StarRating';
import { REVIEW_COMMENT_MAX } from '../../services/marketplace/reviewService';
import { ReviewRating } from '../../shared/types/marketplace/review.types';

interface Props {
  visible: boolean;
  /** Título do produto, para a pessoa saber o que está avaliando. */
  productTitle?: string;
  initialRating: number;
  initialComment: string;
  isEdit: boolean;
  submitting: boolean;
  onSubmit: (rating: ReviewRating, comment: string) => void;
  onClose: () => void;
}

export default function ReviewFormModal({
  visible, productTitle, initialRating, initialComment, isEdit, submitting, onSubmit, onClose,
}: Props) {
  const [rating, setRating]   = useState<number>(initialRating);
  const [comment, setComment] = useState<string>(initialComment);

  // Reabre com os valores da avaliação atual (edição) ou vazio.
  useEffect(() => {
    if (visible) {
      setRating(initialRating);
      setComment(initialComment);
    }
  }, [visible, initialRating, initialComment]);

  const canSend = rating >= 1 && rating <= 5 && !submitting;
  const label   = rating >= 1 ? RATING_LABELS[rating as ReviewRating] : 'Toque nas estrelas';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => { if (!submitting) onClose(); }}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.box}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{isEdit ? 'Editar avaliação' : 'Avaliar conteúdo'}</Text>
            {!!productTitle && (
              <Text style={styles.product} numberOfLines={2}>{productTitle}</Text>
            )}

            <View style={styles.starsWrap}>
              <StarRating value={rating} size={38} onChange={setRating} disabled={submitting} />
              <Text style={[styles.starLabel, rating >= 1 && styles.starLabelActive]}>{label}</Text>
            </View>

            <Text style={styles.fieldLabel}>
              Comentário <Text style={styles.optional}>(opcional)</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={comment}
              onChangeText={setComment}
              placeholder="Conte o que achou do conteúdo"
              placeholderTextColor={MP.textMuted}
              multiline
              maxLength={REVIEW_COMMENT_MAX}
              editable={!submitting}
              textAlignVertical="top"
            />
            <View style={styles.inputFooter}>
              <Text style={styles.hint}>Sem links, contatos, @ ou chave Pix.</Text>
              <Text style={styles.counter}>{comment.length}/{REVIEW_COMMENT_MAX}</Text>
            </View>

            <Text style={styles.publicNote}>
              Sua nota e seu comentário aparecem no produto com o seu primeiro nome.
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                disabled={submitting}
                accessibilityRole="button"
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                onPress={() => { if (canSend) onSubmit(rating as ReviewRating, comment); }}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSend, busy: submitting }}
              >
                <LinearGradient
                  colors={MP_GRADIENT.gold}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sendInner}
                >
                  {submitting
                    ? <ActivityIndicator color={MP.textOnGold} />
                    : <Text style={styles.sendText}>{isEdit ? 'Salvar' : 'Enviar'}</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  box: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: MP.surfaceRaised,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: MP.border,
    padding: spacing.lg,
  },
  title: { color: MP.text, fontSize: MP_FONT.size.lg, fontWeight: MP_FONT.weight.bold },
  product: { color: MP.textMuted, fontSize: MP_FONT.size.sm, marginTop: 2 },
  starsWrap: { alignItems: 'center', marginVertical: spacing.lg, gap: spacing.xs },
  starLabel: { color: MP.textMuted, fontSize: MP_FONT.size.sm },
  starLabelActive: { color: MP.gold, fontWeight: MP_FONT.weight.bold },
  fieldLabel: {
    color: MP.textSoft,
    fontSize: MP_FONT.size.xs,
    fontWeight: MP_FONT.weight.bold,
    marginBottom: spacing.xs,
  },
  optional: { color: MP.textMuted, fontWeight: MP_FONT.weight.semibold },
  input: {
    backgroundColor: MP.bg,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: MP.border,
    color: MP.text,
    padding: spacing.md,
    fontSize: MP_FONT.size.md,
    minHeight: 110,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  hint: { flex: 1, color: MP.textMuted, fontSize: MP_FONT.size.xs },
  counter: { color: MP.textMuted, fontSize: MP_FONT.size.xs },
  publicNote: { color: MP.textMuted, fontSize: MP_FONT.size.xs, marginTop: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelBtn: {
    flex: 1,
    backgroundColor: MP.surface,
    borderWidth: 1,
    borderColor: MP.border,
    borderRadius: borderRadius.full,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: MP.textSoft, fontWeight: MP_FONT.weight.bold },
  sendBtn: { flex: 1, borderRadius: borderRadius.full },
  sendBtnDisabled: { opacity: 0.45 },
  sendInner: {
    borderRadius: borderRadius.full,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  sendText: { color: MP.textOnGold, fontWeight: MP_FONT.weight.heavy, fontSize: MP_FONT.size.md },
});
