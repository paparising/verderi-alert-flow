import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertEvent } from '@vederi/shared';

@Injectable()
export class EventPersistenceService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private consumer: Consumer;

  constructor(
    private configService: ConfigService,
    @InjectRepository(AlertEvent)
    private alertEventRepo: Repository<AlertEvent>,
  ) {
    this.kafka = new Kafka({
      clientId: 'vederi-alert-flow-persistence',
      brokers: [this.configService.get<string>('KAFKA_BROKER', 'localhost:9092')],
    });
    this.consumer = this.kafka.consumer({ groupId: 'alert-events-persistence-group' });
  }

  async onModuleInit() {
    await this.consumer.connect();
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
    try {
      const eventData = JSON.parse(message.value?.toString() || '{}');
      console.log(`[Persistence Service] Processing message from ${topic} [${partition}]:`, eventData.eventId);

      // Save alert event to database
      const event = this.alertEventRepo.create({
        orgId: eventData.orgId,
        eventId: eventData.eventId,
        eventData: eventData.eventData,
        createdBy: eventData.createdBy,
      });

      await this.alertEventRepo.save(event);
      console.log(`[Persistence Service] Alert event saved to database: ${event.eventId}`);
    } catch (error) {
      console.error('[Persistence Service] Error processing Kafka message:', error);
      // In production, send to dead-letter queue
    }
  }
}
