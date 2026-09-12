import { Request, Response } from 'express';
import { ttsService } from '../services/tts.service';
import { ApiResponse } from '../types';

export const synthesizeSpeech = async (req: Request, res: Response) => {
  try {
    const text = req.body?.text;
    const language = req.body?.language || req.body?.languageCode || req.body?.language_code;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      const response: ApiResponse = {
        success: false,
        message: 'No text provided. Please supply text in the request body.',
      };
      return res.status(400).json(response);
    }

    const result = await ttsService.synthesize(text, language);

    const response: ApiResponse = {
      success: true,
      data: result,
    };
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('[TtsController] Error synthesizing speech:', error.message);
    const response: ApiResponse = {
      success: false,
      message: error.message || 'Text-to-Speech synthesis failed',
      error: {
        code: 'TTS_SYNTHESIS_FAILED',
        details: error.message,
      },
    };
    return res.status(500).json(response);
  }
};

export const getTtsHealth = async (_req: Request, res: Response) => {
  try {
    const health = await ttsService.checkHealth();
    const response: ApiResponse = {
      success: true,
      data: health,
    };
    return res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      message: error.message || 'TTS service unhealthy',
      error: {
        code: 'TTS_SERVICE_UNAVAILABLE',
        details: error.message,
      },
    };
    return res.status(503).json(response);
  }
};
