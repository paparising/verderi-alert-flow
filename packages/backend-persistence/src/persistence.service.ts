import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertEvent, ProcessedEvent, ProcessingStatus } from '@videri/shared';

@Injectable()
export class EventPersistenceService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private consumer: Consumer;

  constructor(
    private configService: ConfigService,
    @InjectRepository(AlertEvent)
    private alertEventRepo: Repository<AlertEvent>,
    @InjectRepository(ProcessedEvent)
    private processedEventRepo: Repository<ProcessedEvent>,
  ) {
    this.kafka = new Kafka({
      clientId: 'videri-alert-flow-persistence',
      brokers: [this.configService.get<string>('KAFKA_BROKER', 'localhost:9092')],
      connectionTimeout: 10000,
      retry: {
        initialRetryTime: 1000,
        retries: 10,
      },
    });
    this.consumer = this.kafka.consumer({ groupId: 'alert-events-persistence-group' });
  }

  private async connectWithRetry(maxRetries = 10, delayMs = 3000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.consumer.connect();
        console.log('[Persistence Service] Kafka Consumer connected');
        return;
      } catch (error) {
        console.warn(`[Persistence Service] Kafka connection attempt ${attempt}/${maxRetries} failed: ${error.message}`);
        if (attempt === maxRetries) {
          console.error('[Persistence Service] Max retries reached, giving up');
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async onModuleInit() {
    await this.connectWithRetry();
    console.log('[Persistence Service] Kafka Consumer connected');

    await this.consumer.subscribe({ topic: 'alert-events', fromBeginning: false });
    console.log('[Persistence Service] Subscribed to alert-events topic');

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(payload);
      },
    });
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
    console.log('[Persistence Service] Kafka Consumer disconnected');
  }

  private async handleMessage({ topic, partition, message }: EachMessagePayload) {
    let processedEventRecord: ProcessedEvent | null = null;
    
    try {
      const eventData = JSON.parse(message.value?.toString() || '{}');
      console.log(`[Persistence Service] Processing message from ${topic} [${partition}]:`, eventData.eventId);

      // Check if event was already processed (idempotency)
      const existingProcessedEvent = await this.processedEventRepo.findOne({
        where: { eventId: eventData.eventId },
      });

      if (existingProcessedEvent) {
        console.log(`[Persistence Service] Event ${eventData.eventId} already processed, skipping`);
        return;
      }

      // Try to claim the event by inserting into processed_event table
      try {
        processedEventRecord = this.processedEventRepo.create({
          eventId: eventData.eventId,
          status: ProcessingStatus.PROCESSING,
        });
        await this.processedEventRepo.save(processedEventRecord);
      } catch (error: any) {
        // Unique constraint violation means another consumer is processing this event
        if (error.code === '23505') {
          console.log(`[Persistence Service] Event ${eventData.eventId} being processed by another consumer, skipping`);
          return;
        }
        throw error;
      }

      // Save alert event to database
      // Extract eventData from the flattened Kafka message
      // (Kafka producer spreads event.eventData properties at top level)
      // Remove metadata fields, keep only event-specific fields
      const { orgId: messageOrgId, alertId: messageAlertId, eventId: messageEventId, createdBy: messageCreatedBy, createdAt: messageCreatedAt, ...reconstructedEventData } = eventData;

      const event = this.alertEventRepo.create({
        orgId: messageOrgId,
        alertId: messageAlertId,
        eventId: messageEventId,
        eventData: reconstructedEventData,
        createdBy: messageCreatedBy,
      });

      await this.alertEventRepo.save(event);
      
      // Mark as completed
      processedEventRecord.status = ProcessingStatus.COMPLETED;
      processedEventRecord.completedAt = new Date();
      await this.processedEventRepo.save(processedEventRecord);
      
      console.log(`[Persistence Service] Alert event saved to database: ${event.eventId}`);
    } catch (error: any) {
      console.error('[Persistence Service] Error processing Kafka message:', error);
      
      // Mark as failed if we have a processed event record
      if (processedEventRecord) {
        processedEventRecord.status = ProcessingStatus.FAILED;
        processedEventRecord.errorMessage = error.message || 'Unknown error';
        await this.processedEventRepo.save(processedEventRecord);
      }
      // In production, send to dead-letter queue
    }
  }
}
