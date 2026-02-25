import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from '@vederi/shared';
import { Roles } from '../decorators';
import { SuperAdminGuard } from '../guards';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Post()
  @Roles('superadmin')
  @UseGuards(SuperAdminGuard)
  create(@Body() dto: CreateOrganizationDto) {
    return this.orgService.create(dto);
  }

  @Get()
  @Roles('superadmin')
  @UseGuards(SuperAdminGuard)
  findAll() {
    return this.orgService.findAll();
  }

  @Get(':id')
  @Roles('superadmin')
  @UseGuards(SuperAdminGuard)
  findOne(@Param('id') id: string) {
    return this.orgService.findOne(id);
  }
}
