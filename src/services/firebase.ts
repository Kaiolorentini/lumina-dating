// ============================================
// COMPATIBILIDADE — NÃO REMOVER
//
// Este arquivo re-exporta do novo local.
// Mantém compatibilidade com imports antigos.
// Migre gradualmente para:
// import { auth, db } from '../core/firebase';
// ============================================

export { auth, db, default } from '../core/firebase';