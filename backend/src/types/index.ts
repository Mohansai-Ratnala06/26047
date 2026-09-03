export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    details?: any;
  };
}

export interface HealthCheckData {
  service: string;
  status: string;
  timestamp?: string;
  uptime?: number;
  environment?: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  apiPrefix: string;
  corsOrigin: string;
  serviceTitle: string;
  mongodbUri?: string;
  awsRegion?: string;
  awsS3Bucket?: string;
}

// Extended request interface for patient-resolved routes
export interface PatientRequest extends Express.Request {
  user?: { id: string; role: string };
  patientId?: string;
  patientCode?: string;
}
