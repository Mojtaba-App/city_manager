import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FabricType } from '../entities/fabric-type.entity';
import { CreateFabricTypeDto, UpdateFabricTypeDto } from '../dto/gis.dto';
import { ApiResponse, clampOpacity, normalizeHexColor } from '@city-manager/shared';

@Injectable()
export class FabricTypesService {
  constructor(
    @InjectRepository(FabricType)
    private readonly repo: Repository<FabricType>,
  ) {}

  async findAll(orgId: string): Promise<ApiResponse<FabricType[]>> {
    const data = await this.repo.find({
      where: { organizationId: orgId, isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return { success: true, data };
  }

  async create(orgId: string, dto: CreateFabricTypeDto): Promise<ApiResponse<FabricType>> {
    const entity = this.repo.create({
      organizationId: orgId,
      code: dto.code,
      name: dto.name,
      colorHex: dto.colorHex ? normalizeHexColor(dto.colorHex, '#1a5276') : '#1a5276',
      fillOpacity: dto.fillOpacity != null ? clampOpacity(dto.fillOpacity, 0.35) : 0.35,
      description: dto.description,
      sortOrder: dto.sortOrder ?? 0,
    });
    const data = await this.repo.save(entity);
    return { success: true, data };
  }

  async update(
    orgId: string,
    id: string,
    dto: UpdateFabricTypeDto,
  ): Promise<ApiResponse<FabricType>> {
    const entity = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!entity) throw new NotFoundException('نوع بافت یافت نشد');
    if (dto.name != null) entity.name = dto.name;
    if (dto.colorHex != null) entity.colorHex = normalizeHexColor(dto.colorHex, entity.colorHex);
    if (dto.fillOpacity != null) entity.fillOpacity = clampOpacity(Number(dto.fillOpacity));
    if (dto.description != null) entity.description = dto.description;
    if (dto.isActive != null) entity.isActive = dto.isActive;
    if (dto.sortOrder != null) entity.sortOrder = dto.sortOrder;
    const data = await this.repo.save(entity);
    return { success: true, data };
  }

  async remove(orgId: string, id: string): Promise<ApiResponse<null>> {
    const entity = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!entity) throw new NotFoundException('نوع بافت یافت نشد');
    entity.isActive = false;
    await this.repo.save(entity);
    return { success: true };
  }

  async getOrThrow(orgId: string, id: string): Promise<FabricType> {
    const entity = await this.repo.findOne({ where: { id, organizationId: orgId, isActive: true } });
    if (!entity) throw new BadRequestException('نوع بافت نامعتبر است');
    return entity;
  }
}
