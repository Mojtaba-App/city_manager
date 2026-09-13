import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Sse,
  ParseUUIDPipe, ForbiddenException, BadRequestException, UploadedFile, UseInterceptors,
  HttpCode, HttpStatus, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions, PermissionsAnyOf, Public } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audited } from '../../common/decorators/audit.decorator';
import { Permission, JwtPayload } from '@city-manager/shared';
import { NotificationsService } from './services/notifications.service';
import { ConsentsService } from './services/consents.service';
import { ReferralsService } from './services/referrals.service';
import { PortalService } from './services/portal.service';
import { FieldChannelService } from './services/field-channel.service';
import { NotificationStreamService } from './services/notification-stream.service';
import { ShareViewsService } from './services/share-views.service';
import {
  CreateConsentDto, GrantConsentDto, CreateReferralDto, UpdateReferralStatusDto,
  AttachReferralConsentDto, CreatePortalInviteDto, PortalRedeemDto, FieldCompleteDto,
} from './dto/collaboration.dto';
import { CreateShareViewDto } from './dto/share-view.dto';
import { HOUSEHOLD_DOC_MAX_FILE_SIZE } from '../case/services/household-documents.service';

function requireOrg(user: JwtPayload): string {
  if (!user.orgId) throw new ForbiddenException('سازمان کاربر تعریف نشده');
  return user.orgId;
}

@ApiTags('collaboration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CollaborationController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly consents: ConsentsService,
    private readonly referrals: ReferralsService,
    private readonly portal: PortalService,
    private readonly field: FieldChannelService,
    private readonly stream: NotificationStreamService,
    private readonly shareViews: ShareViewsService,
  ) {}

  // --- Notifications ---
  @Get('notifications')
  @Permissions(Permission.NOTIFICATIONS_READ)
  listNotifications(
    @CurrentUser() user: JwtPayload,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.listForUser(requireOrg(user), user.sub, {
      unreadOnly: unreadOnly === '1' || unreadOnly === 'true',
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get('notifications/unread-count')
  @Permissions(Permission.NOTIFICATIONS_READ)
  unreadCount(@CurrentUser() user: JwtPayload) {
    return this.notifications.unreadCount(requireOrg(user), user.sub);
  }

  @Sse('notifications/stream')
  @Permissions(Permission.NOTIFICATIONS_READ)
  streamNotifications(@CurrentUser() user: JwtPayload) {
    requireOrg(user);
    return this.stream.subscribe(user.sub, user.orgId ?? null);
  }

  @Patch('notifications/:id/read')
  @Permissions(Permission.NOTIFICATIONS_READ)
  @Audited({ action: 'notification.read', resource: 'notification' })
  markRead(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(requireOrg(user), user.sub, id);
  }

  @Post('notifications/read-all')
  @Permissions(Permission.NOTIFICATIONS_READ)
  @Audited({ action: 'notification.read_all', resource: 'notification' })
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notifications.markAllRead(requireOrg(user), user.sub);
  }

  // --- Consents ---
  @Get('consents')
  @Permissions(Permission.CONSENTS_READ)
  listConsents(@CurrentUser() user: JwtPayload, @Query('householdId') householdId?: string) {
    if (!householdId) throw new BadRequestException('householdId الزامی است');
    return this.consents.listByHousehold(requireOrg(user), householdId);
  }

  @Post('consents')
  @Permissions(Permission.CONSENTS_WRITE)
  @Audited({ action: 'consent.create', resource: 'consent', severity: 'warning' })
  createConsent(@CurrentUser() user: JwtPayload, @Body() dto: CreateConsentDto) {
    return this.consents.create(requireOrg(user), user.sub, dto);
  }

  @Post('consents/:id/grant')
  @Permissions(Permission.CONSENTS_WRITE)
  @Audited({ action: 'consent.grant', resource: 'consent', severity: 'warning' })
  grantConsent(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GrantConsentDto,
  ) {
    return this.consents.grant(requireOrg(user), id, dto);
  }

  @Post('consents/:id/revoke')
  @Permissions(Permission.CONSENTS_WRITE)
  @Audited({ action: 'consent.revoke', resource: 'consent', severity: 'critical' })
  revokeConsent(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.consents.revoke(requireOrg(user), id);
  }

  // --- Referrals ---
  @Get('referrals')
  @Permissions(Permission.REFERRALS_READ)
  listReferrals(
    @CurrentUser() user: JwtPayload,
    @Query('householdId') householdId?: string,
    @Query('status') status?: string,
    @Query('destinationKind') destinationKind?: string,
  ) {
    return this.referrals.list(requireOrg(user), { householdId, status, destinationKind });
  }

  @Get('referrals/inbox')
  @Permissions(Permission.REFERRALS_READ)
  listReferralInbox(
    @CurrentUser() user: JwtPayload,
    @Query('municipalDistrict') municipalDistrict?: string,
    @Query('destinationCode') destinationCode?: string,
    @Query('audienceOrganizationId') audienceOrganizationId?: string,
  ) {
    return this.referrals.listInbox(requireOrg(user), {
      municipalDistrict: municipalDistrict ? Number(municipalDistrict) : undefined,
      destinationCode,
      audienceOrganizationId,
    });
  }

  @Get('referrals/:id')
  @Permissions(Permission.REFERRALS_READ)
  getReferral(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.referrals.findOne(requireOrg(user), id);
  }

  @Post('referrals')
  @Permissions(Permission.REFERRALS_WRITE)
  @Audited({ action: 'referral.create', resource: 'referral', severity: 'warning' })
  createReferral(@CurrentUser() user: JwtPayload, @Body() dto: CreateReferralDto) {
    return this.referrals.create(requireOrg(user), user.sub, dto);
  }

  @Post('referrals/:id/attach-consent')
  @Permissions(Permission.REFERRALS_WRITE)
  @Audited({ action: 'referral.attach_consent', resource: 'referral', severity: 'warning' })
  attachReferralConsent(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachReferralConsentDto,
  ) {
    return this.referrals.attachConsent(requireOrg(user), id, dto);
  }

  @Post('referrals/:id/send')
  @Permissions(Permission.REFERRALS_WRITE)
  @Audited({ action: 'referral.send', resource: 'referral', severity: 'warning' })
  sendReferral(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.referrals.send(requireOrg(user), user.sub, id);
  }

  @Patch('referrals/:id/status')
  @Permissions(Permission.REFERRALS_WRITE)
  @Audited({ action: 'referral.status', resource: 'referral' })
  updateReferralStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReferralStatusDto,
  ) {
    return this.referrals.updateStatus(requireOrg(user), user.sub, id, dto);
  }

  @Post('referrals/:id/cancel')
  @Permissions(Permission.REFERRALS_WRITE)
  @Audited({ action: 'referral.cancel', resource: 'referral' })
  cancelReferral(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.referrals.cancel(requireOrg(user), id);
  }

  // --- Field channel ---
  @Get('field/my-visits')
  @Permissions(Permission.FIELD_ACCESS)
  myVisits(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.field.myVisits(requireOrg(user), user.sub, { from, to });
  }

  @Get('field/today')
  @Permissions(Permission.FIELD_ACCESS)
  fieldToday(@CurrentUser() user: JwtPayload) {
    return this.field.todaySummary(requireOrg(user), user.sub);
  }

  @Get('field/search')
  @Permissions(Permission.FIELD_ACCESS)
  fieldSearch(
    @CurrentUser() user: JwtPayload,
    @Query('q') q?: string,
    @Query('plaque') plaque?: string,
  ) {
    return this.field.search(requireOrg(user), q, plaque);
  }

  @Post('field/visits/:visitId/complete')
  @Permissions(Permission.FIELD_ACCESS)
  @Audited({ action: 'field.visit.complete', resource: 'field_visit', resourceIdParam: 'params.visitId' })
  completeFieldVisit(
    @CurrentUser() user: JwtPayload,
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Body() dto: FieldCompleteDto,
  ) {
    return this.field.completeVisit(requireOrg(user), user.sub, visitId, dto);
  }

  // --- Portal (staff manage) ---
  @Post('portal/invites')
  @Permissions(Permission.PORTAL_MANAGE)
  @Audited({ action: 'portal.invite.create', resource: 'portal_invite', severity: 'warning' })
  createPortalInvite(@CurrentUser() user: JwtPayload, @Body() dto: CreatePortalInviteDto) {
    return this.portal.createInvite(requireOrg(user), user.sub, dto);
  }

  @Get('portal/invites')
  @Permissions(Permission.PORTAL_MANAGE)
  listPortalInvites(@CurrentUser() user: JwtPayload, @Query('householdId') householdId?: string) {
    return this.portal.listInvites(requireOrg(user), householdId);
  }

  @Post('portal/invites/:id/revoke')
  @Permissions(Permission.PORTAL_MANAGE)
  @Audited({ action: 'portal.invite.revoke', resource: 'portal_invite', severity: 'warning' })
  revokePortalInvite(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.portal.revokeInvite(requireOrg(user), id);
  }

  // --- Portal citizen ---
  @Public()
  @Post('portal/redeem')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Audited({ action: 'portal.redeem', resource: 'portal_invite', severity: 'warning' })
  redeemPortal(@Body() dto: PortalRedeemDto) {
    return this.portal.redeem(dto.inviteCode);
  }

  @Get('portal/me')
  @Permissions(Permission.PORTAL_ACCESS)
  portalMe(@CurrentUser() user: JwtPayload) {
    return this.portal.getSummary(user);
  }

  @Get('portal/me/documents')
  @Permissions(Permission.PORTAL_ACCESS)
  portalDocs(@CurrentUser() user: JwtPayload) {
    return this.portal.listDocuments(user);
  }

  @Post('portal/me/documents')
  @Permissions(Permission.PORTAL_ACCESS)
  @Audited({ action: 'portal.document.upload', resource: 'household_document' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: HOUSEHOLD_DOC_MAX_FILE_SIZE } }))
  portalUpload(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title?: string,
    @Body('category') category?: string,
  ) {
    return this.portal.uploadDocument(user, file, title, category);
  }

  @Get('portal/me/documents/:id/download')
  @Permissions(Permission.PORTAL_ACCESS)
  async portalDownload(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { doc, buffer } = await this.portal.downloadDocument(user, id);
    res.setHeader('Content-Type', doc.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
    res.send(buffer);
  }

  @Get('portal/me/consents')
  @Permissions(Permission.PORTAL_ACCESS)
  portalConsents(@CurrentUser() user: JwtPayload) {
    return this.portal.listConsents(user);
  }

  @Post('portal/me/consents/:id/grant')
  @Permissions(Permission.PORTAL_ACCESS)
  @Audited({ action: 'portal.consent.grant', resource: 'consent', severity: 'warning' })
  portalGrantConsent(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('grantedByName') grantedByName?: string,
  ) {
    return this.portal.grantConsent(user, id, grantedByName);
  }

  @Post('portal/me/consents/:id/revoke')
  @Permissions(Permission.PORTAL_ACCESS)
  @Audited({ action: 'portal.consent.revoke', resource: 'consent', severity: 'warning' })
  portalRevokeConsent(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portal.revokeConsent(user, id);
  }

  @Post('portal/me/consents/acknowledge')
  @Permissions(Permission.PORTAL_ACCESS)
  @Audited({ action: 'portal.consent.acknowledge', resource: 'consent' })
  portalAcknowledge(@CurrentUser() user: JwtPayload) {
    return this.portal.requestPortalConsent(user);
  }

  // --- Share views (read-only public links) ---
  @Get('share-views')
  @PermissionsAnyOf(
    Permission.SHARE_VIEWS_READ,
    Permission.SHARE_VIEWS_MANAGE,
    Permission.REPORTS_READ,
    Permission.REPORTS_WRITE,
    Permission.GIS_LAYERS_WRITE,
  )
  listShareViews(@CurrentUser() user: JwtPayload) {
    return this.shareViews.list(requireOrg(user));
  }

  @Post('share-views')
  @PermissionsAnyOf(
    Permission.SHARE_VIEWS_MANAGE,
    Permission.REPORTS_WRITE,
    Permission.GIS_LAYERS_WRITE,
  )
  @Audited({ action: 'share_view.create', resource: 'share_view', severity: 'warning' })
  createShareView(@CurrentUser() user: JwtPayload, @Body() dto: CreateShareViewDto) {
    return this.shareViews.create(requireOrg(user), user.sub, dto);
  }

  @Post('share-views/:id/revoke')
  @PermissionsAnyOf(
    Permission.SHARE_VIEWS_MANAGE,
    Permission.REPORTS_WRITE,
    Permission.GIS_LAYERS_WRITE,
  )
  @Audited({ action: 'share_view.revoke', resource: 'share_view', severity: 'warning' })
  revokeShareView(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.shareViews.revoke(requireOrg(user), id);
  }

  @Public()
  @Get('share-views/public/:token')
  getPublicShareView(@Param('token') token: string) {
    return this.shareViews.getPublicByToken(token);
  }
}
