import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { AlertService } from './alert.service';
import { CreateAlertDto, UpdateAlertStatusDto } from '@vederi/shared';
import { Roles } from '../decorators';

@Controller('alerts')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

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
    @Req() req?: any,
  ) {
    const effectiveOrgId = req?.user?.orgId || orgId;
    return this.alertService.getAlertsByOrg(effectiveOrgId, status);
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
  @Get(':id/events')
  listAlertEvents(
    @Param('id') alertId: string,
    @Query('orgId') orgId: string,
    @Req() req: any,
  ) {
    const effectiveOrgId = req?.user?.orgId || orgId;
    return this.alertService.getAlertEventsByAlert(alertId, effectiveOrgId);
  }
}
