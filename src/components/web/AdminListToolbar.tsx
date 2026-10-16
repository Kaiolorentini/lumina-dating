// ============================================
// LUMINA — BUSCA E ORDEM NAS LISTAS DO ADMIN (COMPUTADOR)
// src/components/web/AdminListToolbar.tsx
//
// 14/10/2026 (web T5). As listas do admin (saques, vendas, suporte…)
// já vêm do servidor na ordem certa, mas no computador era preciso
// rolar tudo para achar um nome ou um valor. Esta barra:
//   • busca em TODO o texto de cada item já carregado (nome, e-mail,
//     valor, motivo, código do cupom…) — sem leitura nova;
//   • inverte a ordem (mais recentes ↔ mais antigos).
// Só no computador. No celular e no app a lista fica igual.
//
//   const search = useAdminListSearch();
//   <AdminListToolbar search={search} total={lista.length} shown={search.apply(lista).length} />
//   <FlatList data={search.apply(lista)} … />
// ============================================

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import HoverPressable from './HoverPressable';

export interface AdminListSearch {
  enabled:     boolean;
  query:       string;
  setQuery:    (q: string) => void;
  newestFirst: boolean;
  toggleOrder: () => void;
  apply:       <T,>(items: readonly T[] | null | undefined) => T[];
}

/** Texto pesquisável de um item (qualquer formato). */
function searchableText(item: unknown): string {
  try {
    return JSON.stringify(item, (_key, value: unknown) => {
      if (value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
        return String((value as { toDate: () => Date }).toDate().toLocaleDateString('pt-BR'));
      }
      return value;
    }).toLowerCase();
  } catch {
    return '';
  }
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function useAdminListSearch(): AdminListSearch {
  const { isDesktop } = useBreakpoint();
  const [query, setQuery] = useState('');
  const [newestFirst, setNewestFirst] = useState(true);
  const toggleOrder = useCallback(() => setNewestFirst(v => !v), []);

  const apply = useCallback(<T,>(items: readonly T[] | null | undefined): T[] => {
    const list = items ? [...items] : [];
    if (!isDesktop) return list;
    const q = normalize(query.trim());
    const filtered = q ? list.filter(item => normalize(searchableText(item)).includes(q)) : list;
    return newestFirst ? filtered : filtered.reverse();
  }, [isDesktop, query, newestFirst]);

  return useMemo(() => ({
    enabled: isDesktop, query, setQuery, newestFirst, toggleOrder, apply,
  }), [isDesktop, query, newestFirst, toggleOrder, apply]);
}

interface Props {
  search: AdminListSearch;
  /** Itens carregados. */
  total:  number;
  /** Itens depois da busca. */
  shown:  number;
  placeholder?: string;
}

export default function AdminListToolbar({ search, total, shown, placeholder }: Props) {
  if (!search.enabled) return null;
  return (
    <View style={styles.bar}>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.input}
          value={search.query}
          onChangeText={search.setQuery}
          placeholder={placeholder ?? 'Buscar por nome, e-mail, valor, motivo…'}
          placeholderTextColor={colors.gray}
          accessibilityLabel="Buscar na lista"
          nativeID="admin-list-search"
        />
        {search.query.length > 0 && (
          <HoverPressable onPress={() => search.setQuery('')} accessibilityRole="button" accessibilityLabel="Limpar busca" hoverStyle={styles.fade}>
            <Text style={styles.clear}>✕</Text>
          </HoverPressable>
        )}
      </View>
      <HoverPressable
        onPress={search.toggleOrder}
        accessibilityRole="button"
        accessibilityLabel={search.newestFirst ? 'Mostrar mais antigos primeiro' : 'Mostrar mais recentes primeiro'}
        style={styles.orderBtn}
        hoverStyle={styles.orderBtnHover}
      >
        <Text style={styles.orderText}>{search.newestFirst ? '↓ Mais recentes' : '↑ Mais antigos'}</Text>
      </HoverPressable>
      <Text style={styles.count}>
        {search.query.trim() ? `${shown} de ${total}` : `${total} ${total === 1 ? 'item' : 'itens'}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  searchBox:  { flex: 1, maxWidth: 520, flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 12, borderRadius: borderRadius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.grayDark },
  searchIcon: { color: colors.gray, fontSize: 16 },
  input:      { flex: 1, color: colors.white, fontSize: fonts.sizes.md, padding: 0 },
  clear:      { color: colors.gray, fontSize: 14 },
  fade:       { opacity: 0.7 },
  orderBtn:   { height: 40, paddingHorizontal: 14, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.grayDark, alignItems: 'center', justifyContent: 'center' },
  orderBtnHover: { borderColor: colors.gold },
  orderText:  { color: colors.grayLight, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  count:      { marginLeft: 'auto', color: colors.gray, fontSize: fonts.sizes.sm },
});
