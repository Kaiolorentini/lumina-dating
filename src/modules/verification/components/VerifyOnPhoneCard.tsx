// ============================================
// LUMINA — "CONTINUE NO CELULAR" (VERIFICAÇÃO DE IDADE)
// src/modules/verification/components/VerifyOnPhoneCard.tsx
//
// Aparece SÓ no navegador do computador (AgeVerificationScreen,
// quando canCaptureVerification() é false). Decisão de Kaio
// (13/10/2026): as fotos da verificação são tiradas só com a câmera
// do celular — documento original e selfie feita na hora.
//
// A pessoa não precisa voltar aqui para nada: quando o envio feito
// no celular chega, o useUserPermissions (onSnapshot) troca esta
// tela sozinha para "Analisando seu documento".
//
// QR code com o endereço do site (pedido de Kaio, 13/10/2026): a
// pessoa aponta a câmera do celular e abre o site direto. O QR leva
// SÓ o endereço, nunca um passe de login — a pessoa entra no celular
// com e-mail e senha (seguro mesmo se o QR aparecer num print).
// O endereço também aparece escrito, com botão de copiar.
// 13/10/2026 (unificação): o endereço é o do APP (…/app), não o da
// landing na raiz — utils/webBase.appAddress().
// ============================================

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QrCode from '../../../components/QrCode';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { appAddress } from '../../../utils/webBase';

const COPIED_MS = 2500;
const QR_SIZE   = 184;

function siteAddress(): { full: string; short: string } {
  return appAddress();
}

const STEPS = [
  'Abra o navegador do seu celular (Chrome no Android, Safari no iPhone).',
  'Aponte a câmera do celular para o QR code (ou digite o endereço) e entre com o mesmo e-mail e senha desta conta.',
  'Tire as três fotos pela câmera do celular e envie para análise.',
  'Pronto: esta tela atualiza sozinha quando o envio chegar.',
];

export default function VerifyOnPhoneCard() {
  const { full, short } = siteAddress();
  const [copied, setCopied]   = useState(false);
  const [copyError, setCopyError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  async function copyAddress() {
    if (!full) return;
    setCopyError(false);
    try {
      await Clipboard.setStringAsync(full);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch (error) {
      console.warn('[VerifyOnPhoneCard] copiar endereço falhou:', error);
      setCopyError(true);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">📱</Text>
      <Text style={styles.title}>Continue pelo celular</Text>
      <Text style={styles.body}>
        Para proteger todo mundo, as fotos da verificação são tiradas só com a
        câmera do celular: a frente e o verso do documento original e uma selfie
        feita na hora. Pelo computador não é possível enviar fotos.
      </Text>

      <View style={styles.steps}>
        {STEPS.map((step, i) => (
          <View key={step} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {!!full && (
        <View style={styles.addressBox}>
          <QrCode
            value={full}
            size={QR_SIZE}
            accessibilityLabel={`QR code com o endereço do Lumina: ${short}`}
          />
          <Text style={styles.qrHint}>Aponte a câmera do celular</Text>
          <Text style={styles.addressLabel}>ou digite o endereço</Text>
          <Text style={styles.address} selectable>{short}</Text>
          <TouchableOpacity
            style={styles.copyBtn}
            onPress={copyAddress}
            accessibilityRole="button"
            accessibilityLabel="Copiar endereço do site"
          >
            <Text style={styles.copyText}>{copied ? '✓ Endereço copiado' : 'Copiar endereço'}</Text>
          </TouchableOpacity>
          {copyError && (
            <Text style={styles.copyError}>
              Não foi possível copiar. Digite o endereço no navegador do celular.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gold + '55',
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  icon:  { fontSize: 48 },
  title: { color: colors.gold, fontSize: fonts.sizes.xl, fontWeight: 'bold', textAlign: 'center' },
  body:  { color: colors.grayLight, fontSize: fonts.sizes.md, lineHeight: 22, textAlign: 'center' },
  steps: { alignSelf: 'stretch', gap: spacing.sm },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  stepNumber: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1, borderColor: colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumberText: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  stepText: { flex: 1, color: colors.white, fontSize: fonts.sizes.sm, lineHeight: 20, paddingTop: 3 },
  addressBox: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gold + '11',
    borderWidth: 1,
    borderColor: colors.gold + '44',
  },
  qrHint: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  addressLabel: { color: colors.gray, fontSize: fonts.sizes.xs, textTransform: 'uppercase', letterSpacing: 1 },
  address: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', textAlign: 'center' },
  copyBtn: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    minWidth: 200,
    alignItems: 'center',
  },
  copyText:  { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  copyError: { color: colors.error, fontSize: fonts.sizes.xs, textAlign: 'center' },
});
