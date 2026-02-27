import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;

  constructor(private configService: ConfigService) {
    this.kafka = new Kafka({
      clientId: 'videri-alert-flow-api',
      brokers: [this.configService.get<string>('KAFKA_BROKER', 'localhost:9092')],
      connectionTimeout: 10000,
      retry: {
        initialRetryTime: 1000,
        retries: 10,
      },
    });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  private async connectWithRetry(maxRetries = 10, delayMs = 3000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.producer.connect();
        console.log('[Kafka Producer] Connected');
        return;
      } catch (error) {
        console.warn(`[Kafka Producer] Connection attempt ${attempt}/${maxRetries} failed: ${error.message}`);
        if (attempt === maxRetries) {
          console.error('[Kafka Producer] Max retries reached, giving up');
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
    console.log('[Kafka Producer] Disconnected');
  }

  async sendAlertEvent(topic: string, event: any) {
    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: event.orgId,
            value: JSON.stringify(event),
            headers: {
              timestamp: new Date().toISOString(),
            },
          },
        ],
      });
      console.log(`[Kafka Producer] Event sent to topic ${topic}:`, event.eventId);
    } catch (error) {
      console.error('[Kafka Producer] Error sending event:', error);
      throw error;
    }
  }
}
