/**
 * File Storage Service
 * Handles ad file uploads, storage, and management
 * Supports cloud storage (AWS S3 or Supabase Storage)
 */

import crypto from 'crypto';
import path from 'path';

interface StorageConfig {
  bucket: string;
  region: string;
  maxFileSizeMB: number;
  allowedTypes: string[];
  retentionDays: number;
}

interface FileInfo {
  filename?: string;
  originalname?: string;
  size: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  fileType: string | null;
}

interface FileRecord {
  key: string;
  userId: string;
  originalName: string;
  fileType: string;
  size: number;
  uploadedAt: string;
  expiresAt: string;
  data?: Buffer | string;
}

interface UploadParams {
  userId: string;
  fileData: Buffer | string;
  filename: string;
  fileSize: number;
}

interface UploadResult {
  success: boolean;
  storageKey: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

interface StorageStats {
  totalFiles: number;
  totalSizeBytes: number;
  totalSizeMB: number;
  maxSizeMB: number;
}

// Simulated cloud storage for development
const storageConfig: StorageConfig = {
  bucket: process.env.STORAGE_BUCKET || 'meal-assistant-ads',
  region: process.env.STORAGE_REGION || 'us-east-1',
  maxFileSizeMB: 10,
  allowedTypes: ['PDF', 'JPG', 'JPEG', 'PNG', 'GIF'],
  retentionDays: 90
};

// In-memory storage simulation
const fileStore = new Map<string, FileRecord>();

export class FileStorageService {
  private config: StorageConfig;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...storageConfig, ...config };
  }

  /**
   * Validate file before upload
   */
  validateFile(fileInfo: FileInfo): ValidationResult {
    const errors: string[] = [];

    // Check file type
    const fileType = this.getFileType(fileInfo.filename || fileInfo.originalname || '');
    if (!this.config.allowedTypes.includes(fileType)) {
      errors.push(`Invalid file type. Allowed: ${this.config.allowedTypes.join(', ')}`);
    }

    // Check file size
    const maxSizeBytes = this.config.maxFileSizeMB * 1024 * 1024;
    if (fileInfo.size > maxSizeBytes) {
      errors.push(`File too large. Maximum size: ${this.config.maxFileSizeMB} MB`);
    }

    return {
      valid: errors.length === 0,
      errors,
      fileType: errors.length === 0 ? fileType : null
    };
  }

  /**
   * Extract file type from filename
   */
  getFileType(filename: string): string {
    const ext = path.extname(filename).toUpperCase().replace('.', '');
    return ext === 'JPEG' ? 'JPG' : ext;
  }

  /**
   * Generate a unique storage key for the file
   */
  generateStorageKey(userId: string, filename: string): string {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5')
      .update(`${userId}-${timestamp}-${filename}`)
      .digest('hex')
      .substring(0, 8);
    const ext = path.extname(filename);
    return `ads/${userId}/${timestamp}-${hash}${ext}`;
  }

  /**
   * Upload file to cloud storage
   */
  async uploadFile({ userId, fileData, filename, fileSize }: UploadParams): Promise<UploadResult> {
    // Validate
    const validation = this.validateFile({ filename, size: fileSize });
    if (!validation.valid) {
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
    }

    const storageKey = this.generateStorageKey(userId, filename);

    const fileRecord: FileRecord = {
      key: storageKey,
      userId,
      originalName: filename,
      fileType: validation.fileType!,
      size: fileSize,
      uploadedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.config.retentionDays * 24 * 60 * 60 * 1000).toISOString()
    };

    fileStore.set(storageKey, {
      ...fileRecord,
      data: fileData
    });

    // Generate URL
    const fileUrl = this.generateFileUrl(storageKey);

    return {
      success: true,
      storageKey,
      fileUrl,
      fileType: validation.fileType!,
      fileSize,
      uploadedAt: fileRecord.uploadedAt
    };
  }

  /**
   * Generate a signed URL for file access
   */
  generateFileUrl(storageKey: string, expirySeconds: number = 3600): string {
    const baseUrl = process.env.STORAGE_BASE_URL || 'https://storage.meal-assistant.local';
    const expiry = Date.now() + expirySeconds * 1000;
    const signature = crypto.createHash('sha256')
      .update(`${storageKey}-${expiry}`)
      .digest('hex')
      .substring(0, 16);

    return `${baseUrl}/${storageKey}?expires=${expiry}&sig=${signature}`;
  }

  /**
   * Get file from storage
   */
  async getFile(storageKey: string): Promise<{
    key: string;
    data: Buffer | string;
    fileType: string;
    size: number;
    uploadedAt: string;
  } | null> {
    const file = fileStore.get(storageKey);
    if (!file) {
      return null;
    }

    return {
      key: file.key,
      data: file.data!,
      fileType: file.fileType,
      size: file.size,
      uploadedAt: file.uploadedAt
    };
  }

  /**
   * Delete file from storage
   */
  async deleteFile(storageKey: string): Promise<boolean> {
    return fileStore.delete(storageKey);
  }

  /**
   * Delete expired files (cleanup job)
   */
  async cleanupExpiredFiles(): Promise<{ deletedCount: number; cleanedAt: string }> {
    const now = new Date();
    let deletedCount = 0;

    for (const [key, file] of fileStore.entries()) {
      if (new Date(file.expiresAt) < now) {
        fileStore.delete(key);
        deletedCount++;
      }
    }

    return {
      deletedCount,
      cleanedAt: now.toISOString()
    };
  }

  /**
   * Get user's storage usage
   */
  async getUserStorageStats(userId: string): Promise<StorageStats> {
    let totalFiles = 0;
    let totalSize = 0;

    for (const file of fileStore.values()) {
      if (file.userId === userId) {
        totalFiles++;
        totalSize += file.size || 0;
      }
    }

    return {
      totalFiles,
      totalSizeBytes: totalSize,
      totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      maxSizeMB: this.config.maxFileSizeMB
    };
  }

  /**
   * Compress image before upload (placeholder for actual implementation)
   */
  async compressImage(imageData: Buffer, _options: { maxWidth?: number; quality?: number } = {}): Promise<Buffer> {
    // In production, use sharp or similar library
    return imageData;
  }
}

// Singleton instance
export const fileStorageService = new FileStorageService();
