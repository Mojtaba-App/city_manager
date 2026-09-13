import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrajectoryController } from './trajectory.controller';
import { LifeTrajectoryRecord } from './entities/life-trajectory-record.entity';
import { TrajectoryRecordVersion } from './entities/trajectory-record-version.entity';
import { ExpertNote } from './entities/expert-note.entity';
import { TrajectoryRecordsService } from './services/trajectory-records.service';
import { ExpertNotesService } from './services/expert-notes.service';
import { CaseModule } from '../case/case.module';
import { FamilyMember } from '../case/entities/family-member.entity';
import { Household } from '../case/entities/household.entity';

@Module({
  imports: [
    CaseModule,
    TypeOrmModule.forFeature([
      LifeTrajectoryRecord, TrajectoryRecordVersion, ExpertNote,
      FamilyMember, Household,
    ]),
  ],
  controllers: [TrajectoryController],
  providers: [TrajectoryRecordsService, ExpertNotesService],
  exports: [TrajectoryRecordsService],
})
export class TrajectoryModule {}
