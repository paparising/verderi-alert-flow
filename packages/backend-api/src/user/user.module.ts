import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { SuperAdminUserController } from './superadmin-user.controller';
import { User, Organization } from '@vederi/shared';

@Module({
  imports: [TypeOrmModule.forFeature([User, Organization])],
  providers: [UserService],
  controllers: [UserController, SuperAdminUserController],
  exports: [UserService],
})
export class UserModule {}
