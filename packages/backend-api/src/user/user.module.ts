import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User, Organization } from '@vederi/shared';

@Module({
  imports: [TypeOrmModule.forFeature([User, Organization])],
  providers: [UserService],
  controllers: [UserController],
})
export class UserModule {}
