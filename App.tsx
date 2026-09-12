import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/shared/components';
import UpdateChecker from './src/components/UpdateChecker';

export default function App() {
  return (
    // SafeAreaProvider precisa envolver TODA a árvore: ScreenContainer
    // e TabNavigator chamam useSafeAreaInsets(). Sem ele, telas fora
    // dos navegadores do React Navigation (que trazem o próprio
    // contexto) quebram com "No safe area value available".
    <SafeAreaProvider>
      <ErrorBoundary>
        <AppNavigator />

        {/* Verificador de atualização OTA */}
        <UpdateChecker />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}