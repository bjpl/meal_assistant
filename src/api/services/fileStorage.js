/**
 * File Storage Service
 * Handles ad file uploads, storage, and management
 * Supports cloud storage (AWS S3 or Supabase Storage)
 */

const crypto = require('crypto');
const path = require('path');

// Simulated cloud storage for development
// In production, replace with actual S3 or Supabase client
const storageConfig = {
  bucket: process.env.STORAGE_BUCKET || 'meal-assistant-ads',
  region: process.env.STORAGE_REGION || 'us-east-1',
  maxFileSizeMB: 10,
  allowedTypes: ['PDF', 'JPG', 'JPEG', 'PNG', 'GIF'],
  retentionDays: 90
};

// In-memory storage simulation (replace with actual cloud SDK in production)
const fileStore = new Map();

class FileStorageService {
  constructor(config = {}) {
    this.config = { ...storageConfig, ...config };
  }

  /**
   * Validate file before upload
   * @param {Object} fileInfo - File information
   * @returns {Object} Validation result
   */
  validateFile(fileInfo) {
    const errors = [];

    // Check file type
    const fileType = this.getFileType(fileInfo.filename || fileInfo.originalname);
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
   * @param {string} filename - Original filename
   * @returns {string} File type in uppercase
   */
  getFileType(filename) {
    const ext = path.extname(filename).toUpperCase().replace('.', '');
    return ext === 'JPEG' ? 'JPG' : ext;
  }

  /**
   * Generate a unique storage key for the file
   * @param {string} userId - User ID
   * @param {string} filename - Original filename
   * @returns {string} Unique storage key
   */
  generateStorageKey(userId, filename) {
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
   * @param {Object} params - Upload parameters
   * @param {string} params.userId - User ID
   * @param {Buffer|string} params.fileData - File content
   * @param {string} params.filename - Original filename
   * @param {number} params.fileSize - File size in bytes
   * @returns {Promise<Object>} Upload result with URL
   */
  async uploadFile({ userId, fileData, filename, fileSize }) {
    // Validate
    const validation = this.validateFile({ filename, size: fileSize });
    if (!validation.valid) {
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
    }

    const storageKey = this.generateStorageKey(userId, filename);

    // In production, this would upload to S3/Supabase
    // For now, simulate with in-memory storage
    const fileRecord = {
      key: storageKey,
      userId,
      originalName: filename,
      fileType: validation.fileType,
      size: fileSize,
      uploadedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.config.retentionDays * 24 * 60 * 60 * 1000).toISOString()
    };

    fileStore.set(storageKey, {
      ...fileRecord,
      data: fileData
    });

    // Generate URL (in production, this would be a signed URL)
    const fileUrl = this.generateFileUrl(storageKey);

    return {
      success: true,
      storageKey,
      fileUrl,
      fileType: validation.fileType,
      fileSize,
      uploadedAt: fileRecord.uploadedAt
    };
  }

  /**
   * Generate a signed URL for file access
   * @param {string} storageKey - Storage key
   * @param {number} expirySeconds - URL expiry in seconds (default 1 hour)
   * @returns {string} Signed URL
   */
  generateFileUrl(storageKey, expirySeconds = 3600) {
    // In production, generate actual signed URL
    // For development, return a placeholder URL
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
   * @param {string} storageKey - Storage key
   * @returns {Promise<Object|null>} File data or null
   */
  async getFile(storageKey) {
    const file = fileStore.get(storageKey);
    if (!file) {
      return null;
    }

    return {
      key: file.key,
      data: file.data,
      fileType: file.fileType,
      size: file.size,
      uploadedAt: file.uploadedAt
    };
  }

  /**
   * Delete file from storage
   * @param {string} storageKey - Storage key
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(storageKey) {
    return fileStore.delete(storageKey);
  }

  /**
   * Delete expired files (cleanup job)
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanupExpiredFiles() {
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
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Storage usage stats
   */
  async getUserStorageStats(userId) {
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
   * @param {Buffer} imageData - Original image data
   * @param {Object} options - Compression options
   * @returns {Promise<Buffer>} Compressed image data
   */
  async compressImage(imageData, options = {}) {
    // In production, use sharp or similar library
    // const sharp = require('sharp');
    // return sharp(imageData)
    //   .resize(options.maxWidth || 2000)
    //   .jpeg({ quality: options.quality || 85 })
    //   .toBuffer();

    // For now, return original
    return imageData;
  }
}

// Singleton instance
const fileStorageService = new FileStorageService();

module.exports = {
  FileStorageService,
  fileStorageService
};
