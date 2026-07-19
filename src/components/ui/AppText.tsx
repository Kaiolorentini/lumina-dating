import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';

/**
 * Text wrapper global para acessibilidade de Fonte (Font Scale).
 * O allowFontScaling=true (padrão do RN) já faz o texto reagir ao
 * tamanho de fonte do sistema. Este wrapper centraliza o padrão.
 */
interface AppTextProps extends TextProps {
  style?: TextStyle | TextStyle[];
}

export function AppText({ style, ...rest }: AppTextProps) {
  return <Text allowFontScaling style={style} {...rest} />;
}

export default AppText;
