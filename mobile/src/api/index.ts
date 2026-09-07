import { ApiResponse, HealthStatus } from '../types';
import { API_BASE_URL } from './apiClient';

export { API_BASE_URL };

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
export { conversationApi } from './conversationApi';
export * from './conversationApi';
export { documentApi } from './documentApi';
export * from './documentApi';

