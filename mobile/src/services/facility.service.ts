import { apiClient } from '../api/apiClient';

export interface RecommendedFacility {
  facility_name: string;
  facility_type: string;
  matched_specialty: string;
  match_rationale: string;
  city: string;
  district?: string;
  state?: string;
  address: string;
  distance_km?: number | string;
  timings: string;
  contact_phone: string;
  maps_url: string;
  emergency_available: boolean;
  tier: 'Tier 1 Advanced Tertiary' | 'Tier 2 Secondary Specialty' | 'Tier 3 Community Care';
  category?: 'nearby' | 'regional_apex';
}

export interface FacilityRecommendationResult {
  care_pathway: string;
  recommended_specialty: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  search_location: string;
  detected_city?: string;
  detected_district?: string;
  detected_state?: string;
  matched_facilities: RecommendedFacility[];
  nearby_facilities?: RecommendedFacility[];
  regional_apex_facilities?: RecommendedFacility[];
}

export interface RecommendFacilitiesPayload {
  latitude?: number;
  longitude?: number;
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  locality?: string;
  locationQuery?: string;
  chiefComplaint: string;
  recommendedSpecialty?: string;
  severityScore?: number;
  isEmergency?: boolean;
}

export const fetchRecommendedFacilities = async (
  payload: RecommendFacilitiesPayload
): Promise<FacilityRecommendationResult> => {
  const res: any = await apiClient.post('/facilities/recommend', payload);
  return res.data || res;
};
