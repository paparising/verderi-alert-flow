import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { Organization } from '../organization/entities/organization.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Organization])],
  providers: [UserService],
  controllers: [UserController],
})
export class UserModule {}