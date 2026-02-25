import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateAdminUserDto } from '@vederi/shared';
import { Public } from '../decorators/public.decorator';
import { SuperAdminGuard } from '../guards';

@Controller('superadmin/users')
export class SuperAdminUserController {
  constructor(private readonly userService: UserService) {}

  @Public()
  @UseGuards(SuperAdminGuard)
  @Post('admin')
  createAdmin(@Body() dto: CreateAdminUserDto) {
    return this.userService.createAdminForOrg(dto);
  }
}