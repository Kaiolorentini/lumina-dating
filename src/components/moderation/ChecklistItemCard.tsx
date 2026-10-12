// ============================================
// LUMINA — CARTÃO DE ITEM DE QUESTIONÁRIO DE MODERAÇÃO
// src/components/moderation/ChecklistItemCard.tsx
//
// 12/10/2026. Um item do questionário: pergunta, "Como analisar"
// (o que olhar, pode / não pode), botões Aprovado / Negado e, quando
// negado, o motivo que vai para a pessoa + observação opcional.
//
// Genérico de propósito: usado pela verificação de idade e, numa
// próxima etapa, pelo questionário de produto (hoje ele ainda tem uma
// cópia interna — ver backlog).
// ============================================

import React, { memo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../theme';

export type ChecklistItemAnswer = 'approved' | 'rejected';

export interface ChecklistItemCardProps {
  title: string;
  /** Ícone antes do título (ex.: 🛡️ em itens de proteção de menores). */
  icon?: string;
  look: string;
  ok: string[];
  notOk: string[];
  answer: ChecklistItemAnswer | undefined;
  note: string;
  onAnswer: (answer: ChecklistItemAnswer) => void;
  onNote: (note: string) => void;
  /** Rótulo do motivo quando negado (ex.: "Motivo enviado ao usuário:"). */
  reasonLabel: string;
  /** Texto do motivo; null esconde a caixa do motivo. */
  reasonText: string | null;
  /** Avisos em vermelho mostrados quando negado. */
  rejectWarnings?: string[];
  notePlaceholder: string;
  /** Desliga os botões (ex.: análise já concluída por outro admin). */
  disabled?: boolean;
}

function ChecklistItemCardBase({
  title, icon, look, ok, notOk, answer, note, onAnswer, onNote,
  reasonLabel, reasonText, rejectWarnings, notePlaceholder, disabled,
}: ChecklistItemCardProps) {
  const [showHelp, setShowHelp] = useState(false);
  const approved = answer === 'approved';
  const rejected = answer === 'rejected';

  return (
    <View style={[styles.card, approved && styles.cardOk, rejected && styles.cardNo]}>
      <View style={styles.header}>
        <Text style={styles.title}>{icon ? `${icon} ` : ''}{title}</Text>
        <TouchableOpacity
          onPress={() => setShowHelp(v => !v)}
          accessibilityRole="button"
          accessibilityLabel={showHelp ? 'Esconder como analisar' : 'Mostrar como analisar'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.helpToggle}>{showHelp ? 'Fechar ▲' : 'Como analisar ▼'}</Text>
        </TouchableOpacity>
      </View>

      {showHelp && (
        <View style={styles.help}>
          <Text style={styles.helpLabel}>🔍 O que olhar</Text>
          <Text style={styles.helpText}>{look}</Text>
          <Text style={[styles.helpLabel, { color: colors.success }]}>✅ Pode</Text>
          {ok.map(text => <Text key={text} style={styles.helpBullet}>• {text}</Text>)}
          <Text style={[styles.helpLabel, { color: colors.error }]}>❌ Não pode</Text>
          {notOk.map(text => <Text key={text} style={styles.helpBullet}>• {text}</Text>)}
        </View>
      )}

      <View style={styles.answerRow}>
        <TouchableOpacity
          style={[styles.answerBtn, approved && styles.answerBtnOk, disabled && styles.disabled]}
          onPress={() => onAnswer('approved')}
          disabled={disabled}
          accessibilityRole="radio"
          accessibilityState={{ selected: approved, disabled }}
          accessibilityLabel={`${title}: aprovado`}
        >
          <Text style={[styles.answerText, approved && styles.answerTextOk]}>✅ Aprovado</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.answerBtn, rejected && styles.answerBtnNo, disabled && styles.disabled]}
          onPress={() => onAnswer('rejected')}
          disabled={disabled}
          accessibilityRole="radio"
          accessibilityState={{ selected: rejected, disabled }}
          accessibilityLabel={`${title}: negado`}
        >
          <Text style={[styles.answerText, rejected && styles.answerTextNo]}>❌ Negado</Text>
        </TouchableOpacity>
      </View>

      {rejected && (
        <View style={styles.rejectBox}>
          {reasonText !== null && (
            <>
              <Text style={styles.rejectLabel}>{reasonLabel}</Text>
              <Text style={styles.rejectReason}>{reasonText}</Text>
            </>
          )}
          {(rejectWarnings ?? []).map(text => (
            <Text key={text} style={styles.warning}>{text}</Text>
          ))}
          <TextInput
            style={styles.noteInput}
            placeholder={notePlaceholder}
            placeholderTextColor={colors.gray}
            value={note}
            onChangeText={onNote}
            maxLength={300}
            multiline
            editable={!disabled}
          />
        </View>
      )}
    </View>
  );
}

const ChecklistItemCard = memo(ChecklistItemCardBase);
export default ChecklistItemCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.grayDark,
    padding: spacing.md, gap: spacing.sm,
  },
  cardOk: { borderColor: colors.success },
  cardNo: { borderColor: colors.error },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  title: { flex: 1, color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  helpToggle: { color: colors.gold, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  help: { gap: 4, padding: spacing.sm, borderRadius: borderRadius.sm, backgroundColor: colors.background },
  helpLabel: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold', marginTop: 4 },
  helpText: { color: colors.white, fontSize: fonts.sizes.sm, lineHeight: 19 },
  helpBullet: { color: colors.gray, fontSize: fonts.sizes.sm, lineHeight: 19 },

  answerRow: { flexDirection: 'row', gap: spacing.sm },
  answerBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: colors.grayDark, alignItems: 'center', minHeight: 44, justifyContent: 'center',
  },
  answerBtnOk: { borderColor: colors.success, backgroundColor: colors.success + '22' },
  answerBtnNo: { borderColor: colors.error, backgroundColor: colors.error + '22' },
  answerText: { color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  answerTextOk: { color: colors.success },
  answerTextNo: { color: colors.error },
  disabled: { opacity: 0.45 },

  rejectBox: { gap: 4 },
  rejectLabel: { color: colors.gray, fontSize: fonts.sizes.xs },
  rejectReason: { color: colors.white, fontSize: fonts.sizes.sm, fontStyle: 'italic' },
  warning: { color: colors.error, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  noteInput: {
    backgroundColor: colors.background, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.grayDark,
    color: colors.white, padding: spacing.sm, fontSize: fonts.sizes.sm, minHeight: 56, textAlignVertical: 'top',
  },
});
