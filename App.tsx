import React from 'react';
import { Text } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/shared/components';
import UpdateChecker from './src/components/UpdateChecker';
import { ToastProvider } from './src/components/ui';

// Acessibilidade: respeita o tamanho de fonte do sistema (Font Scale).
// O React Native já aplica font scaling por padrão; garantimos o padrão global.
(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.allowFontScaling = true;

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppNavigator />

        {/* Verificador de atualização OTA */}
        <UpdateChecker />
      </ToastProvider>
    </ErrorBoundary>
  );
}