import React from 'react';
import { View, ViewStyle, ScrollView, ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  scroll?: boolean;
  scrollProps?: ScrollViewProps;
  noTop?: boolean;
  noBottom?: boolean;
}

export default function ScreenContainer({
  children, style, scroll, scrollProps, noTop, noBottom,
}: Props) {
  const insets = useSafeAreaInsets();
  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: noTop ? 0 : insets.top,
    paddingBottom: noBottom ? 0 : insets.bottom,
    ...style,
  };

  if (scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={containerStyle}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}
