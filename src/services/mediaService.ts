import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { uploadMidia } from './storageService';

export interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  isLocked: boolean;
  uploadedBy: string;
  uploaderName: string;
  uploaderPhoto: string;
  timestamp: Date;
  unlockedBy: string[];
}

export async function uploadMedia(
  userId: string,
  uri: string,
  type: 'image' | 'video',
  uploaderName: string,
  uploaderPhoto: string,
  isLocked: boolean = true
): Promise<MediaItem> {
  // Upload para ImgBB — sem CORS
  const url = await uploadMidia(userId, uri);

  // Salva referência no Firestore
  const mediaRef = await addDoc(collection(db, 'mediaItems'), {
    url,
    type,
    isLocked,
    uploadedBy: userId,
    uploaderName,
    uploaderPhoto,
    unlockedBy: [],
    timestamp: serverTimestamp(),
  });

  return {
    id: mediaRef.id,
    url,
    type,
    isLocked,
    uploadedBy: userId,
    uploaderName,
    uploaderPhoto,
    timestamp: new Date(),
    unlockedBy: [],
  };
}

export async function getMediaItems(): Promise<MediaItem[]> {
  const q = query(
    collection(db, 'mediaItems'),
    orderBy('timestamp', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    url: doc.data().url,
    type: doc.data().type,
    isLocked: doc.data().isLocked,
    uploadedBy: doc.data().uploadedBy,
    uploaderName: doc.data().uploaderName,
    uploaderPhoto: doc.data().uploaderPhoto,
    timestamp: doc.data().timestamp?.toDate() || new Date(),
    unlockedBy: doc.data().unlockedBy || [],
  }));
}

export async function unlockMediaItem(
  itemId: string,
  userId: string
): Promise<void> {
  const itemRef = doc(db, 'mediaItems', itemId);
  const itemSnap = await getDoc(itemRef);

  if (itemSnap.exists()) {
    const unlockedBy = itemSnap.data().unlockedBy || [];
    if (!unlockedBy.includes(userId)) {
      await setDoc(itemRef, {
        unlockedBy: [...unlockedBy, userId],
      }, { merge: true });
    }
  }
}

export function isUnlocked(item: MediaItem, userId: string): boolean {
  return item.uploadedBy === userId || item.unlockedBy.includes(userId);
}