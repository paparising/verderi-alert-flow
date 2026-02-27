import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from '@videri/shared';
import { Public } from '../decorators';
import { SuperAdminGuard } from '../guards';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Public()
  @Post()
  @UseGuards(SuperAdminGuard)
  create(@Body() dto: CreateOrganizationDto) {
    return this.orgService.create(dto);
  }

  @Public()
  @Get()
  @UseGuards(SuperAdminGuard)
  findAll() {
    return this.orgService.findAll();
  }

  @Public()
  @Get(':id')
  @UseGuards(SuperAdminGuard)
  findOne(@Param('id') id: string) {
    return this.orgService.findOne(id);
  }
}
