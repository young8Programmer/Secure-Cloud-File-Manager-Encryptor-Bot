import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';

@Injectable()
export class QuotaService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Get user storage quota info
   */
  async getUserQuota(userId: string): Promise<{
    used: number;
    limit: number;
    available: number;
    percentage: number;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const used = user.usedStorage;
    const limit = user.storageLimit;
    const available = Math.max(0, limit - used);
    const percentage = limit > 0 ? (used / limit) * 100 : 0;

    return {
      used,
      limit,
      available,
      percentage: Math.round(percentage * 100) / 100,
    };
  }

  /**
   * Check if user has enough space
   */
  async checkQuota(userId: string, fileSize: number): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return false;
    }

    return user.usedStorage + fileSize <= user.storageLimit;
  }

  /**
   * Update user storage quota
   */
  async updateQuota(userId: string, newLimit: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    user.storageLimit = newLimit;
    return this.userRepository.save(user);
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
