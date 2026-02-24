import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;

  constructor(private configService: ConfigService) {
    this.kafka = new Kafka({
      clientId: 'vederi-alert-flow-api',
      brokers: [this.configService.get<string>('KAFKA_BROKER', 'localhost:9092')],
    });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    await this.producer.connect();
    console.log('[Kafka Producer] Connected');
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
