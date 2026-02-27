import { Body, Controller, Get, Param, Post, Patch, Delete, Req, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from '@vederi/shared';
import { Roles } from '../decorators';
import { Role } from '../decorators/roles.decorator';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Roles('admin', 'superadmin')
  @Post()
  create(@Body() dto: CreateUserDto, @Req() req: any) {
    // Superadmin can specify organizationId in body, admin uses their own org
    const orgId = req.user.roles?.includes('superadmin') && dto.organizationId
      ? dto.organizationId
      : req.user.orgId;
    return this.userService.createForOrg(dto, orgId);
  }

  @Roles('admin', 'superadmin')
  @Get()
  findAll(@Req() req: any) {
    return this.userService.findAllByOrg(req.user.orgId);
  }

  @Roles('admin', 'superadmin')
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.userService.findOneByOrg(id, req.user.orgId);
  }

  @Roles('admin', 'superadmin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: any) {
    return this.userService.updateForOrg(id, req.user.orgId, dto);
  }

  @Roles('admin', 'superadmin')
  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.userService.deleteForOrg(id, req.user.orgId);
  }
}
