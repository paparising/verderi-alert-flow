import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { AlertService } from './alert.service';
import { CreateAlertDto, UpdateAlertDto, UpdateAlertStatusDto } from '@vederi/shared';
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
}
