import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';
import { PresenceStreamService } from './presence-stream.service';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [PresenceController],
  providers: [PresenceService, PresenceStreamService],
  exports: [PresenceService, PresenceStreamService],
})
export class PresenceModule {}
