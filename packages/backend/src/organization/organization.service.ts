import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,
  ) {}

  create(createDto: CreateOrganizationDto) {
    const org = this.orgRepo.create(createDto);
    return this.orgRepo.save(org);
  }

  findAll() {
    return this.orgRepo.find({ relations: ['users'] });
  }

  findOne(id: string) {
    return this.orgRepo.findOne({ where: { id }, relations: ['users'] });
  }
}