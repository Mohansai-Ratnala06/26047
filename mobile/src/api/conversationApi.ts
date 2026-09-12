import { apiClient } from './apiClient';
import { ApiResponse } from '../types';

export interface MessagePayload {
  content: string;
  inputType?: 'voice' | 'text';
  language?: string;
  structuredData?: Record<string, any>;
  audioS3Key?: string;
}

export interface ConversationMessage {
  _id: string;
  conversationId: string;
  patientId: string;
  episodeId?: string;
  role: 'patient' | 'assistant' | 'system';
  inputType: 'text' | 'voice';
  language: string;
  content: string;
  structuredData?: Record<string, any>;
  timestamp: string;
}

export interface TurnResponseData {
  patientMessage: ConversationMessage;
  assistantMessage: ConversationMessage;
  englishAssistantMessage?: string;
  turnStatus: 'in_progress' | 'complete' | 'emergency' | string;
  immediateAttentionRequired: boolean;
  informationComplete: boolean;
  missingInformation: string[];
  clinicalOutput?: Record<string, any> | null;
  audioBase64?: string;
  audioMimeType?: string;
}

export interface ConversationDoc {
  _id: string;
  patientId: string;
  episodeId?: string;
  channel: string;
  language: string;
  status: 'active' | 'completed' | 'abandoned';
  stateSnapshot?: Record<string, any>;
  clinicalStatus?: string;
  immediateAttentionRequired?: boolean;
  clinicalOutput?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export const conversationApi = {
  /**
   * Create a new conversation session for clinical intake / voice interaction.
   */
  createConversation: async (data?: {
    episodeId?: string;
    channel?: string;
    language?: string;
  }): Promise<ApiResponse<ConversationDoc>> => {
    return apiClient.post('/conversations', data || { channel: 'voice', language: 'en' });
  },

  /**
   * Get an existing conversation by ID.
   */
  getConversationById: async (conversationId: string): Promise<ApiResponse<ConversationDoc>> => {
    return apiClient.get(`/conversations/${conversationId}`);
  },

  /**
   * Send a patient message to the conversation endpoint, which invokes the Python Clinical Brain.
   */
  sendMessage: async (
    conversationId: string,
    payload: MessagePayload
  ): Promise<ApiResponse<TurnResponseData>> => {
    return apiClient.post(`/messages/${conversationId}`, payload);
  },

  /**
   * Retrieve historical messages for a conversation.
   */
  getMessages: async (
    conversationId: string,
    limit: number = 50,
    before?: string
  ): Promise<ApiResponse<{ messages: ConversationMessage[]; pagination: any }>> => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (before) params.append('before', before);
    return apiClient.get(`/messages/${conversationId}?${params.toString()}`);
  },
};

export default conversationApi;

