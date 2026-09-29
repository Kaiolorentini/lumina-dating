// ============================================
// LUMINA — NOVO CHAMADO (questionário)
// src/modules/support/screens/SupportNewScreen.tsx
//
// Passos: assunto → perguntas (só as visíveis) → [resposta pronta,
// em Dúvida] → [quem, em Denúncia] → [descrição, em Ideia e Outro
// assunto] → print (opcional) → revisão.
// Resposta única avança sozinha; "Outro" e múltipla escolha pedem
// "Continuar".
// ============================================

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { getConexoesAceitas } from '../../profile/services/requestsService';
import {
  SUPPORT_CATEGORIES, SupportCategory, SupportQuestion, categoryById, conditionMet,
} from '../supportQuestionnaire';
import {
  createTicket, uploadSupportImage, collectDeviceInfo, loadReportCandidates, TicketAnswer,
} from '../services/supportService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type AnswerState = Record<string, { optionIds: string[]; text: string }>;

type Step =
  | { kind: 'category' }
  | { kind: 'question'; question: SupportQuestion }
  | { kind: 'faq' }
  | { kind: 'reportUser' }
  | { kind: 'description' }
  | { kind: 'attachment' }
  | { kind: 'review' };

const MIN_DESCRIPTION = 10;

function faqText(cat: SupportCategory | null, answers: AnswerState): string | null {
  if (!cat?.faq) return null;
  const first = cat.questions[0];
  const chosen = answers[first.id]?.optionIds?.[0];
  return chosen && chosen !== 'other' ? cat.faq[chosen] ?? null : null;
}

function buildSteps(cat: SupportCategory | null, answers: AnswerState): Step[] {
  const steps: Step[] = [{ kind: 'category' }];
  if (!cat) return steps;
  cat.questions.forEach(q => { if (conditionMet(q.showIf, answers)) steps.push({ kind: 'question', question: q }); });
  if (faqText(cat, answers)) steps.push({ kind: 'faq' });
  if (cat.pickReportedUser) steps.push({ kind: 'reportUser' });
  if (cat.requiresText) steps.push({ kind: 'description' });
  steps.push({ kind: 'attachment' }, { kind: 'review' });
  return steps;
}

export default function SupportNewScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [answers, setAnswers]       = useState<AnswerState>({});
  const [index, setIndex]           = useState(0);
  const [description, setDescription] = useState('');
  const [reported, setReported]     = useState<{ uid: string; name: string } | null>(null);
  const [candidates, setCandidates] = useState<Array<{ uid: string; name: string; photoURL: string }> | null>(null);
  const [image, setImage]           = useState<{ uri: string; base64: string } | null>(null);
  const [sending, setSending]       = useState(false);

  // Vindo do "🚩 Denunciar": abre em Denúncia com a pessoa escolhida.
  const prefill = useRoute<RouteProp<RootStackParamList, 'SupportNew'>>().params;
  useEffect(() => {
    if (!prefill?.reportUid) return;
    setCategoryId('report');
    setReported({ uid: prefill.reportUid, name: prefill.reportName || 'Perfil denunciado' });
    setIndex(1);
  }, [prefill?.reportUid]);

  const category = categoryById(categoryId);
  const steps    = useMemo(() => buildSteps(category, answers), [category, answers]);
  const step     = steps[Math.min(index, steps.length - 1)];

  // Lista de quem denunciar — carregada só quando chega a vez.
  useEffect(() => {
    if (step.kind !== 'reportUser' || candidates || !user?.uid) return;
    getConexoesAceitas(user.uid)
      .then(conns => loadReportCandidates(user.uid, conns))
      .then(setCandidates)
      .catch(() => setCandidates([]));
  }, [step.kind, candidates, user?.uid]);

  // Saídas liberadas de propósito ("Resolveu" e a troca para a conversa).
  const allowExitRef = useRef(false);

  // Voltar do cabeçalho e do Android: volta UM passo. Só sai da tela
  // no primeiro passo — ninguém perde o questionário por um toque.
  useEffect(() => navigation.addListener('beforeRemove', e => {
    if (allowExitRef.current || index === 0 || sending) return;
    if (e.data.action.type === 'REPLACE') return;
    e.preventDefault();
    setIndex(i => Math.max(0, i - 1));
  }), [navigation, index, sending]);

  function exit() {
    allowExitRef.current = true;
    navigation.goBack();
  }

  function next()  { setIndex(i => Math.min(i + 1, steps.length - 1)); }
  function back()  { if (index === 0) exit(); else setIndex(i => i - 1); }

  function chooseCategory(id: string) {
    setCategoryId(id);
    setAnswers({});
    setDescription('');
    setReported(null);
    setImage(null);
    setIndex(1);
  }

  function selectOption(q: SupportQuestion, optionId: string) {
    setAnswers(prev => {
      const current = prev[q.id] ?? { optionIds: [], text: '' };
      let optionIds: string[];
      if (q.multi) {
        optionIds = current.optionIds.includes(optionId)
          ? current.optionIds.filter(o => o !== optionId)
          : [...current.optionIds, optionId];
      } else {
        optionIds = [optionId];
      }
      // Respostas de perguntas que dependiam desta deixam de valer.
      const nextAnswers: AnswerState = { ...prev, [q.id]: { optionIds, text: optionId === 'other' ? current.text : '' } };
      category?.questions.forEach(dep => {
        if (dep.showIf?.questionId === q.id && !conditionMet(dep.showIf, nextAnswers)) delete nextAnswers[dep.id];
      });
      return nextAnswers;
    });
    if (!q.multi && optionId !== 'other') setTimeout(next, 120);
  }

  function setOtherText(q: SupportQuestion, text: string) {
    setAnswers(prev => ({ ...prev, [q.id]: { optionIds: prev[q.id]?.optionIds ?? ['other'], text } }));
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Precisamos acessar sua galeria para anexar o print.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
    if (!result.canceled && result.assets[0]?.base64) {
      setImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  }

  function buildAnswers(): TicketAnswer[] {
    if (!category) return [];
    return category.questions
      .filter(q => conditionMet(q.showIf, answers) && answers[q.id]?.optionIds.length)
      .map(q => {
        const a = answers[q.id];
        return {
          questionId: q.id,
          question:   q.text,
          optionIds:  a.optionIds,
          labels:     a.optionIds.map(id => q.options.find(o => o.id === id)?.label ?? id),
          text:       a.optionIds.includes('other') ? a.text.trim() : '',
        };
      });
  }

  async function send() {
    if (!category || !user?.uid) return;
    setSending(true);
    try {
      const attachmentPath = image ? await uploadSupportImage(user.uid, image.base64) : null;
      const ticketId = await createTicket({
        category:      category.id,
        categoryLabel: category.label,
        answers:       buildAnswers(),
        description:   category.requiresText ? description.trim() : '',
        reportedUid:   reported?.uid ?? null,
        attachmentPath,
        device:        collectDeviceInfo(),
      });
      allowExitRef.current = true;
      navigation.replace('SupportTicket', { ticketId });
    } catch (e: unknown) {
      Alert.alert('Chamado não enviado', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setSending(false);
    }
  }

  // ── Renderização de cada passo ──

  function renderCategory() {
    return (
      <>
        <Text style={styles.title}>Qual é o assunto?</Text>
        {SUPPORT_CATEGORIES.map(c => (
          <TouchableOpacity key={c.id} style={styles.categoryRow} onPress={() => chooseCategory(c.id)} accessibilityRole="button">
            <Text style={styles.categoryIcon}>{c.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.categoryLabel}>{c.label}</Text>
              <Text style={styles.categoryDesc}>{c.description}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </>
    );
  }

  function renderQuestion(q: SupportQuestion) {
    const current  = answers[q.id] ?? { optionIds: [], text: '' };
    const hasOther = current.optionIds.includes('other');
    const canGo    = current.optionIds.length > 0 && (!hasOther || current.text.trim().length >= 3);
    const infos    = (category?.info ?? []).filter(i => i.showIf.questionId === q.id && conditionMet(i.showIf, answers));

    return (
      <>
        <Text style={styles.title}>{q.text}</Text>
        {q.multi && <Text style={styles.hint}>Pode marcar mais de uma.</Text>}
        {q.options.map(o => {
          const selected = current.optionIds.includes(o.id);
          return (
            <TouchableOpacity
              key={o.id}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => selectOption(q, o.id)}
              accessibilityRole={q.multi ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: selected }}
            >
              <Text style={[styles.optionMark, selected && styles.optionMarkOn]}>{q.multi ? (selected ? '☑' : '☐') : (selected ? '◉' : '○')}</Text>
              <Text style={[styles.optionText, selected && styles.optionTextOn]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}

        {hasOther && (
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Descreva, em poucas palavras"
            placeholderTextColor={colors.gray}
            value={current.text}
            onChangeText={t => setOtherText(q, t)}
            multiline
            maxLength={500}
            autoFocus
          />
        )}

        {infos.map((info, i) => (
          <View key={i} style={[styles.info, info.tone === 'danger' && styles.infoDanger]}>
            <Text style={[styles.infoText, info.tone === 'danger' && styles.infoTextDanger]}>{info.text}</Text>
            {info.action && (
              <TouchableOpacity onPress={() => navigation.navigate(info.action!.route)} accessibilityRole="button">
                <Text style={styles.infoAction}>{info.action.label} ›</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {(q.multi || hasOther) && (
          <TouchableOpacity style={[styles.primaryBtn, !canGo && styles.disabled]} onPress={next} disabled={!canGo}>
            <Text style={styles.primaryText}>Continuar</Text>
          </TouchableOpacity>
        )}
      </>
    );
  }

  function renderFaq() {
    return (
      <>
        <Text style={styles.title}>Talvez isto ajude</Text>
        <View style={styles.faqBox}>
          <Text style={styles.faqText}>{faqText(category, answers)}</Text>
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={exit}>
          <Text style={styles.primaryText}>Resolveu, obrigado</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.outlineBtn} onPress={next}>
          <Text style={styles.outlineText}>Ainda preciso de ajuda</Text>
        </TouchableOpacity>
      </>
    );
  }

  function renderReportUser() {
    return (
      <>
        <Text style={styles.title}>Quem você quer denunciar?</Text>
        <Text style={styles.hint}>Escolha entre suas conexões recentes.</Text>
        {candidates === null ? (
          <ActivityIndicator color={colors.gold} style={{ marginVertical: spacing.lg }} />
        ) : (
          candidates.map(c => (
            <TouchableOpacity
              key={c.uid}
              style={[styles.option, reported?.uid === c.uid && styles.optionSelected]}
              onPress={() => { setReported({ uid: c.uid, name: c.name }); setTimeout(next, 120); }}
            >
              {c.photoURL
                ? <Image source={{ uri: c.photoURL }} style={styles.avatar} />
                : <View style={[styles.avatar, styles.avatarEmpty]}><Text>👤</Text></View>}
              <Text style={styles.optionText}>{c.name}</Text>
            </TouchableOpacity>
          ))
        )}
        <TouchableOpacity
          style={[styles.option, reported === null && candidates !== null && styles.optionNeutral]}
          onPress={() => { setReported(null); next(); }}
        >
          <Text style={styles.optionMark}>○</Text>
          <Text style={styles.optionText}>Não está na lista ou prefiro não informar</Text>
        </TouchableOpacity>
      </>
    );
  }

  function renderDescription() {
    const ok = description.trim().length >= MIN_DESCRIPTION;
    return (
      <>
        <Text style={styles.title}>{category?.textPrompt ?? 'Descreva'}</Text>
        <TextInput
          style={[styles.input, styles.inputLarge]}
          placeholder="Escreva aqui"
          placeholderTextColor={colors.gray}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
          autoFocus
        />
        <Text style={styles.counter}>{description.length}/2000</Text>
        <TouchableOpacity style={[styles.primaryBtn, !ok && styles.disabled]} onPress={next} disabled={!ok}>
          <Text style={styles.primaryText}>Continuar</Text>
        </TouchableOpacity>
      </>
    );
  }

  function renderAttachment() {
    return (
      <>
        <Text style={styles.title}>Quer anexar um print?</Text>
        <Text style={styles.hint}>{category?.suggestAttachment ?? 'Opcional — só se ajudar a mostrar o que aconteceu.'}</Text>
        {image ? (
          <View style={styles.previewBox}>
            <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="contain" />
            <TouchableOpacity onPress={() => setImage(null)}>
              <Text style={styles.removeText}>Remover print</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.outlineBtn} onPress={pickImage}>
            <Text style={styles.outlineText}>📎 Escolher print da galeria</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.primaryBtn} onPress={next}>
          <Text style={styles.primaryText}>{image ? 'Continuar' : 'Pular'}</Text>
        </TouchableOpacity>
      </>
    );
  }

  function renderReview() {
    const list = buildAnswers();
    return (
      <>
        <Text style={styles.title}>Confira antes de enviar</Text>
        <View style={styles.reviewBox}>
          <Text style={styles.reviewCategory}>{category?.icon} {category?.label}</Text>
          {list.map(a => (
            <View key={a.questionId} style={styles.reviewRow}>
              <Text style={styles.reviewQ}>{a.question}</Text>
              <Text style={styles.reviewA}>{a.labels.join(', ')}{a.text ? ` — ${a.text}` : ''}</Text>
            </View>
          ))}
          {reported && (
            <View style={styles.reviewRow}>
              <Text style={styles.reviewQ}>Pessoa denunciada</Text>
              <Text style={styles.reviewA}>{reported.name}</Text>
            </View>
          )}
          {category?.requiresText && (
            <View style={styles.reviewRow}>
              <Text style={styles.reviewQ}>Descrição</Text>
              <Text style={styles.reviewA}>{description.trim()}</Text>
            </View>
          )}
          {image && <Text style={styles.reviewA}>📎 Print anexado</Text>}
        </View>
        <Text style={styles.hint}>
          Junto do chamado vão a versão do app e o modelo do seu aparelho, para ajudar na análise.
        </Text>
        <TouchableOpacity style={[styles.primaryBtn, sending && styles.disabled]} onPress={send} disabled={sending}>
          {sending ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryText}>Enviar chamado</Text>}
        </TouchableOpacity>
      </>
    );
  }

  const progress = steps.length > 1 ? index / (steps.length - 1) : 0;

  return (
    <View style={styles.container}>
      <Header title="Novo chamado" showBack showHome />
      <View style={styles.progress}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step.kind === 'category'    && renderCategory()}
          {step.kind === 'question'    && renderQuestion(step.question)}
          {step.kind === 'faq'         && renderFaq()}
          {step.kind === 'reportUser'  && renderReportUser()}
          {step.kind === 'description' && renderDescription()}
          {step.kind === 'attachment'  && renderAttachment()}
          {step.kind === 'review'      && renderReview()}

          {index > 0 && (
            <TouchableOpacity style={styles.backLink} onPress={back}>
              <Text style={styles.backLinkText}>‹ Voltar</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  progress:     { height: 3, backgroundColor: colors.grayDark },
  progressFill: { height: 3, backgroundColor: colors.gold },
  content:   { padding: spacing.md, paddingBottom: spacing.xl * 2, gap: spacing.sm },
  title:     { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold', marginBottom: spacing.xs },
  hint:      { color: colors.gray, fontSize: fonts.sizes.sm, lineHeight: 19 },
  categoryRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    borderRadius: borderRadius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.grayDark,
  },
  categoryIcon:  { fontSize: 26 },
  categoryLabel: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  categoryDesc:  { color: colors.gray, fontSize: fonts.sizes.xs, marginTop: 2 },
  arrow:         { color: colors.gray, fontSize: fonts.sizes.xl },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md,
    borderRadius: borderRadius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.grayDark,
  },
  optionSelected: { borderColor: colors.gold, backgroundColor: colors.gold + '14' },
  optionNeutral:  { borderColor: colors.gray },
  optionMark:     { color: colors.gray, fontSize: fonts.sizes.lg, width: 22 },
  optionMarkOn:   { color: colors.gold },
  optionText:     { flex: 1, color: colors.white, fontSize: fonts.sizes.md },
  optionTextOn:   { color: colors.gold, fontWeight: 'bold' },
  input: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.gold + '66',
    color: colors.white, padding: spacing.md, fontSize: fonts.sizes.md,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  inputLarge:     { minHeight: 160, textAlignVertical: 'top' },
  counter:        { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'right' },
  info: {
    padding: spacing.md, borderRadius: borderRadius.md, gap: spacing.xs,
    borderWidth: 1, borderColor: colors.gold + '55', backgroundColor: colors.gold + '11',
  },
  infoDanger:     { borderColor: colors.error + '66', backgroundColor: colors.error + '11' },
  infoText:       { color: colors.gold, fontSize: fonts.sizes.sm, lineHeight: 19 },
  infoTextDanger: { color: colors.error },
  infoAction:     { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  faqBox:  { padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.gold + '44' },
  faqText: { color: colors.white, fontSize: fonts.sizes.md, lineHeight: 22 },
  avatar:      { width: 36, height: 36, borderRadius: 18 },
  avatarEmpty: { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  previewBox:  { alignItems: 'center', gap: spacing.sm },
  preview:     { width: '100%', height: 260, borderRadius: borderRadius.md, backgroundColor: colors.surface },
  removeText:  { color: colors.error, fontWeight: 'bold' },
  reviewBox: {
    padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.grayDark, gap: spacing.sm,
  },
  reviewCategory: { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  reviewRow:      { gap: 2 },
  reviewQ:        { color: colors.gray, fontSize: fonts.sizes.xs },
  reviewA:        { color: colors.white, fontSize: fonts.sizes.sm },
  primaryBtn: {
    marginTop: spacing.sm, backgroundColor: colors.gold, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center',
  },
  primaryText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
  outlineBtn: {
    marginTop: spacing.xs, borderWidth: 1, borderColor: colors.gold, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center',
  },
  outlineText:  { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.md },
  disabled:     { opacity: 0.45 },
  backLink:     { alignSelf: 'center', marginTop: spacing.md, padding: spacing.sm },
  backLinkText: { color: colors.gray, fontSize: fonts.sizes.sm },
});