import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/shared/components';
import UpdateChecker from './src/components/UpdateChecker';

export default function App() {
  return (
    <ErrorBoundary>
      <AppNavigator />

      {/* Verificador de atualização OTA */}
      <UpdateChecker />
    </ErrorBoundary>
  );
}