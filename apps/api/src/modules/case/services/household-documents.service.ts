import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { HouseholdDocument } from '../entities/household-document.entity';
import { HouseholdAssignmentService } from './household-assignment.service';
import { ObjectStorageService } from '../../storage/object-storage.service';
import { ApiResponse } from '@city-manager/shared';

export const HOUSEHOLD_DOC_MAX_FILE_SIZE = 15 * 1024 * 1024;
export const HOUSEHOLD_DOC_ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

@Injectable()
export class HouseholdDocumentsService {
  constructor(
    @InjectRepository(HouseholdDocument)
    private readonly repo: Repository<HouseholdDocument>,
    private readonly households: HouseholdAssignmentService,
    private readonly storage: ObjectStorageService,
  ) {}

  async list(orgId: string, householdId: string): Promise<ApiResponse<HouseholdDocument[]>> {
    await this.households.requireHousehold(orgId, householdId);
    const items = await this.repo.find({
      where: { organizationId: orgId, householdId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return { success: true, data: items };
  }

  async upload(
    orgId: string,
    userId: string,
    householdId: string,
    file: Express.Multer.File,
    meta: { title: string; category?: string },
  ): Promise<ApiResponse<HouseholdDocument>> {
    await this.households.requireHousehold(orgId, householdId);
    if (!file) throw new NotFoundException('فایل الزامی است');
    if (file.size > HOUSEHOLD_DOC_MAX_FILE_SIZE) {
      throw new BadRequestException('حداکثر حجم فایل ۱۵ مگابایت است');
    }
    const contentType = file.mimetype || 'application/octet-stream';
    if (!HOUSEHOLD_DOC_ALLOWED_TYPES.has(contentType)) {
      throw new BadRequestException('نوع فایل مجاز نیست');
    }

    const safeName = path.basename(file.originalname).replace(/[^\w.\-آ-ی()+\s]/gi, '_').slice(0, 200);
    const key = `${orgId}/households/${householdId}/${randomUUID()}-${safeName}`;
    await this.storage.putObject(key, file.buffer, contentType);

    const entity = this.repo.create({
      organizationId: orgId,
      householdId,
      title: meta.title.trim(),
      category: meta.category ?? 'other',
      fileName: safeName,
      contentType,
      fileSize: String(file.size),
      storageKey: key,
      uploadedBy: userId,
    });
    const saved = await this.repo.save(entity);
    return { success: true, data: saved };
  }

  async getDownload(orgId: string, householdId: string, documentId: string) {
    const doc = await this.requireDoc(orgId, householdId, documentId);
    const buffer = await this.storage.getObjectBuffer(doc.storageKey);
    return { doc, buffer };
  }

  async softDelete(orgId: string, householdId: string, documentId: string): Promise<ApiResponse<{ id: string }>> {
    const doc = await this.requireDoc(orgId, householdId, documentId);
    await this.repo.softRemove(doc);
    return { success: true, data: { id: documentId } };
  }

  private async requireDoc(orgId: string, householdId: string, documentId: string): Promise<HouseholdDocument> {
    const doc = await this.repo.findOne({
      where: { id: documentId, organizationId: orgId, householdId, deletedAt: IsNull() },
    });
    if (!doc) throw new NotFoundException('سند یافت نشد');
    return doc;
  }
}
