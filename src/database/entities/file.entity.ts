import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Folder } from './folder.entity';

@Entity('files')
export class File {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  originalName: string;

  @Column({ type: 'varchar' })
  encryptedName: string; // Encrypted file name on disk

  @Column({ type: 'varchar' })
  mimeType: string;

  @Column({ type: 'bigint' })
  size: number; // bytes

  @Column({ type: 'text' })
  encryptionKey: string; // Encrypted AES key (base64)

  @Column({ type: 'varchar' })
  iv: string; // Initialization vector (base64)

  @Column({ type: 'varchar' })
  tag: string; // Authentication tag (base64)

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  folderId: string;

  @ManyToOne(() => Folder, (folder) => folder.files, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'folderId' })
  folder: Folder;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date; // Auto-delete timestamp

  @Column({ type: 'varchar', nullable: true })
  presignedToken: string; // For temporary download links

  @Column({ type: 'timestamp', nullable: true })
  presignedExpiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Index()
  @Column({ type: 'boolean', default: false })
  isDeleted: boolean; // Soft delete flag
}
