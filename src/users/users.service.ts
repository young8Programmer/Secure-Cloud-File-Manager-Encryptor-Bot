import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Get or create user from Telegram
   */
  async getOrCreateUser(telegramUser: any): Promise<User> {
    let user = await this.userRepository.findOne({
      where: { telegramId: telegramUser.id },
    });

    if (!user) {
      user = this.userRepository.create({
        telegramId: telegramUser.id,
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
      });
      user = await this.userRepository.save(user);
    } else {
      // Update user info
      user.username = telegramUser.username;
      user.firstName = telegramUser.first_name;
      user.lastName = telegramUser.last_name;
      user = await this.userRepository.save(user);
    }

    return user;
  }

  /**
   * Get user by Telegram ID
   */
  async getUserByTelegramId(telegramId: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { telegramId },
    });
  }
}
