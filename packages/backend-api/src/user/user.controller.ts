import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from '@vederi/shared';
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
}
