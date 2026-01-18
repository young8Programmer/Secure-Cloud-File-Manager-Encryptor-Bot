import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly saltLength = 32;
  private readonly tagLength = 16;
  private readonly iterations = 100000;

  /**
   * Generate encryption key using PBKDF2
   */
  generateKey(password?: string): Buffer {
    if (password) {
      const salt = randomBytes(this.saltLength);
      return pbkdf2Sync(password, salt, this.iterations, this.keyLength, 'sha256');
    }
    return randomBytes(this.keyLength);
  }

  /**
   * Encrypt file buffer
   */
  encryptBuffer(buffer: Buffer, key: Buffer): { encrypted: Buffer; iv: string; tag: string } {
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, key, iv);

    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  /**
   * Decrypt file buffer
   */
  decryptBuffer(
    encryptedBuffer: Buffer,
    key: Buffer,
    iv: string,
    tag: string,
  ): Buffer {
    const ivBuffer = Buffer.from(iv, 'base64');
    const tagBuffer = Buffer.from(tag, 'base64');

    const decipher = createDecipheriv(this.algorithm, key, ivBuffer);
    decipher.setAuthTag(tagBuffer);

    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  }

  /**
   * Encrypt file and save to disk
   */
  async encryptFile(
    filePath: string,
    outputPath: string,
    key: Buffer,
  ): Promise<{ iv: string; tag: string }> {
    const fileBuffer = await fs.readFile(filePath);
    const { encrypted, iv, tag } = this.encryptBuffer(fileBuffer, key);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Write encrypted file
    await fs.writeFile(outputPath, encrypted);

    return { iv, tag };
  }

  /**
   * Decrypt file from disk
   */
  async decryptFile(
    encryptedFilePath: string,
    outputPath: string,
    key: Buffer,
    iv: string,
    tag: string,
  ): Promise<void> {
    const encryptedBuffer = await fs.readFile(encryptedFilePath);
    const decrypted = this.decryptBuffer(encryptedBuffer, key, iv, tag);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    await fs.writeFile(outputPath, decrypted);
  }

  /**
   * Encrypt key with master password (optional, for extra security)
   */
  encryptKey(key: Buffer, masterPassword: string): string {
    const salt = randomBytes(this.saltLength);
    const derivedKey = pbkdf2Sync(masterPassword, salt, this.iterations, this.keyLength, 'sha256');
    
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, derivedKey, iv);
    
    const encrypted = Buffer.concat([cipher.update(key), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    // Combine salt + iv + tag + encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      tag,
      encrypted,
    ]);
    
    return combined.toString('base64');
  }

  /**
   * Decrypt key with master password
   */
  decryptKey(encryptedKey: string, masterPassword: string): Buffer {
    const combined = Buffer.from(encryptedKey, 'base64');
    
    const salt = combined.slice(0, this.saltLength);
    const iv = combined.slice(this.saltLength, this.saltLength + this.ivLength);
    const tag = combined.slice(
      this.saltLength + this.ivLength,
      this.saltLength + this.ivLength + this.tagLength,
    );
    const encrypted = combined.slice(this.saltLength + this.ivLength + this.tagLength);
    
    const derivedKey = pbkdf2Sync(masterPassword, salt, this.iterations, this.keyLength, 'sha256');
    
    const decipher = createDecipheriv(this.algorithm, derivedKey, iv);
    decipher.setAuthTag(tag);
    
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
}
