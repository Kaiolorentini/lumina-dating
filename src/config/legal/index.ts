// ============================================
// LUMINA — DOCUMENTOS LEGAIS
// src/config/legal/index.ts
//
// Textos versionados NO REPOSITÓRIO, não no Firestore:
//   - funcionam offline, inclusive no primeiro acesso
//   - o texto fica preso à versão que a pessoa aceitou
//   - não custa leitura do Firestore
//
// AO PUBLICAR UMA VERSÃO NOVA:
//   1. crie terms-<versao>.ts e privacy-<versao>.ts ao lado
//      dos atuais (NÃO sobrescreva: o texto antigo é a prova
//      do que quem aceitou antes leu)
//   2. registre no LEGAL_VERSIONS abaixo
//   3. aponte CURRENT_LEGAL_VERSION para a nova
//   4. troque APP_TERMS_VERSION em src/config/terms.ts E em
//      functions/src/config/terms.ts — a CF recusa o aceite
//      se as duas divergirem
//   5. deploy das functions ANTES do eas update
//   6. todos os usuários passam pelo aceite outra vez
// ============================================

import { TERMS_2026_09_17_DRAFT } from './terms-2026-09-17-draft';
import { PRIVACY_2026_09_17_DRAFT } from './privacy-2026-09-17-draft';

export interface LegalSection {
  /** Título da seção, como aparece no documento. */
  heading: string;
  /** Parágrafos. Cada item é renderizado como um bloco de texto. */
  body: string[];
}

export interface LegalDocument {
  title: string;
  version: string;
  effectiveDate: string;
  sections: LegalSection[];
}

export interface LegalVersion {
  version: string;
  terms: LegalDocument;
  privacy: LegalDocument;
  /**
   * true enquanto o documento tiver campos [PREENCHER].
   * A tela de aceite mostra um aviso e o rodapé indica
   * rascunho — aceite de documento incompleto não é prova
   * válida de consentimento.
   */
  draft: boolean;
}

export const LEGAL_VERSIONS: Record<string, LegalVersion> = {
  '2026-09-17-draft': {
    version: '2026-09-17-draft',
    terms: TERMS_2026_09_17_DRAFT,
    privacy: PRIVACY_2026_09_17_DRAFT,
    draft: true,
  },
};

export const CURRENT_LEGAL_VERSION = '2026-09-17-draft';

export function getLegalVersion(version: string): LegalVersion | null {
  return LEGAL_VERSIONS[version] ?? null;
}

export function getCurrentLegal(): LegalVersion {
  const current = LEGAL_VERSIONS[CURRENT_LEGAL_VERSION];
  if (!current) {
    // Erro de programação, não de runtime: significa que
    // CURRENT_LEGAL_VERSION aponta para versão inexistente.
    throw new Error(
      `CURRENT_LEGAL_VERSION "${CURRENT_LEGAL_VERSION}" não está em LEGAL_VERSIONS`
    );
  }
  return current;
}

/** Marcador usado nos textos que ainda precisam de dados reais. */
export const PLACEHOLDER = '[PREENCHER';

/** Conta quantas seções ainda têm placeholder — usado no aviso de rascunho. */
export function countPlaceholders(doc: LegalDocument): number {
  return doc.sections.reduce((total, section) => {
    const inHeading = section.heading.includes(PLACEHOLDER) ? 1 : 0;
    const inBody = section.body.filter(p => p.includes(PLACEHOLDER)).length;
    return total + inHeading + inBody;
  }, 0);
}