import { Injectable, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Organization, CreateUserDto, CreateAdminUserDto, UpdateUserDto } from '@videri/shared';
import * as bcrypt from 'bcryptjs';

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
    
    // Check email uniqueness within this organization
    const existing = await this.userRepo.findOne({ where: { email: dto.email, organization: { id: orgId } } });
    if (existing) {
      throw new ConflictException('User with this email already exists in this organization');
    }
    
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.userRepo.create({
      name: dto.name,
      address: dto.address,
      email: dto.email,
      phone: dto.phone,
      role: dto.role || 'user',
      organization: org,
      passwordHash,
    });
    const saved = await this.userRepo.save(user);
    delete (saved as any).passwordHash;
    return saved;
  }

  async createAdminForOrg(dto: CreateAdminUserDto) {
    const org = await this.orgRepo.findOne({ where: { id: dto.organizationId } });
    if (!org) {
      throw new ForbiddenException('Organization not found');
    }

    // Check email uniqueness within this organization
    const existing = await this.userRepo.findOne({ where: { email: dto.email, organization: { id: dto.organizationId } } });
    if (existing) {
      throw new ConflictException('User with this email already exists in this organization');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const role: 'admin' | 'user' = dto.role ?? 'admin';
    const user = this.userRepo.create({
      name: dto.name,
      address: dto.address,
      email: dto.email,
      phone: dto.phone,
      organization: org,
      role,
      passwordHash,
    });
    const saved = await this.userRepo.save(user);
    // Hide hash from response
    delete (saved as any).passwordHash;
    return saved;
  }

  async findByEmailWithPassword(email: string) {
    return this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.organization', 'organization')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
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

  async updateForOrg(id: string, orgId: string, dto: UpdateUserDto) {
    const user = await this.findOneByOrg(id, orgId);
    
    // Ensure organization cannot be changed
    if ((dto as any).organizationId || (dto as any).organization) {
      throw new ForbiddenException('Organization cannot be modified');
    }
    
    if (dto.email && dto.email !== user.email) {
      // Check email uniqueness within this organization
      const existing = await this.userRepo.findOne({ where: { email: dto.email, organization: { id: orgId } } });
      if (existing) {
        throw new ConflictException('User with this email already exists in this organization');
      }
      user.email = dto.email;
    }

    if (dto.name) user.name = dto.name;
    if (dto.address) user.address = dto.address;
    if (dto.phone) user.phone = dto.phone;
    if (dto.role) user.role = dto.role;

    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    const saved = await this.userRepo.save(user);
    delete (saved as any).passwordHash;
    return saved;
  }

  async deleteForOrg(id: string, orgId: string) {
    const user = await this.findOneByOrg(id, orgId);
    await this.userRepo.delete(id);
    return { success: true };
  }
}
