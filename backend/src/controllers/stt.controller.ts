import { Request, Response } from 'express';
import { sttService } from '../services/stt.service';
import { ApiResponse } from '../types';

export const transcribeAudio = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      const response: ApiResponse = {
        success: false,
        message: 'No audio file provided. Please send an audio file in the "audio" field.',
      };
      return res.status(400).json(response);
    }

    const languageCode = req.body?.language_code || req.body?.languageCode;

    const result = await sttService.transcribe(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      languageCode
    );

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('[SttController] Error transcribing audio:', error.message);
    const response: ApiResponse = {
      success: false,
      message: error.message || 'Speech-to-Text transcription failed',
      error: {
        code: 'STT_TRANSCRIPTION_FAILED',
        details: error.message,
      },
    };
    return res.status(500).json(response);
  }
};

export const getSttHealth = async (_req: Request, res: Response) => {
  try {
    const health = await sttService.checkHealth();
    const response: ApiResponse = {
      success: true,
      data: health,
    };
    return res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      message: error.message || 'STT service unhealthy',
      error: {
        code: 'STT_SERVICE_UNAVAILABLE',
        details: error.message,
      },
    };
    return res.status(503).json(response);
  }
};
