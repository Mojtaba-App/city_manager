import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ApiResponse } from '@city-manager/shared';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
  ) {}

  async findAll(query: PaginationQueryDto): Promise<ApiResponse<Organization[]>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = query.search
      ? [{ name: ILike(`%${query.search}%`) }, { code: ILike(`%${query.search}%`) }]
      : {};

    const [items, total] = await this.orgRepo.findAndCount({
      where,
      skip,
      take: limit,
      order: { name: 'ASC' },
    });

    return { success: true, data: items, meta: { page, limit, total } };
  }

  async findOne(id: string): Promise<ApiResponse<Organization>> {
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) {
      throw new NotFoundException('سازمان یافت نشد');
    }
    return { success: true, data: org };
  }
}
