import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { User } from '../../user/entities/user.entity';
import { AlertStatus } from '../enums/alert-status.enum';

@Entity()
@Index(['orgId'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orgId: string;

  @Column('uuid')
  alertId: string;

  @Column('text')
  alertContext: string;

  @Column({ type: 'varchar', length: 50, default: AlertStatus.NEW })
  status: AlertStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column('uuid', { nullable: true })
  createdBy: string;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column('uuid', { nullable: true })
  updatedBy: string;

  @ManyToOne(() => Organization)
  organization: Organization;

  @ManyToOne(() => User, { nullable: true })
  creator: User;

  @ManyToOne(() => User, { nullable: true })
  updater: User;
}
