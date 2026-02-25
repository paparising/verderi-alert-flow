import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Organization, CreateUserDto } from '@vederi/shared';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,
  ) {}

  async createForOrg(dto: CreateUserDto, orgId: string) {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) {
      throw new ForbiddenException('Organization not found');
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

  findAllByOrg(orgId: string) {
    return this.userRepo.find({ where: { organization: { id: orgId } }, relations: ['organization'] });
  }

  async findOneByOrg(id: string, orgId: string) {
    const user = await this.userRepo.findOne({ where: { id, organization: { id: orgId } }, relations: ['organization'] });
    if (!user) {
      throw new ForbiddenException('User not found in this organization');
    }
    return user;
  }
}
