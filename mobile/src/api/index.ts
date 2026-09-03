import { ApiResponse, HealthStatus } from '../types';

export const API_BASE_URL = 'http://localhost:5000/api/v1';

export async function checkBackendHealth(): Promise<HealthStatus | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) return null;
    const json: ApiResponse<HealthStatus> = await res.json();
    return json.data || null;
  } catch (error) {
    console.warn('Backend connection failed:', error);
    return null;
  }
}

export { sttApi } from './sttApi';
export * from './sttApi';
