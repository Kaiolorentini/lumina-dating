// ============================================
// LUMINA — LOCATION SELECTOR v1.0
// src/components/LocationSelector.tsx
//
// Substitui os TextInput livres de cidade/estado por seleção
// a partir da base oficial do IBGE.
//
// POR QUE: texto livre produzia "São Paulo", "sao paulo" e "SP"
// como regiões diferentes. O Destaque Regional compara região —
// e entregava errado sem nenhum erro no log.
//
// A cidade só abre depois do estado: a lista de municípios
// depende da UF, e permitir o inverso deixaria o usuário
// escolher cidade sem contexto.
//
// ESTADOS COBERTOS (checklist de UI): loading, erro com retry,
// vazio de busca, seleção. Depende de rede num fluxo de
// onboarding — sem esses estados o cadastro trava em silêncio.
// ============================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../theme';
import {
  fetchEstados,
  fetchMunicipios,
  filtrarMunicipios,
  limparCacheIbge,
  Estado,
  Municipio,
} from '../services/ibgeService';

interface Props {
  /** Sigla do estado selecionado (ex.: 'PR'). Vazio se nenhum. */
  state: string;
  /** Nome do município selecionado. Vazio se nenhum. */
  city: string;
  onSelectEstado: (sigla: string, id: number) => void;
  onSelectMunicipio: (nome: string, id: number) => void;
}

export default function LocationSelector({
  state,
  city,
  onSelectEstado,
  onSelectMunicipio,
}: Props) {
  const [estadoModal, setEstadoModal] = useState(false);
  const [cidadeModal, setCidadeModal] = useState(false);

  const [estados, setEstados] = useState<Estado[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);

  const [loadingEstados, setLoadingEstados] = useState(false);
  const [loadingCidades, setLoadingCidades] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  // ── Estados ──
  const carregarEstados = useCallback(async () => {
    setLoadingEstados(true);
    setErro(null);
    try {
      setEstados(await fetchEstados());
    } catch {
      setErro('Não foi possível carregar os estados. Verifique sua conexão.');
    } finally {
      // Sempre libera: loading eterno é o padrão de falha
      // mais recorrente neste projeto.
      setLoadingEstados(false);
    }
  }, []);

  // ── Municípios ──
  const carregarMunicipios = useCallback(async (uf: string) => {
    setLoadingCidades(true);
    setErro(null);
    try {
      setMunicipios(await fetchMunicipios(uf));
    } catch {
      setErro('Não foi possível carregar as cidades. Verifique sua conexão.');
      setMunicipios([]);
    } finally {
      setLoadingCidades(false);
    }
  }, []);

  // Pré-carrega os municípios quando já existe estado (modo edição).
  useEffect(() => {
    if (state) carregarMunicipios(state);
  }, [state, carregarMunicipios]);

  function abrirEstados() {
    setEstadoModal(true);
    if (estados.length === 0) carregarEstados();
  }

  function abrirCidades() {
    if (!state) return;
    setBusca('');
    setCidadeModal(true);
    if (municipios.length === 0) carregarMunicipios(state);
  }

  function escolherEstado(estado: Estado) {
    onSelectEstado(estado.sigla, estado.id);
    setMunicipios([]);
    setEstadoModal(false);
  }

  function escolherMunicipio(municipio: Municipio) {
    onSelectMunicipio(municipio.nome, municipio.id);
    setCidadeModal(false);
  }

  function tentarNovamente() {
    limparCacheIbge();
    if (cidadeModal && state) carregarMunicipios(state);
    else carregarEstados();
  }

  // Filtra em memória — sem chamada de rede a cada tecla.
  const municipiosFiltrados = useMemo(
    () => filtrarMunicipios(municipios, busca),
    [municipios, busca],
  );

  function renderConteudo(
    carregando: boolean,
    vazio: boolean,
    mensagemVazio: string,
    children: React.ReactNode,
  ) {
    if (carregando) {
      return (
        <View style={styles.centro}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      );
    }
    if (erro) {
      return (
        <View style={styles.centro}>
          <Text style={styles.erroTexto}>{erro}</Text>
          <TouchableOpacity style={styles.retry} onPress={tentarNovamente} activeOpacity={0.85}>
            <Text style={styles.retryTexto}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (vazio) {
      return (
        <View style={styles.centro}>
          <Text style={styles.vazioTexto}>{mensagemVazio}</Text>
        </View>
      );
    }
    return <>{children}</>;
  }

  return (
    <View>
      {/* Estado */}
      <Text style={styles.label}>Estado *</Text>
      <TouchableOpacity style={styles.seletor} onPress={abrirEstados} activeOpacity={0.85}>
        <Text style={[styles.seletorTexto, !state && styles.seletorPlaceholder]}>
          {state || 'Selecione seu estado'}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {/* Cidade */}
      <Text style={styles.label}>Cidade *</Text>
      <TouchableOpacity
        style={[styles.seletor, !state && styles.seletorDesabilitado]}
        onPress={abrirCidades}
        disabled={!state}
        activeOpacity={0.85}
      >
        <Text style={[styles.seletorTexto, !city && styles.seletorPlaceholder]}>
          {city || (state ? 'Selecione sua cidade' : 'Escolha o estado primeiro')}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {/* Modal — Estado */}
      <Modal
        visible={estadoModal}
        animationType="slide"
        transparent
        onRequestClose={() => setEstadoModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.painel}>
            <View style={styles.painelHeader}>
              <Text style={styles.painelTitulo}>Selecione o estado</Text>
              <TouchableOpacity onPress={() => setEstadoModal(false)} hitSlop={12}>
                <Text style={styles.fechar}>✕</Text>
              </TouchableOpacity>
            </View>

            {renderConteudo(
              loadingEstados,
              estados.length === 0,
              'Nenhum estado disponível.',
              <FlatList
                data={estados}
                keyExtractor={item => String(item.id)}
                initialNumToRender={12}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.item}
                    onPress={() => escolherEstado(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.itemSigla}>{item.sigla}</Text>
                    <Text style={styles.itemNome}>{item.nome}</Text>
                  </TouchableOpacity>
                )}
              />,
            )}
          </View>
        </View>
      </Modal>

      {/* Modal — Cidade */}
      <Modal
        visible={cidadeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setCidadeModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.painel}>
            <View style={styles.painelHeader}>
              <Text style={styles.painelTitulo}>Selecione a cidade</Text>
              <TouchableOpacity onPress={() => setCidadeModal(false)} hitSlop={12}>
                <Text style={styles.fechar}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.busca}
              placeholder="Buscar cidade..."
              placeholderTextColor={colors.gray}
              value={busca}
              onChangeText={setBusca}
              autoCorrect={false}
            />

            {renderConteudo(
              loadingCidades,
              municipiosFiltrados.length === 0,
              busca
                ? `Nenhuma cidade encontrada para "${busca}".`
                : 'Nenhuma cidade disponível.',
              <FlatList
                data={municipiosFiltrados}
                keyExtractor={item => String(item.id)}
                initialNumToRender={15}
                windowSize={10}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.item}
                    onPress={() => escolherMunicipio(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.itemNome}>{item.nome}</Text>
                  </TouchableOpacity>
                )}
              />,
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.grayLight,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.xs,
    letterSpacing: 1,
  },
  seletor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  seletorDesabilitado: { opacity: 0.5 },
  seletorTexto: { color: colors.white, fontSize: fonts.sizes.md, flex: 1 },
  seletorPlaceholder: { color: colors.gray },
  chevron: { color: colors.gold, fontSize: fonts.sizes.xl },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  painel: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: '80%',
    minHeight: '55%',
    borderTopWidth: 1,
    borderColor: colors.gold + '44',
  },
  painelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayDark,
  },
  painelTitulo: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  fechar: { color: colors.gray, fontSize: fonts.sizes.xl },

  busca: {
    backgroundColor: colors.surface,
    color: colors.white,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    margin: spacing.md,
    fontSize: fonts.sizes.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.grayDark + '55',
  },
  itemSigla: {
    color: colors.gold,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    width: 32,
  },
  itemNome: { color: colors.white, fontSize: fonts.sizes.md, flex: 1 },

  centro: { paddingVertical: spacing.xl * 2, alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  erroTexto: { color: colors.error, fontSize: fonts.sizes.sm, textAlign: 'center', lineHeight: 20 },
  vazioTexto: { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center' },
  retry: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.gold + '22',
  },
  retryTexto: { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
});