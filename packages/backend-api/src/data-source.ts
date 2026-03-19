import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Alert, AlertEvent, Organization, ProcessedEvent, User } from '@videri/shared';

const isSynchronizeEnabled = process.env.DB_SYNCHRONIZE ? process.env.DB_SYNCHRONIZE === 'true' : true;

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'videri',
  entities: [Organization, User, Alert, AlertEvent, ProcessedEvent],
  migrations: ['src/migrations/*.ts'],
  synchronize: isSynchronizeEnabled,
});
