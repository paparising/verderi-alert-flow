import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { AlertService } from './alert.service';
import { AlertEventProcessorService } from './alert-event-processor.service';
import { CreateAlertDto, UpdateAlertDto, UpdateAlertStatusDto } from '@videri/shared';
import { Roles } from '../decorators';

@Controller('alerts')
export class AlertController {
  constructor(
    private readonly alertService: AlertService,
    private readonly alertEventProcessorService: AlertEventProcessorService,
  ) {}

  @Roles('admin', 'user')
  @Post()
  createAlert(@Body() dto: CreateAlertDto, @Req() req: any) {
    return this.alertService.createAlert({ ...dto, orgId: req.user.orgId, createdBy: req.user.userId });
  }

  @Roles('admin', 'user')
  @Get()
  listAlerts(
    @Query('orgId') orgId: string,
    @Query('status') status?: string,
    @Query('mine') mine?: string,
    @Req() req?: any,
  ) {
    const effectiveOrgId = req?.user?.orgId || orgId;
    const createdBy = mine === 'true' && req?.user?.userId ? req.user.userId : undefined;
    return this.alertService.getAlertsByOrgAndCreator(effectiveOrgId, status, createdBy);
  }

  @Roles('admin', 'user')
  @Patch(':id/status')
  updateAlertStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAlertStatusDto,
    @Req() req: any,
  ) {
    return this.alertService.updateAlertStatus(id, req.user.orgId, dto.status, req.user.userId);
  }

  @Roles('admin', 'user')
  @Patch(':id')
  updateAlert(
    @Param('id') id: string,
    @Body() dto: UpdateAlertDto,
    @Req() req: any,
  ) {
    return this.alertService.updateAlert(id, req.user.orgId, req.user.userId, dto);
  }

  @Roles('admin', 'user')
  @Delete(':id')
  deleteAlert(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.alertService.deleteAlert(id, req.user.orgId);
  }

  @Roles('admin', 'user')
  @Get(':id/events')
  listAlertEvents(
    @Param('id') alertId: string,
    @Query('orgId') orgId: string,
    @Req() req: any,
  ) {
    const effectiveOrgId = req?.user?.orgId || orgId;
    return this.alertService.getAlertEventsByAlert(alertId, effectiveOrgId);
  }

  // ==================== MONITORING ENDPOINTS ====================
  // These endpoints help monitor the Transactional Outbox Pattern

  /**
   * Get count of unpublished events (events waiting to be published to Kafka)
   * High count indicates processor falling behind or Kafka issues
   */
  @Roles('admin')
  @Get('_internal/unpublished-count')
  async getUnpublishedEventCount() {
    const count = await this.alertEventProcessorService.getUnpublishedEventCount();
    return { 
      count,
      message: count > 100 ? 'WARNING: High unpublished event count' : 'OK',
    };
  }

  /**
   * Get events that failed to publish after multiple attempts
   * Useful for identifying persistent Kafka connection issues
   */
  @Roles('admin')
  @Get('_internal/failed-publishes')
  async getFailedPublishes(@Query('maxAttempts') maxAttempts?: string) {
    const max = parseInt(maxAttempts || '5', 10);
    const events = await this.alertEventProcessorService.getFailedPublishEvents(max);
    return {
      count: events.length,
      events: events.map(e => ({
        eventId: e.eventId,
        alertId: e.alertId,
        createdAt: e.createdAt,
        publishAttempts: e.publishAttempts,
        lastPublishError: e.lastPublishError,
      })),
    };
  }

  /**
   * Get unpublished events for a specific alert
   * Useful for debugging why specific alerts aren't being processed
   */
  @Roles('admin', 'user')
  @Get(':id/unpublished-events')
  async getUnpublishedEventsForAlert(
    @Param('id') alertId: string,
    @Req() req: any,
  ) {
    const events = await this.alertEventProcessorService.getUnpublishedEventsByAlert(
      alertId,
      req.user.orgId,
    );
    return {
      count: events.length,
      events: events.map(e => ({
        eventId: e.eventId,
        createdAt: e.createdAt,
        publishAttempts: e.publishAttempts,
        lastPublishError: e.lastPublishError,
      })),
    };
  }

  /**
   * Manually trigger event processing (useful for testing or recovery)
   * Processes all unpublished events immediately
   */
  @Roles('admin')
  @Post('_internal/reprocess-events')
  async manuallyReprocessEvents() {
    const count = await this.alertEventProcessorService.manuallyProcessEvents();
    return {
      processed: count,
      message: `Successfully processed ${count} unpublished events`,
    };
  }
}
