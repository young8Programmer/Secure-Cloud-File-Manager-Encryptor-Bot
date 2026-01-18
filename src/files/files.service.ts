import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { File } from '../database/entities/file.entity';
import { User } from '../database/entities/user.entity';
import { CryptoService } from '../crypto/crypto.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';

@Injectable()
export class FilesService {
  private readonly storagePath: string;
  private readonly masterPassword: string;
  private readonly presignedTokenLength = 32;

  constructor(
    @InjectRepository(File)
    private fileRepository: Repository<File>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private cryptoService: CryptoService,
    private configService: ConfigService,
  ) {
    this.storagePath = this.configService.get('STORAGE_PATH', './storage/files');
    this.masterPassword = this.configService.get('MASTER_PASSWORD', 'default-master-password-change-me');
    
    // Ensure storage directory exists
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
    } catch (error) {
      console.error('Failed to create storage directory:', error);
    }
  }

  /**
   * Upload and encrypt file
   */
  async uploadFile(
    userId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    folderId?: string,
    expiresAt?: Date,
  ): Promise<File> {
    // Check storage quota
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.usedStorage + fileBuffer.length > user.storageLimit) {
      throw new ForbiddenException('Storage quota exceeded');
    }

    // Generate encryption key
    const encryptionKey = this.cryptoService.generateKey();

    // Create encrypted filename
    const fileId = randomBytes(16).toString('hex');
    const encryptedFileName = `enc_${fileId}.dat`;
    const encryptedFilePath = path.join(this.storagePath, userId, encryptedFileName);

    // Encrypt file
    const tempFilePath = path.join(this.storagePath, 'temp', `${fileId}_${originalName}`);
    await fs.mkdir(path.dirname(tempFilePath), { recursive: true });
    await fs.writeFile(tempFilePath, fileBuffer);

    const { iv, tag } = await this.cryptoService.encryptFile(
      tempFilePath,
      encryptedFilePath,
      encryptionKey,
    );

    // Clean up temp file
    await fs.unlink(tempFilePath).catch(() => {});

    // Encrypt and store the key
    const encryptedKey = this.cryptoService.encryptKey(encryptionKey, this.masterPassword);

    // Save file record
    const file = this.fileRepository.create({
      originalName,
      encryptedName: encryptedFileName,
      mimeType,
      size: fileBuffer.length,
      encryptionKey: encryptedKey,
      iv,
      tag,
      userId,
      folderId: folderId || null,
      expiresAt: expiresAt || null,
    });

    const savedFile = await this.fileRepository.save(file);

    // Update user storage
    user.usedStorage += fileBuffer.length;
    await this.userRepository.save(user);

    return savedFile;
  }

  /**
   * Download and decrypt file
   */
  async downloadFile(fileId: string, userId: string): Promise<{
    buffer: Buffer;
    originalName: string;
    mimeType: string;
  }> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId, userId, isDeleted: false },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check expiration
    if (file.expiresAt && file.expiresAt < new Date()) {
      throw new BadRequestException('File has expired');
    }

    // Decrypt key
    const encryptionKey = this.cryptoService.decryptKey(file.encryptionKey, this.masterPassword);

    // Read encrypted file
    const encryptedFilePath = path.join(this.storagePath, file.userId, file.encryptedName);
    const encryptedBuffer = await fs.readFile(encryptedFilePath);

    // Decrypt file
    const decryptedBuffer = this.cryptoService.decryptBuffer(
      encryptedBuffer,
      encryptionKey,
      file.iv,
      file.tag,
    );

    return {
      buffer: decryptedBuffer,
      originalName: file.originalName,
      mimeType: file.mimeType,
    };
  }

  /**
   * Generate presigned URL token (temporary download link)
   */
  async generatePresignedToken(fileId: string, userId: string, expiresInMinutes = 5): Promise<string> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId, userId, isDeleted: false },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const token = randomBytes(this.presignedTokenLength).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    file.presignedToken = token;
    file.presignedExpiresAt = expiresAt;
    await this.fileRepository.save(file);

    return token;
  }

  /**
   * Download file using presigned token
   */
  async downloadFileByToken(token: string): Promise<{
    buffer: Buffer;
    originalName: string;
    mimeType: string;
  }> {
    const file = await this.fileRepository.findOne({
      where: { presignedToken: token, isDeleted: false },
    });

    if (!file) {
      throw new NotFoundException('Invalid token');
    }

    if (!file.presignedExpiresAt || file.presignedExpiresAt < new Date()) {
      throw new BadRequestException('Token has expired');
    }

    // Clear token after use
    file.presignedToken = null;
    file.presignedExpiresAt = null;
    await this.fileRepository.save(file);

    return this.downloadFile(file.id, file.userId);
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string, userId: string): Promise<void> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId, userId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Delete physical file
    const encryptedFilePath = path.join(this.storagePath, file.userId, file.encryptedName);
    await fs.unlink(encryptedFilePath).catch(() => {});

    // Update user storage
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      user.usedStorage = Math.max(0, user.usedStorage - file.size);
      await this.userRepository.save(user);
    }

    // Delete database record
    await this.fileRepository.remove(file);
  }

  /**
   * Get user files
   */
  async getUserFiles(userId: string, folderId?: string): Promise<File[]> {
    return this.fileRepository.find({
      where: {
        userId,
        folderId: folderId || null,
        isDeleted: false,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get expired files for cleanup
   */
  async getExpiredFiles(): Promise<File[]> {
    return this.fileRepository.find({
      where: {
        expiresAt: MoreThan(new Date(0)),
        isDeleted: false,
      },
    });
  }

  /**
   * Cleanup expired files (called by scheduler)
   */
  async cleanupExpiredFiles(): Promise<number> {
    const expiredFiles = await this.fileRepository
      .createQueryBuilder('file')
      .where('file.expiresAt IS NOT NULL')
      .andWhere('file.expiresAt < :now', { now: new Date() })
      .andWhere('file.isDeleted = :isDeleted', { isDeleted: false })
      .getMany();

    let deletedCount = 0;

    for (const file of expiredFiles) {
      try {
        await this.deleteFile(file.id, file.userId);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete expired file ${file.id}:`, error);
      }
    }

    return deletedCount;
  }
}
