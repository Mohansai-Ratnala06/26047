import dotenv from 'dotenv';
import path from 'path';
import { AppConfig } from '../types';

// Load .env configuration
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  serviceTitle: process.env.SERVICE_TITLE || 'vaidyaarc-api',
  mongodbUri: process.env.MONGODB_URI,
  awsRegion: process.env.AWS_REGION || 'ap-south-1',
  awsS3Bucket: process.env.AWS_S3_BUCKET,
};

export default config;
