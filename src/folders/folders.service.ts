import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Folder } from '../database/entities/folder.entity';
import { User } from '../database/entities/user.entity';

@Injectable()
export class FoldersService {
  constructor(
    @InjectRepository(Folder)
    private folderRepository: Repository<Folder>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Create folder
   */
  async createFolder(
    userId: string,
    name: string,
    parentId?: string,
  ): Promise<Folder> {
    // Check if folder with same name exists in same parent
    const existingFolder = await this.folderRepository.findOne({
      where: {
        userId,
        name,
        parentId: parentId || null,
      },
    });

    if (existingFolder) {
      throw new ConflictException('Folder with this name already exists');
    }

    // Validate parent folder
    if (parentId) {
      const parent = await this.folderRepository.findOne({
        where: { id: parentId, userId },
      });

      if (!parent) {
        throw new NotFoundException('Parent folder not found');
      }
    }

    const folder = this.folderRepository.create({
      name,
      parentId: parentId || null,
      userId,
    });

    return this.folderRepository.save(folder);
  }

  /**
   * Get user folders
   */
  async getUserFolders(userId: string, parentId?: string): Promise<Folder[]> {
    return this.folderRepository.find({
      where: {
        userId,
        parentId: parentId || null,
      },
      order: { name: 'ASC' },
      relations: ['files'],
    });
  }

  /**
   * Get folder tree (nested structure)
   */
  async getFolderTree(userId: string, parentId?: string): Promise<Folder[]> {
    const folders = await this.folderRepository.find({
      where: {
        userId,
        parentId: parentId || null,
      },
      order: { name: 'ASC' },
      relations: ['children', 'files'],
    });

    // Recursively load children
    for (const folder of folders) {
      folder.children = await this.getFolderTree(userId, folder.id);
    }

    return folders;
  }

  /**
   * Get folder by ID
   */
  async getFolderById(folderId: string, userId: string): Promise<Folder> {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, userId },
      relations: ['parent', 'children', 'files'],
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return folder;
  }

  /**
   * Update folder
   */
  async updateFolder(
    folderId: string,
    userId: string,
    name?: string,
    parentId?: string,
  ): Promise<Folder> {
    const folder = await this.getFolderById(folderId, userId);

    if (name) {
      // Check for name conflict
      const existingFolder = await this.folderRepository.findOne({
        where: {
          userId,
          name,
          parentId: folder.parentId,
        },
      });

      if (existingFolder && existingFolder.id !== folderId) {
        throw new ConflictException('Folder with this name already exists');
      }

      folder.name = name;
    }

    if (parentId !== undefined) {
      if (parentId && parentId !== folder.parentId) {
        // Validate parent
        const parent = await this.folderRepository.findOne({
          where: { id: parentId, userId },
        });

        if (!parent) {
          throw new NotFoundException('Parent folder not found');
        }

        // Prevent circular reference
        if (parentId === folderId) {
          throw new ConflictException('Cannot move folder into itself');
        }

        // Check if moving into own descendant
        const descendants = await this.getDescendants(folderId);
        if (descendants.some((d) => d.id === parentId)) {
          throw new ConflictException('Cannot move folder into its own descendant');
        }

        folder.parentId = parentId;
      } else {
        folder.parentId = null;
      }
    }

    return this.folderRepository.save(folder);
  }

  /**
   * Delete folder (cascades to files and subfolders)
   */
  async deleteFolder(folderId: string, userId: string): Promise<void> {
    const folder = await this.getFolderById(folderId, userId);

    // Delete all subfolders recursively
    const children = await this.folderRepository.find({
      where: { parentId: folderId },
    });

    for (const child of children) {
      await this.deleteFolder(child.id, userId);
    }

    await this.folderRepository.remove(folder);
  }

  /**
   * Get all descendants of a folder
   */
  private async getDescendants(folderId: string): Promise<Folder[]> {
    const children = await this.folderRepository.find({
      where: { parentId: folderId },
    });

    const descendants = [...children];

    for (const child of children) {
      const childDescendants = await this.getDescendants(child.id);
      descendants.push(...childDescendants);
    }

    return descendants;
  }
}
