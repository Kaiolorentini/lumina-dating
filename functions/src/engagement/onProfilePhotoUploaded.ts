// ============================================
// LUMINA — FOTO DE PERFIL ENVIADA
// functions/src/engagement/onProfilePhotoUploaded.ts
//
// Registra a missão "Atualizar sua foto de perfil" quando uma foto
// termina de subir em profile_photos/{uid}/photo.jpg (caminho do
// photoService). Só esse caminho: as imagens da verificação de
// idade ficam em outra pasta e não contam.
//
// O Storage Rules garante que só o dono grava na própria pasta.
// ============================================

import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { MissionService } from '../gamification/services/MissionService';

const PROFILE_PHOTO_PATH = /^profile_photos\/([^/]+)\/photo\.jpg$/;

// Região do BUCKET, não a padrão do projeto: gatilho de Storage
// precisa estar na mesma região do bucket (us-east1). As demais
// funções continuam em us-central1.
export const onProfilePhotoUploaded = onObjectFinalized(
  { region: 'us-east1' },
  async (event) => {
    const match = PROFILE_PHOTO_PATH.exec(event.data.name ?? '');
    if (!match) return;

    const uid = match[1];
    await MissionService.recordEvent(uid, 'update_photo')
      .catch(error => console.warn('[onProfilePhotoUploaded] missão falhou:', error));
  },
);