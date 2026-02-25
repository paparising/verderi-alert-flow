import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Organization } from './organization.entity';
import { User } from './user.entity';
import { Alert } from './alert.entity';

@Entity()
@Index(['orgId'])
@Index(['alertId'])
@Index(['orgId', 'alertId'])
@Index(['eventId'])
@Index(['orgId', 'createdAt'])
export class AlertEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orgId: string;

  @Column('uuid')
  alertId: string;

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

  @ManyToOne(() => Alert)
  alert: Alert;
}
