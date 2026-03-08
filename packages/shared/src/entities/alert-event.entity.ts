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
@Index(['published', 'createdAt']) // Index for efficient unpublished event queries
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

  // Transactional Outbox Pattern - MINIMUM REQUIRED FIELDS
  // published: false = event waiting to be published to Kafka
  // published: true = event successfully sent to Kafka
  @Column({ type: 'boolean', default: false })
  published: boolean;

  // Track publish attempts for monitoring (alerts if > 10 attempts)
  @Column({ type: 'int', default: 0 })
  publishAttempts: number;

  // Optional fields for enhanced monitoring (can be omitted if you want minimal changes)
  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;  // When successfully published (vs createdAt = when created)

  @Column({ type: 'text', nullable: true })
  lastPublishError: string;  // Error message for debugging stuck events

  @ManyToOne(() => Organization)
  organization: Organization;

  @ManyToOne(() => User, { nullable: true })
  creator: User;

  @ManyToOne(() => Alert)
  alert: Alert;
}
