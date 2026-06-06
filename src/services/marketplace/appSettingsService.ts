// ============================================
// APP SETTINGS SERVICE — MARKETPLACE
//
// Cache local com TTL de 5 minutos.
// Listener independente por chamada — sem variável global.
// ============================================

import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { MARKETPLACE_COLLECTIONS } from '../../core/constants';
import { AppSettings } from '../../shared/types/marketplace';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedSettings: AppSettings | null = null;
let cacheTimestamp = 0;

export const DEFAULT_SETTINGS: AppSettings = {
  marketplaceEnabled: false,
  creatorApprovalRequired: true,
  commissionRate: 0.20,
  minimumWithdrawal: 50,
  maintenanceMode: false,
  maintenanceMessage: 'Marketplace temporariamente em manutenção.',
  maxUploadSizeBytes: 500 * 1024 * 1024,
  maxProductFiles: 5,
  maxPreviewFiles: 3,
  supportEmail: 'suporte@lumina.app',
  termsVersion: '1.0',
  paymentProvider: 'asaas',
  pixExpirationMinutes: 30,
  cardPollingMinutes: 5,
  signedUrlExpirationMinutes: 15,
  defaultPageSize: 20,
};

export async function getAppSettings(): Promise<AppSettings> {
  const now = Date.now();
  if (cachedSettings !== null && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedSettings;
  }
  try {
    const snap = await getDoc(
      doc(db, MARKETPLACE_COLLECTIONS.APP_SETTINGS, 'config')
    );
    if (snap.exists()) {
      cachedSettings = snap.data() as AppSettings;
      cacheTimestamp = now;
      return cachedSettings;
    }
    return DEFAULT_SETTINGS;
  } catch {
    return cachedSettings ?? DEFAULT_SETTINGS;
  }
}

export function listenToAppSettings(
  onUpdate: (settings: AppSettings) => void
): () => void {
  const ref = doc(db, MARKETPLACE_COLLECTIONS.APP_SETTINGS, 'config');
  return onSnapshot(
    ref,
    snap => {
      if (snap.exists()) {
        cachedSettings = snap.data() as AppSettings;
        cacheTimestamp = Date.now();
        onUpdate(cachedSettings);
      } else {
        onUpdate(DEFAULT_SETTINGS);
      }
    },
    error => {
      console.warn('[appSettingsService]', error);
      onUpdate(cachedSettings ?? DEFAULT_SETTINGS);
    }
  );
}

export function invalidateSettingsCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}