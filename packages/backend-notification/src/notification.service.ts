import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { ConfigService } from '@nestjs/config';
import { AlertGateway } from './alert.gateway';

@Injectable()
export class EventNotificationService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private consumer: Consumer;

  constructor(
    private configService: ConfigService,
    private alertGateway: AlertGateway,
  ) {
    this.kafka = new Kafka({
      clientId: 'vederi-alert-flow-notification',
      brokers: [this.configService.get<string>('KAFKA_BROKER', 'localhost:9092')],
      connectionTimeout: 10000,
      retry: {
        initialRetryTime: 1000,
        retries: 10,
      },
    });
    this.consumer = this.kafka.consumer({ groupId: 'alert-events-notification-group' });
  }

  async onModuleInit() {
    await this.connectWithRetry();

    await this.consumer.subscribe({ topic: 'alert-events', fromBeginning: false });
    console.log('[Notification Service] Subscribed to alert-events topic');

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(payload);
      },
    });
  }

  private async connectWithRetry(maxRetries = 10, delayMs = 3000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.consumer.connect();
        console.log('[Notification Service] Kafka Consumer connected');
        return;
      } catch (error) {
        console.warn(`[Notification Service] Kafka connection attempt ${attempt}/${maxRetries} failed: ${error.message}`);
        if (attempt === maxRetries) {
          console.error('[Notification Service] Max retries reached, giving up');
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
    console.log('[Notification Service] Kafka Consumer disconnected');
  }

  private async handleMessage({ topic, partition, message }: EachMessagePayload) {
    try {
      const eventData = JSON.parse(message.value?.toString() || '{}');
      console.log(`[Notification Service] Processing message from ${topic} [${partition}]:`, eventData.eventId);

      // Emit WebSocket notification to connected clients
      this.alertGateway.emitAlertEvent(eventData.orgId, eventData);
      console.log(`[Notification Service] WebSocket notification sent for event: ${eventData.eventId}`);
    } catch (error) {
      console.error('[Notification Service] Error processing Kafka message:', error);
      // In production, send to dead-letter queue
    }
  }
}
