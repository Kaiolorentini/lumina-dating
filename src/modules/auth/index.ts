// ============================================
// BARREL EXPORT — módulo auth
// Importa de um lugar só:
// import { LoginScreen } from '../modules/auth';
// ============================================

export { default as LoginScreen } from './screens/LoginScreen';
export { default as RegisterScreen } from './screens/RegisterScreen';
export { useLoginForm, useRegisterForm } from './hooks/useAuthForm';
export * from './services/authService';