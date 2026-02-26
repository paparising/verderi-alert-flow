import { Body, Controller, Get, Param, Post, Patch, Delete, Req, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from '@vederi/shared';
import { Roles } from '../decorators';
import { Role } from '../decorators/roles.decorator';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateUserDto, @Req() req: any) {
    return this.userService.createForOrg(dto, req.user.orgId);
  }

  @Roles('admin')
  @Get()
  findAll(@Req() req: any) {
    return this.userService.findAllByOrg(req.user.orgId);
  }

  @Roles('admin')
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.userService.findOneByOrg(id, req.user.orgId);
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: any) {
    return this.userService.updateForOrg(id, req.user.orgId, dto);
  }

  @Roles('admin')
  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.userService.deleteForOrg(id, req.user.orgId);
  }
}
