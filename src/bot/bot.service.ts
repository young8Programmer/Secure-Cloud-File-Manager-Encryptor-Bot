import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import TelegramBot from 'node-telegram-bot-api';
import { UsersService } from '../users/users.service';
import { FilesService } from '../files/files.service';
import { FoldersService } from '../folders/folders.service';
import { QuotaService } from '../quota/quota.service';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private bot: TelegramBot;
  private userStates: Map<number, any> = new Map(); // Store user interaction states

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private filesService: FilesService,
    private foldersService: FoldersService,
    private quotaService: QuotaService,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set');
    }

    this.bot = new TelegramBot(token, { polling: true });
  }

  onModuleInit() {
    this.setupCommands();
    this.setupMessageHandlers();
    this.setupCallbackHandlers();
  }

  onModuleDestroy() {
    this.bot.stopPolling();
  }

  private setupCommands() {
    // Start command
    this.bot.onText(/\/start/, async (msg) => {
      const user = await this.usersService.getOrCreateUser(msg.from);
      const welcomeMessage = `
🔐 *Secure Cloud File Manager*

Assalomu alaykum, ${user.firstName || 'Foydalanuvchi'}!

Men sizning fayllaringizni xavfsiz saqlaydigan botman. Barcha fayllar AES-256 algoritmi bilan shifrlanadi.

📋 *Mavjud komandalar:*
/help - Yordam
/upload - Fayl yuklash
/folders - Papkalarni ko'rish
/files - Fayllarni ko'rish
/quota - Disk kvotasi
/createfolder - Yangi papka yaratish
      `;

      await this.bot.sendMessage(msg.chat.id, welcomeMessage, {
        parse_mode: 'Markdown',
      });
    });

    // Help command
    this.bot.onText(/\/help/, async (msg) => {
      const helpMessage = `
📚 *Botdan foydalanish qo'llanmasi*

*Komandalar:*
/start - Botni boshlash
/help - Yordam
/upload - Fayl yuklash (fayl yuboring va /upload yozing)
/folders - Barcha papkalarni ko'rish
/files - Fayllarni ko'rish
/createfolder - Yangi papka yaratish
/deletefile - Fayl o'chirish
/quota - Disk kvotasi va limitlarni ko'rish

*Xususiyatlar:*
🔒 Barcha fayllar AES-256-GCM bilan shifrlanadi
📁 Virtual papkalar yaratish
⏰ Auto-delete (muddati bo'lgan fayllar)
🔗 Vaqtinchalik havolalar (5 daqiqa)
💾 Disk kvotasi boshqaruvi
      `;

      await this.bot.sendMessage(msg.chat.id, helpMessage, {
        parse_mode: 'Markdown',
      });
    });

    // Quota command
    this.bot.onText(/\/quota/, async (msg) => {
      const user = await this.usersService.getUserByTelegramId(msg.from.id);
      if (!user) {
        await this.bot.sendMessage(msg.chat.id, 'Foydalanuvchi topilmadi.');
        return;
      }

      const quota = await this.quotaService.getUserQuota(user.id);
      const quotaMessage = `
💾 *Disk Kvotasi*

Ishlatilgan: ${this.quotaService.formatBytes(quota.used)}
Limit: ${this.quotaService.formatBytes(quota.limit)}
Bo'sh joy: ${this.quotaService.formatBytes(quota.available)}
Foiz: ${quota.percentage.toFixed(2)}%

${quota.percentage >= 90 ? '⚠️ *Diqqat: Diskingiz deyarli to'ldi!*' : ''}
      `;

      await this.bot.sendMessage(msg.chat.id, quotaMessage, {
        parse_mode: 'Markdown',
      });
    });

    // Folders command
    this.bot.onText(/\/folders/, async (msg) => {
      const user = await this.usersService.getUserByTelegramId(msg.from.id);
      if (!user) {
        await this.bot.sendMessage(msg.chat.id, 'Foydalanuvchi topilmadi.');
        return;
      }

      const folders = await this.foldersService.getUserFolders(user.id);
      if (folders.length === 0) {
        await this.bot.sendMessage(msg.chat.id, '📁 Hozircha papkalar mavjud emas.\n/createfolder - Yangi papka yaratish');
        return;
      }

      let foldersList = '📁 *Papkalar:*\n\n';
      folders.forEach((folder, index) => {
        foldersList += `${index + 1}. ${folder.name}\n`;
      });

      await this.bot.sendMessage(msg.chat.id, foldersList, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: folders.map((folder) => [
            {
              text: `📂 ${folder.name}`,
              callback_data: `folder_${folder.id}`,
            },
          ]),
        },
      });
    });

    // Files command
    this.bot.onText(/\/files/, async (msg) => {
      const user = await this.usersService.getUserByTelegramId(msg.from.id);
      if (!user) {
        await this.bot.sendMessage(msg.chat.id, 'Foydalanuvchi topilmadi.');
        return;
      }

      await this.showFiles(msg.chat.id, user.id, null);
    });

    // Create folder command
    this.bot.onText(/\/createfolder/, async (msg) => {
      this.userStates.set(msg.from.id, { action: 'create_folder' });
      await this.bot.sendMessage(
        msg.chat.id,
        '📁 Papka nomini kiriting:',
      );
    });

    // Delete file command
    this.bot.onText(/\/deletefile/, async (msg) => {
      const user = await this.usersService.getUserByTelegramId(msg.from.id);
      if (!user) {
        await this.bot.sendMessage(msg.chat.id, 'Foydalanuvchi topilmadi.');
        return;
      }

      await this.showFilesForDeletion(msg.chat.id, user.id);
    });
  }

  private setupMessageHandlers() {
    // Handle document/file uploads
    this.bot.on('document', async (msg) => {
      const user = await this.usersService.getUserByTelegramId(msg.from.id);
      if (!user) {
        await this.bot.sendMessage(msg.chat.id, 'Foydalanuvchi topilmadi.');
        return;
      }

      try {
        const fileId = msg.document.file_id;
        const fileName = msg.document.file_name || 'unknown';
        const fileSize = msg.document.file_size;

        // Check quota
        if (!(await this.quotaService.checkQuota(user.id, fileSize))) {
          await this.bot.sendMessage(
            msg.chat.id,
            '❌ Disk kvotasi yetarli emas. /quota - Kvotani tekshiring.',
          );
          return;
        }

        await this.bot.sendMessage(
          msg.chat.id,
          '⏳ Fayl yuklanmoqda va shifrlanmoqda...',
        );

        // Download file from Telegram
        const fileStream = this.bot.getFileStream(fileId);
        const chunks: Buffer[] = [];

        for await (const chunk of fileStream) {
          chunks.push(chunk);
        }

        const fileBuffer = Buffer.concat(chunks);

        // Ask for folder (optional)
        const state = this.userStates.get(msg.from.id);
        const folderId = state?.targetFolderId || null;

        // Upload and encrypt
        const uploadedFile = await this.filesService.uploadFile(
          user.id,
          fileBuffer,
          fileName,
          msg.document.mime_type || 'application/octet-stream',
          folderId,
        );

        await this.bot.sendMessage(
          msg.chat.id,
          `✅ Fayl muvaffaqiyatli yuklandi va shifrlandi!\n\n📄 Nomi: ${fileName}\n📊 Hajmi: ${this.quotaService.formatBytes(fileSize)}\n🔒 ID: ${uploadedFile.id}`,
        );

        // Clear state
        this.userStates.delete(msg.from.id);
      } catch (error) {
        console.error('File upload error:', error);
        await this.bot.sendMessage(
          msg.chat.id,
          '❌ Fayl yuklashda xatolik yuz berdi.',
        );
      }
    });

    // Handle photo uploads
    this.bot.on('photo', async (msg) => {
      const user = await this.usersService.getUserByTelegramId(msg.from.id);
      if (!user) {
        return;
      }

      try {
        const photo = msg.photo[msg.photo.length - 1]; // Get largest photo
        const fileId = photo.file_id;
        const fileSize = photo.file_size;

        // Check quota
        if (!(await this.quotaService.checkQuota(user.id, fileSize))) {
          await this.bot.sendMessage(
            msg.chat.id,
            '❌ Disk kvotasi yetarli emas.',
          );
          return;
        }

        await this.bot.sendMessage(
          msg.chat.id,
          '⏳ Rasm yuklanmoqda va shifrlanmoqda...',
        );

        // Download photo
        const fileStream = this.bot.getFileStream(fileId);
        const chunks: Buffer[] = [];

        for await (const chunk of fileStream) {
          chunks.push(chunk);
        }

        const fileBuffer = Buffer.concat(chunks);
        const fileName = `photo_${Date.now()}.jpg`;

        const uploadedFile = await this.filesService.uploadFile(
          user.id,
          fileBuffer,
          fileName,
          'image/jpeg',
        );

        await this.bot.sendMessage(
          msg.chat.id,
          `✅ Rasm muvaffaqiyatli yuklandi va shifrlandi!\n\n📄 Nomi: ${fileName}\n🔒 ID: ${uploadedFile.id}`,
        );
      } catch (error) {
        console.error('Photo upload error:', error);
      }
    });

    // Handle text messages (for folder creation, etc.)
    this.bot.on('message', async (msg) => {
      if (msg.text?.startsWith('/')) {
        return; // Commands are handled separately
      }

      const state = this.userStates.get(msg.from.id);
      if (!state) {
        return;
      }

      if (state.action === 'create_folder') {
        try {
          const user = await this.usersService.getUserByTelegramId(msg.from.id);
          if (!user) {
            return;
          }

          const folder = await this.foldersService.createFolder(
            user.id,
            msg.text!,
            state.parentId || undefined,
          );

          await this.bot.sendMessage(
            msg.chat.id,
            `✅ Papka yaratildi: ${folder.name}`,
          );
          this.userStates.delete(msg.from.id);
        } catch (error: any) {
          await this.bot.sendMessage(
            msg.chat.id,
            `❌ Xatolik: ${error.message}`,
          );
        }
      }
    });
  }

  private setupCallbackHandlers() {
    this.bot.on('callback_query', async (query) => {
      const data = query.data;
      const chatId = query.message!.chat.id;
      const userId = query.from.id;

      const user = await this.usersService.getUserByTelegramId(userId);
      if (!user) {
        return;
      }

      try {
        if (data?.startsWith('folder_')) {
          const folderId = data.replace('folder_', '');
          await this.showFolderContents(chatId, user.id, folderId);
        } else if (data?.startsWith('download_')) {
          const fileId = data.replace('download_', '');
          await this.downloadFile(chatId, user.id, fileId);
        } else if (data?.startsWith('link_')) {
          const fileId = data.replace('link_', '');
          await this.generatePresignedLink(chatId, user.id, fileId);
        } else if (data?.startsWith('delete_')) {
          const fileId = data.replace('delete_', '');
          await this.deleteFile(chatId, user.id, fileId);
        }
      } catch (error: any) {
        await this.bot.sendMessage(chatId, `❌ Xatolik: ${error.message}`);
      }

      await this.bot.answerCallbackQuery(query.id);
    });
  }

  private async showFiles(chatId: number, userId: string, folderId?: string) {
    const files = await this.filesService.getUserFiles(userId, folderId);
    if (files.length === 0) {
      await this.bot.sendMessage(chatId, '📄 Hozircha fayllar mavjud emas.');
      return;
    }

    let filesList = '📄 *Fayllar:*\n\n';
    files.forEach((file, index) => {
      const size = this.quotaService.formatBytes(file.size);
      filesList += `${index + 1}. ${file.originalName} (${size})\n`;
    });

    const keyboard = {
      inline_keyboard: files.map((file) => [
        {
          text: `📥 ${file.originalName}`,
          callback_data: `download_${file.id}`,
        },
        {
          text: '🔗 Link',
          callback_data: `link_${file.id}`,
        },
      ]),
    };

    await this.bot.sendMessage(chatId, filesList, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  private async showFolderContents(
    chatId: number,
    userId: string,
    folderId: string,
  ) {
    const folder = await this.foldersService.getFolderById(folderId, userId);
    const files = await this.filesService.getUserFiles(userId, folderId);

    let message = `📂 *${folder.name}*\n\n`;
    if (files.length > 0) {
      message += '📄 *Fayllar:*\n';
      files.forEach((file) => {
        message += `• ${file.originalName}\n`;
      });
    } else {
      message += 'Papka bo\'sh.';
    }

    const keyboard = {
      inline_keyboard: files.map((file) => [
        {
          text: `📥 ${file.originalName}`,
          callback_data: `download_${file.id}`,
        },
      ]),
    };

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  private async downloadFile(
    chatId: number,
    userId: string,
    fileId: string,
  ) {
    try {
      await this.bot.sendMessage(chatId, '⏳ Fayl yuklab olinmoqda va deşifrlanmoqda...');

      const { buffer, originalName, mimeType } =
        await this.filesService.downloadFile(fileId, userId);

      // Save to temp file
      const tempPath = path.join(process.cwd(), 'storage', 'temp', originalName);
      await fs.mkdir(path.dirname(tempPath), { recursive: true });
      await fs.writeFile(tempPath, buffer);

      // Send file
      await this.bot.sendDocument(chatId, tempPath, {
        caption: `✅ Fayl deşifrlandi: ${originalName}`,
      });

      // Cleanup
      await fs.unlink(tempPath).catch(() => {});
    } catch (error: any) {
      await this.bot.sendMessage(chatId, `❌ Xatolik: ${error.message}`);
    }
  }

  private async generatePresignedLink(
    chatId: number,
    userId: string,
    fileId: string,
  ) {
    try {
      const token = await this.filesService.generatePresignedToken(
        fileId,
        userId,
        5,
      );

      const baseUrl = this.configService.get('APP_URL', 'http://localhost:3000');
      const link = `${baseUrl}/download/${token}`;

      await this.bot.sendMessage(
        chatId,
        `🔗 Vaqtinchalik havola (5 daqiqa amal qiladi):\n${link}`,
      );
    } catch (error: any) {
      await this.bot.sendMessage(chatId, `❌ Xatolik: ${error.message}`);
    }
  }

  private async deleteFile(chatId: number, userId: string, fileId: string) {
    try {
      await this.filesService.deleteFile(fileId, userId);
      await this.bot.sendMessage(chatId, '✅ Fayl o\'chirildi.');
    } catch (error: any) {
      await this.bot.sendMessage(chatId, `❌ Xatolik: ${error.message}`);
    }
  }

  private async showFilesForDeletion(chatId: number, userId: string) {
    const files = await this.filesService.getUserFiles(userId);
    if (files.length === 0) {
      await this.bot.sendMessage(chatId, '📄 O\'chirish uchun fayllar mavjud emas.');
      return;
    }

    const keyboard = {
      inline_keyboard: files.map((file) => [
        {
          text: `🗑 ${file.originalName}`,
          callback_data: `delete_${file.id}`,
        },
      ]),
    };

    await this.bot.sendMessage(chatId, '🗑 O\'chirish uchun faylni tanlang:', {
      reply_markup: keyboard,
    });
  }
}
