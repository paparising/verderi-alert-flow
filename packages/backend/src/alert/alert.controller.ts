import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AlertService } from './alert.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertStatusDto } from './dto/update-alert-status.dto';

@Controller('alerts')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Post()
  createAlert(@Body() dto: CreateAlertDto) {
    return this.alertService.createAlert(dto);
  }

  @Get()
  listAlerts(
    @Query('orgId') orgId: string,
    @Query('status') status?: string,
  ) {
    return this.alertService.getAlertsByOrg(orgId, status);
  }

  @Patch(':id/status')
  updateAlertStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAlertStatusDto,
  ) {
    return this.alertService.updateAlertStatus(id, dto.orgId, dto.status, dto.updatedBy);
  }

  @Get(':id/events')
  listAlertEvents(
    @Param('id') alertId: string,
    @Query('orgId') orgId: string,
  ) {
    return this.alertService.getAlertEventsByAlert(alertId, orgId);
  }
}
