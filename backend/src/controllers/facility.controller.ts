import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import facilityRecommendationService from '../services/facilityRecommendation.service';

export const recommendFacilities = async (req: Request, res: Response) => {
  try {
    const {
      latitude,
      longitude,
      locationQuery,
      chiefComplaint,
      recommendedSpecialty,
      severityScore,
      isEmergency,
    } = req.body;

    if (!chiefComplaint) {
      const response: ApiResponse = {
        success: false,
        message: 'Chief complaint is required for clinical facility matching',
      };
      return res.status(400).json(response);
    }

    const result = await facilityRecommendationService.recommendSpecializedFacilities({
      latitude: typeof latitude === 'number' ? latitude : undefined,
      longitude: typeof longitude === 'number' ? longitude : undefined,
      locationQuery: typeof locationQuery === 'string' ? locationQuery : undefined,
      chiefComplaint,
      recommendedSpecialty,
      severityScore: typeof severityScore === 'number' ? severityScore : undefined,
      isEmergency: Boolean(isEmergency),
    });

    const response: ApiResponse = {
      success: true,
      data: result,
    };
    return res.status(200).json(response);
  } catch (err: any) {
    console.error('[FacilityController] Error generating recommendations:', err);
    const response: ApiResponse = {
      success: false,
      message: err.message || 'Failed to recommend facilities',
    };
    return res.status(500).json(response);
  }
};
