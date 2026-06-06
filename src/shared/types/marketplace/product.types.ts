// ============================================
// PRODUCT TYPES — MARKETPLACE
// ============================================

export type ProductStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export type ProductCategory =
  | 'fotos'
  | 'videos'
  | 'cursos'
  | 'pdfs'
  | 'outros';

export type ProductFileType = 'pdf' | 'video' | 'image' | 'zip' | 'other';

export interface ProductFile {
  storagePath: string;
  type: ProductFileType;
  name: string;
  size: number;
  mimeType: string;
}

export interface Product {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  price: number;
  isFree: boolean;
  coverImage: string;
  previewImages: string[];
  previewFiles: string[];
  files: ProductFile[];
  category: ProductCategory;
  tags: string[];
  status: ProductStatus;
  isFeatured: boolean;
  isDeleted: boolean;
  averageRating: number;
  reviewsCount: number;
  rejectionReason?: string;
  version: number;
  changelog?: string;
  createdAt: Date;
  updatedAt: Date;
}