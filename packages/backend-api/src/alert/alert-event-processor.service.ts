import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AlertEvent, ProcessedEvent, ProcessingStatus } from '@videri/shared';
import { KafkaProducerService } from '../kafka/kafka-producer.service';

@Injectable()
export class AlertEventProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertEventProcessorService.name);
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout;
  private pollingInterval: number;

  constructor(
    @InjectRepository(AlertEvent)
    private alertEventRepo: Repository<AlertEvent>,
    @InjectRepository(ProcessedEvent)
    private processedEventRepo: Repository<ProcessedEvent>,
    private kafkaProducer: KafkaProducerService,
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {
    // Get polling interval from env, default to 1000ms (1 second)
    this.pollingInterval = this.configService.get<number>(
      'ALERT_EVENT_POLLING_INTERVAL_MS',
      1000,
    );
  }

  async onModuleInit() {
    this.logger.log(
      `Alert Event Processor Service initialized with polling interval: ${this.pollingInterval}ms`,
    );
    // Start periodic event processing after a small delay
    setTimeout(() => {
      this.processingInterval = setInterval(() => {
        this.processEvents().catch(error => {
          this.logger.error(`Unhandled error in processEvents: ${error.message}`, error.stack);
        });
      }, this.pollingInterval);
    }, this.pollingInterval);
  }

  onModuleDestroy() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
  }

  /**
   * Periodically poll and process alert events using Transactional Outbox Pattern
   * Only fetches unpublished events (published = false)
   * Marks events as published atomically with ProcessedEvent to ensure at-least-once delivery
   */
  async processEvents() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      const unpublishedEvents = await this.getUnpublishedEvents(100);

      if (unpublishedEvents.length === 0) {
        return;
      }

      this.logger.log(
        `Found ${unpublishedEvents.length} unpublished events to publish to Kafka`,
      );

      for (const event of unpublishedEvents) {
        await this.processSingleEvent(event, true, 'Successfully published', 'Failed to publish');
      }
    } catch (error) {
      this.logger.error(`Error during event processing: ${error.message}`, error.stack);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get the count of events not yet published to Kafka
   * Checks ProcessedEvent table for completion status
   */
  /**
   * Get unpublished events count (for monitoring)
   * Uses the published flag from Transactional Outbox Pattern
   */
  async getUnpublishedEventCount(): Promise<number> {
    return this.alertEventRepo.count({
      where: {
        published: false,
      },
    });
  }

  /**
   * Get unpublished events for a specific alert
   * Uses the published flag for efficient querying
   */
  async getUnpublishedEventsByAlert(alertId: string, orgId: string): Promise<AlertEvent[]> {
    return this.alertEventRepo.find({
      where: {
        alertId,
        orgId,
        published: false,
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  /**
   * Get events with failed publish attempts (for monitoring/alerting)
   */
  async getFailedPublishEvents(maxAttempts: number = 5): Promise<AlertEvent[]> {
    return this.alertEventRepo
      .createQueryBuilder('event')
      .where('event.published = :published', { published: false })
      .andWhere('event.publishAttempts >= :maxAttempts', { maxAttempts })
      .orderBy('event.createdAt', 'ASC')
      .getMany();
  }

  /**
   * Manually trigger event processing (useful for testing/admin operations)
   * Processes only unpublished events using Transactional Outbox Pattern
   */
  async manuallyProcessEvents(): Promise<number> {
    const unpublishedEvents = await this.getUnpublishedEvents();

    let processedCount = 0;

    for (const event of unpublishedEvents) {
      const published = await this.processSingleEvent(
        event,
        false,
        'Manually published',
        'Failed to manually process',
      );

      if (published) {
        processedCount++;
      }
    }

    this.logger.log(`Successfully processed ${processedCount} events manually`);
    return processedCount;
  }

  private async getUnpublishedEvents(limit?: number): Promise<AlertEvent[]> {
    return this.alertEventRepo.find({
      where: {
        published: false,
      },
      order: {
        createdAt: 'ASC',
      },
      take: limit,
    });
  }

  private buildKafkaEventData(event: AlertEvent) {
    return {
      orgId: event.orgId,
      alertId: event.alertId,
      eventId: event.eventId,
      ...event.eventData,
      createdBy: event.createdBy,
      createdAt: event.createdAt.toISOString(),
    };
  }

  private async sendEventToKafka(event: AlertEvent): Promise<void> {
    const kafkaEventData = this.buildKafkaEventData(event);
    await this.kafkaProducer.sendAlertEvent('alert-events', kafkaEventData);
  }

  private async markEventAsPublished(
    manager: EntityManager,
    event: AlertEvent,
    publishedAt: Date,
  ): Promise<void> {
    await manager.update(
      AlertEvent,
      { id: event.id },
      {
        published: true,
        publishedAt,
        publishAttempts: event.publishAttempts + 1,
        lastPublishError: null,
      },
    );
  }

  private async ensureProcessedEventRecord(
    manager: EntityManager,
    event: AlertEvent,
  ): Promise<void> {
    const existingProcessedEvent = await manager.findOne(ProcessedEvent, {
      where: { eventId: event.eventId },
    });

    if (!existingProcessedEvent) {
      const processedEvent = manager.create(ProcessedEvent, {
        eventId: event.eventId,
        status: ProcessingStatus.COMPLETED,
        completedAt: new Date(),
      });
      await manager.save(processedEvent);
    }
  }

  private async updatePublishFailureMetrics(event: AlertEvent, error: any): Promise<void> {
    const errorQueryRunner = this.dataSource.createQueryRunner();
    await errorQueryRunner.connect();
    try {
      await errorQueryRunner.manager.update(
        AlertEvent,
        { id: event.id },
        {
          publishAttempts: event.publishAttempts + 1,
          lastPublishError: error.message?.substring(0, 500),
        },
      );
    } catch (updateError) {
      this.logger.error(
        `Failed to update publish attempts for event ${event.eventId}: ${updateError.message}`,
      );
    } finally {
      await errorQueryRunner.release();
    }
  }

  private async processSingleEvent(
    event: AlertEvent,
    trackFailureMetrics: boolean,
    successPrefix: string,
    failurePrefix: string,
  ): Promise<boolean> {
    try {
      // Publish first; only mark published if Kafka send succeeds.
      await this.sendEventToKafka(event);
      await this.dataSource.transaction(async manager => {
        await this.markEventAsPublished(manager, event, new Date());
        await this.ensureProcessedEventRecord(manager, event);
      });

      this.logger.log(`${successPrefix} event ${event.eventId} (attempt ${event.publishAttempts + 1})`);
      return true;
    } catch (error) {
      if (trackFailureMetrics) {
        await this.updatePublishFailureMetrics(event, error);
      }

      this.logger.error(
        `${failurePrefix} event ${event.eventId} (attempt ${event.publishAttempts + 1}): ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
