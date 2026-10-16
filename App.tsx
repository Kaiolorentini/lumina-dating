import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/shared/components';
import WebFrame from './src/components/web/WebFrame';
import WebAlertHost from './src/components/web/WebAlertHost';

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
    //
    // WebFrame e WebAlertHost (13/10/2026) só fazem algo no navegador:
    // coluna central no PC e Alert.alert de verdade (o react-native-web
    // o deixa vazio). No Android/iOS são transparentes — WebFrame
    // devolve as telas sem View extra e WebAlertHost não desenha nada.
    <SafeAreaProvider>
      <ErrorBoundary>
        <WebFrame>
          <AppNavigator />
        </WebFrame>
        <WebAlertHost />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}