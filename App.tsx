import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/shared/components';

export default function App() {
  return (
    // SafeAreaProvider precisa envolver TODA a árvore: ScreenContainer
    // e TabNavigator chamam useSafeAreaInsets(). Sem ele, telas fora
    // dos navegadores do React Navigation (que trazem o próprio
    // contexto) quebram com "No safe area value available".
    // O UpdateChecker vive no AppNavigator (AppContent), que só
    // monta com usuário autenticado. Aqui ele rodava também na
    // splash e no login — duas verificações de OTA por sessão, e
    // um eventual prompt de reload no meio da entrada do usuário.
    <SafeAreaProvider>
      <ErrorBoundary>
        <AppNavigator />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}