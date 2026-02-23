import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { Organization } from '../organization/entities/organization.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,
  ) {}

  async create(dto: CreateUserDto) {
    const org = await this.orgRepo.findOne({ where: { id: dto.organizationId } });
    if (!org) {
      throw new Error('Organization not found');
    }
    const user = this.userRepo.create({
      name: dto.name,
      address: dto.address,
      email: dto.email,
      phone: dto.phone,
      organization: org,
    });
    return this.userRepo.save(user);
  }

  findAll() {
    return this.userRepo.find({ relations: ['organization'] });
  }

  findOne(id: string) {
    return this.userRepo.findOne({ where: { id }, relations: ['organization'] });
  }
}