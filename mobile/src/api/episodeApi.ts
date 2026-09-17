import { apiClient } from './apiClient';

export interface EpisodeAvailableData {
  aiSummary: boolean;
  records: boolean;
  consents: boolean;
  consultation: boolean;
  documents: boolean;
  investigations: boolean;
  prescriptions: boolean;
  vitals: boolean;
}

export interface EpisodeCounts {
  records: number;
  documents: number;
  prescriptions: number;
  investigations: number;
  consents: number;
  conversations?: number;
  assessments?: number;
}

export interface TimelineEpisode {
  _id: string;
  episodeId?: string;
  episodeCode: string;
  patientId: string;
  chiefComplaint: string;
  duration?: string;
  phaseTitle?: string;
  type: 'symptom' | 'consultation' | 'followup' | 'chronic_condition' | 'emergency';
  status: 'open' | 'under_review' | 'resolved' | 'escalated' | 'closed';
  symptoms?: Array<{
    name: string;
    onset?: string;
    duration?: string;
    severity?: number;
    description?: string;
  }>;
  triage?: {
    level: 'low' | 'moderate' | 'high' | 'urgent';
    redFlags?: string[];
    evaluatedAt?: string;
  };
  doctorId?: {
    _id?: string;
    name?: string;
    email?: string;
    department?: string;
    room?: string;
  };
  clinicalNotes?: string;
  clinicalOutput?: Record<string, any>;
  startedAt: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  availableData?: EpisodeAvailableData;
  counts?: EpisodeCounts;
  preview?: {
    conversations?: Array<{
      id: string;
      channel: string;
      status: string;
      hasClinicalOutput: boolean;
    }>;
    documentCodes?: string[];
  };
}

export interface DetailedEpisodeData extends TimelineEpisode {
  conversations?: any[];
  documents?: any[];
  assessments?: any[];
  prescriptions?: any[];
  labResults?: any[];
  consents?: any[];
}

export const episodeApi = {
  getEpisodes: (): Promise<any> => {
    return apiClient.get('/episodes');
  },

  getEpisodeById: (episodeId: string): Promise<any> => {
    return apiClient.get(`/episodes/${episodeId}`);
  },

  createEpisode: (data: any): Promise<any> => {
    return apiClient.post('/episodes', data);
  },

  updateEpisode: (episodeId: string, data: any): Promise<any> => {
    return apiClient.patch(`/episodes/${episodeId}`, data);
  },

  deleteEpisode: (episodeId: string): Promise<any> => {
    return apiClient.delete(`/episodes/${episodeId}`);
  },
};

