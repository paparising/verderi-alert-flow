import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { Organization } from '@videri/shared';
import { SuperAdminGuard } from '../guards';

@Module({
  imports: [TypeOrmModule.forFeature([Organization])],
  providers: [OrganizationService, SuperAdminGuard],
  controllers: [OrganizationController],
  exports: [OrganizationService],
})
export class OrganizationModule {}
