import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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
   * Periodically poll and process alert events
   * Uses ProcessedEvent table for idempotency - only publishes each event once
   */
  async processEvents() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      // Fetch all alert events
      const allEvents = await this.alertEventRepo.find({
        order: {
          createdAt: 'ASC',
        },
        take: 100,
      });

      if (allEvents.length === 0) {
        return;
      }

      this.logger.debug(`Found ${allEvents.length} alert events to check for publishing`);

      for (const event of allEvents) {
        // Check if this event has already been processed successfully
        const existingProcessedEvent = await this.processedEventRepo.findOne({
          where: { eventId: event.eventId },
        });

        if (existingProcessedEvent?.status === ProcessingStatus.COMPLETED) {
          this.logger.debug(`Event ${event.eventId} already published, skipping`);
          continue;
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        let processedEvent = existingProcessedEvent || await queryRunner.manager.create(ProcessedEvent, {
          eventId: event.eventId,
          status: ProcessingStatus.PROCESSING,
        });

        try {
          // Prepare event data for Kafka
          const kafkaEventData = {
            orgId: event.orgId,
            alertId: event.alertId,
            eventId: event.eventId,
            ...event.eventData,
            createdBy: event.createdBy,
            createdAt: event.createdAt.toISOString(),
          };

          // Publish to Kafka
          await this.kafkaProducer.sendAlertEvent('alert-events', kafkaEventData);

          // Mark as completed in ProcessedEvent table
          processedEvent.status = ProcessingStatus.COMPLETED;
          processedEvent.completedAt = new Date();
          
          if (existingProcessedEvent) {
            await queryRunner.manager.update(
              ProcessedEvent,
              { id: processedEvent.id },
              { status: ProcessingStatus.COMPLETED, completedAt: new Date() }
            );
          } else {
            await queryRunner.manager.save(processedEvent);
          }

          await queryRunner.commitTransaction();
          this.logger.debug(`Published event ${event.eventId} to Kafka`);
        } catch (error) {
          await queryRunner.rollbackTransaction();
          
          // Update ProcessedEvent with error status
          const errorQueryRunner = this.dataSource.createQueryRunner();
          await errorQueryRunner.connect();
          try {
            if (existingProcessedEvent) {
              await errorQueryRunner.manager.update(
                ProcessedEvent,
                { id: processedEvent.id },
                { status: ProcessingStatus.FAILED, errorMessage: error.message }
              );
            } else {
              processedEvent.status = ProcessingStatus.FAILED;
              processedEvent.errorMessage = error.message;
              await errorQueryRunner.manager.save(processedEvent);
            }
          } finally {
            await errorQueryRunner.release();
          }

          this.logger.error(
            `Failed to process event ${event.eventId}: ${error.message}`,
            error.stack,
          );
        } finally {
          await queryRunner.release();
        }
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
  async getUnpublishedEventCount(): Promise<number> {
    const totalEvents = await this.alertEventRepo.count();
    const publishedEvents = await this.processedEventRepo.count({
      where: {
        status: ProcessingStatus.COMPLETED,
      },
    });
    return totalEvents - publishedEvents;
  }

  /**
   * Get unpublished events for a specific alert
   * Checks against ProcessedEvent table
   */
  async getUnpublishedEventsByAlert(alertId: string, orgId: string): Promise<AlertEvent[]> {
    // Get all events for this alert
    const allEvents = await this.alertEventRepo.find({
      where: {
        alertId,
        orgId,
      },
      order: {
        createdAt: 'ASC',
      },
    });

    // Filter out events that have been published
    const unpublishedEvents: AlertEvent[] = [];
    for (const event of allEvents) {
      const processedEvent = await this.processedEventRepo.findOne({
        where: {
          eventId: event.eventId,
          status: ProcessingStatus.COMPLETED,
        },
      });
      if (!processedEvent) {
        unpublishedEvents.push(event);
      }
    }

    return unpublishedEvents;
  }

  /**
   * Manually trigger event processing (useful for testing/admin operations)
   * Uses ProcessedEvent idempotency tracking
   */
  async manuallyProcessEvents(): Promise<number> {
    const allEvents = await this.alertEventRepo.find({
      order: {
        createdAt: 'ASC',
      },
    });

    let processedCount = 0;

    for (const event of allEvents) {
      // Check if already processed
      const existingProcessedEvent = await this.processedEventRepo.findOne({
        where: { eventId: event.eventId },
      });

      if (existingProcessedEvent?.status === ProcessingStatus.COMPLETED) {
        this.logger.debug(`Event ${event.eventId} already published, skipping`);
        continue;
      }

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      
      try {
        let processedEvent = existingProcessedEvent || await queryRunner.manager.create(ProcessedEvent, {
          eventId: event.eventId,
          status: ProcessingStatus.PROCESSING,
        });

        const kafkaEventData = {
          orgId: event.orgId,
          alertId: event.alertId,
          eventId: event.eventId,
          ...event.eventData,
          createdBy: event.createdBy,
          createdAt: event.createdAt.toISOString(),
        };

        await this.kafkaProducer.sendAlertEvent('alert-events', kafkaEventData);
        
        // Mark as completed
        processedEvent.status = ProcessingStatus.COMPLETED;
        processedEvent.completedAt = new Date();
        
        if (existingProcessedEvent) {
          await queryRunner.manager.update(
            ProcessedEvent,
            { id: processedEvent.id },
            { status: ProcessingStatus.COMPLETED, completedAt: new Date() }
          );
        } else {
          await queryRunner.manager.save(processedEvent);
        }
        
        await queryRunner.commitTransaction();
        processedCount++;
        this.logger.debug(`Manually published event ${event.eventId}`);
      } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error(
          `Failed to manually process event ${event.eventId}: ${error.message}`,
          error.stack,
        );
      } finally {
        await queryRunner.release();
      }
    }

    this.logger.log(`Successfully processed ${processedCount} events manually`);
    return processedCount;
  }
}
