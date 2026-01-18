# 🔐 Secure Cloud File Manager & Encryptor Bot

Professional darajadagi xavfsiz fayl saqlash va shifrlash Telegram boti. Barcha fayllar AES-256-GCM algoritmi bilan shifrlanadi va serverda xavfsiz saqlanadi.

## ✨ Xususiyatlar

- 🔒 **End-to-End Encryption**: Barcha fayllar AES-256-GCM algoritmi bilan shifrlanadi
- 📁 **Virtual Papkalar**: Windows'dagidek papkalar yaratish va boshqarish
- ⏰ **Auto-Delete**: Fayllarga muddat qo'yish va avtomatik o'chirish
- 🔗 **Vaqtinchalik Havolalar**: 5 daqiqa amal qiladigan presigned URLs
- 💾 **Disk Quota**: Foydalanuvchilarga limit qo'yish (default: 100MB)
- 🤖 **Telegram Bot**: To'liq integratsiyalangan bot interfeysi
- 📊 **TypeORM**: PostgreSQL bilan professional database boshqaruvi

## 🛠 Texnik Stack

- **Framework**: NestJS (Modular architecture)
- **Bot Engine**: node-telegram-bot-api
- **Database**: PostgreSQL
- **ORM**: TypeORM
- **Encryption**: Node.js crypto module (AES-256-GCM)
- **Storage**: Local disk (AWS S3 integratsiyasi mumkin)

## 📂 Loyiha Strukturasi

```
src/
├── bot/                # Telegram bot komandalari va eventlari
├── crypto/             # Shifrlash/deşifrlash servisi (AES-256-GCM)
├── files/              # Fayllar bilan ishlash (Upload/Download/Delete)
├── folders/            # Virtual papkalar boshqaruvi
├── users/              # Foydalanuvchi boshqaruvi
├── quota/              # Disk kvotasi boshqaruvi
├── database/           # TypeORM entities va konfiguratsiya
├── tasks/              # Scheduled tasks (auto-delete)
└── main.ts             # Application entry point
```

## 🚀 O'rnatish va Ishga Tushirish

### 1. Loyihani klonlash va dependency'larni o'rnatish

```bash
npm install
```

### 2. Environment konfiguratsiyasi

`.env` faylini yarating va `.env.example` dagi ma'lumotlarni to'ldiring:

```bash
cp .env.example .env
```

**Muhim**: `.env` faylida quyidagilarni o'zgartiring:

- `TELEGRAM_BOT_TOKEN`: [@BotFather](https://t.me/botfather) dan olingan bot token
- `MASTER_PASSWORD`: Xavfsiz random parol (encryption key'lar uchun)
- `DB_*`: PostgreSQL ma'lumotlari

### 3. PostgreSQL bazasini sozlash

PostgreSQL server'ini ishga tushiring va bazani yarating:

```sql
CREATE DATABASE secure_file_manager;
```

### 4. Database migration'larni ishga tushirish

```bash
npm run migration:run
```

Yoki `synchronize: true` rejimida (development):

```bash
npm run start:dev
```

### 5. Botni ishga tushirish

```bash
# Development rejimi
npm run start:dev

# Production rejimi
npm run build
npm run start:prod
```

## 📱 Botdan Foydalanish

### Asosiy Komandalar

- `/start` - Botni boshlash
- `/help` - Yordam
- `/upload` - Fayl yuklash (fayl yuboring)
- `/folders` - Papkalarni ko'rish
- `/files` - Fayllarni ko'rish
- `/createfolder` - Yangi papka yaratish
- `/deletefile` - Fayl o'chirish
- `/quota` - Disk kvotasi

### Fayl Yuklash

1. Botga fayl yuboring (rasm, hujjat, va h.k.)
2. Fayl avtomatik shifrlanadi va saqlanadi
3. Bot fayl ID'sini qaytaradi

### Papka Yaratish

1. `/createfolder` komandasini bosing
2. Papka nomini kiriting
3. Papka yaratiladi

### Faylni Yuklab Olish

1. `/files` - Fayllarni ko'rish
2. Kerakli faylni tanlang
3. Fayl deşifrlanib yuklab olinadi

### Vaqtinchalik Havola

1. Fayllar ro'yxatidan "Link" tugmasini bosing
2. 5 daqiqa amal qiladigan havola olinadi

## 🔐 Xavfsizlik

- **AES-256-GCM**: Industry-standard shifrlash algoritmi
- **Key Management**: Har bir fayl uchun alohida encryption key
- **Master Password**: Key'lar master password bilan qo'shimcha shifrlanadi
- **Secure Storage**: Shifrlangan fayllar diskda alohida saqlanadi

## 📊 Database Schema

### Users
- `id` (UUID)
- `telegramId` (BigInt, unique)
- `username`, `firstName`, `lastName`
- `usedStorage` (bytes)
- `storageLimit` (bytes, default: 100MB)

### Folders
- `id` (UUID)
- `name`
- `parentId` (UUID, nullable)
- `userId` (UUID, foreign key)

### Files
- `id` (UUID)
- `originalName`
- `encryptedName` (diskda saqlanadigan nom)
- `mimeType`
- `size` (bytes)
- `encryptionKey` (encrypted, base64)
- `iv` (initialization vector, base64)
- `userId` (UUID, foreign key)
- `folderId` (UUID, nullable, foreign key)
- `expiresAt` (timestamp, nullable)
- `presignedToken` (temporary download token)
- `presignedExpiresAt` (token expiration)

## 🔄 Auto-Delete

Fayllarga `expiresAt` qo'yish orqali avtomatik o'chirishni sozlashingiz mumkin. Bot har soat expired fayllarni tozalaydi.

## 🧪 Development

```bash
# Development rejimi (hot reload)
npm run start:dev

# Build
npm run build

# Linting
npm run lint

# Testing
npm run test
```

## 📝 Migration Commands

```bash
# Migration yaratish
npm run migration:generate -- src/database/migrations/MigrationName

# Migration ishga tushirish
npm run migration:run

# Migration'ni qaytarish
npm run migration:revert
```

## ⚙️ Konfiguratsiya

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (required) | - |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_USERNAME` | Database username | postgres |
| `DB_PASSWORD` | Database password | postgres |
| `DB_NAME` | Database name | secure_file_manager |
| `MASTER_PASSWORD` | Encryption master password | - |
| `STORAGE_PATH` | File storage path | ./storage/files |
| `PORT` | Application port | 3000 |
| `APP_URL` | Application URL (for presigned links) | http://localhost:3000 |
| `NODE_ENV` | Environment (development/production) | development |

## 🐛 Xatoliklarni Tuzatish

### Database xatoliklari

- PostgreSQL server ishlashi kerak
- Database yaratilgan bo'lishi kerak
- `.env` dagi ma'lumotlar to'g'ri bo'lishi kerak

### Bot ishlamayapti

- `TELEGRAM_BOT_TOKEN` to'g'ri bo'lishi kerak
- Internet aloqasi bo'lishi kerak
- Bot @BotFather dan to'g'ri sozlangan bo'lishi kerak

## 📄 Lisensiya

MIT

## 👨‍💻 Yaratuvchi

Professional darajadagi secure file manager bot.

---

**Diqqat**: Production uchun `MASTER_PASSWORD` ni xavfsiz random parol bilan almashtiring!
