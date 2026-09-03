import { Request, Response } from 'express';
import config from '../config';
import { ApiResponse, HealthCheckData } from '../types';

export const getHealth = (_req: Request, res: Response): void => {
  const response: ApiResponse<HealthCheckData> = {
    success: true,
    data: {
      service: config.serviceTitle || 'vaidyaarc-api',
      status: 'healthy',
    },
  };
  res.status(200).json(response);
};
