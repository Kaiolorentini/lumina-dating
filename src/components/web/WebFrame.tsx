// ============================================
// LUMINA — MOLDURA (APP ANDROID/iOS)
// src/components/web/WebFrame.tsx
//
// No Android e no iOS não há moldura: devolve as telas sem
// nenhuma View extra (layout idêntico ao de antes).
// A versão do navegador é WebFrame.web.tsx.
// ============================================

import React from 'react';

interface Props { children: React.ReactNode }

export default function WebFrame({ children }: Props) {
  return <>{children}</>;
}