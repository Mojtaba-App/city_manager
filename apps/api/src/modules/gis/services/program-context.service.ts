import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegenerationProgram } from '../entities/regeneration-program.entity';

@Injectable()
export class ProgramContextService {
  constructor(
    @InjectRepository(RegenerationProgram)
    private readonly programRepo: Repository<RegenerationProgram>,
  ) {}

  async getDefaultProgramId(orgId: string): Promise<string> {
    let program = await this.programRepo.findOne({
      where: { organizationId: orgId, isActive: true },
      order: { createdAt: 'ASC' },
    });

    if (!program) {
      program = await this.programRepo.save(
        this.programRepo.create({
          organizationId: orgId,
          code: 'default',
          name: 'برنامه پیش‌فرض بازآفرینی',
          isActive: true,
        }),
      );
    }

    return program.id;
  }
}
