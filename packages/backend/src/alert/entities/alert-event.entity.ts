import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { User } from '../../user/entities/user.entity';

@Entity()
@Index(['orgId'])
export class AlertEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orgId: string;

  @Column('uuid')
  eventId: string;

  @Column('jsonb', { default: {} })
  eventData: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @Column('uuid', { nullable: true })
  createdBy: string;

  @ManyToOne(() => Organization)
  organization: Organization;

  @ManyToOne(() => User, { nullable: true })
  creator: User;
}
