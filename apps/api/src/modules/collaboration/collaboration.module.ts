import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CollaborationController } from './collaboration.controller';
import { InAppNotification } from './entities/in-app-notification.entity';
import { DataConsent } from './entities/data-consent.entity';
import { AgencyReferral } from './entities/agency-referral.entity';
import { PortalInvite } from './entities/portal-invite.entity';
import { ShareView } from './entities/share-view.entity';
import { Household } from '../case/entities/household.entity';
import { Agency } from '../case/entities/agency.entity';
import { FieldVisit } from '../case/entities/field-visit.entity';
import { HouseholdDocument } from '../case/entities/household-document.entity';
import { NotificationsService } from './services/notifications.service';
import { NotificationStreamService } from './services/notification-stream.service';
import { ConsentsService } from './services/consents.service';
import { ReferralsService } from './services/referrals.service';
import { PortalService } from './services/portal.service';
import { FieldChannelService } from './services/field-channel.service';
import { ShareViewsService } from './services/share-views.service';
import { StorageModule } from '../storage/storage.module';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [
    StorageModule,
    PresenceModule,
    TypeOrmModule.forFeature([
      InAppNotification, DataConsent, AgencyReferral, PortalInvite, ShareView,
      Household, Agency, FieldVisit, HouseholdDocument,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m'),
        },
      }),
    }),
  ],
  controllers: [CollaborationController],
  providers: [
    NotificationStreamService,
    NotificationsService,
    ConsentsService,
    ReferralsService,
    PortalService,
    FieldChannelService,
    ShareViewsService,
  ],
  exports: [NotificationsService, ConsentsService, ReferralsService, ShareViewsService, TypeOrmModule],
})
export class CollaborationModule {}
