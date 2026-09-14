import axios from 'axios';

export interface RecommendedFacility {
  facility_name: string;
  facility_type: string;
  matched_specialty: string;
  match_rationale: string;
  city: string;
  address: string;
  distance_km?: number | string;
  timings: string;
  contact_phone: string;
  maps_url: string;
  emergency_available: boolean;
  tier: 'Tier 1 Advanced Tertiary' | 'Tier 2 Secondary Specialty' | 'Tier 3 Community Care';
}

export interface FacilityRecommendationInput {
  latitude?: number;
  longitude?: number;
  locationQuery?: string;
  chiefComplaint: string;
  recommendedSpecialty?: string;
  severityScore?: number;
  isEmergency?: boolean;
}

export interface FacilityRecommendationResult {
  care_pathway: string;
  recommended_specialty: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  search_location: string;
  matched_facilities: RecommendedFacility[];
}

export class FacilityRecommendationService {
  private candidateModels = [
    process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ];

  public async recommendSpecializedFacilities(
    input: FacilityRecommendationInput
  ): Promise<FacilityRecommendationResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    const specialty = input.recommendedSpecialty || 'General Medicine';
    const severity = input.severityScore ?? 40;
    const isEmergency = Boolean(input.isEmergency || severity >= 80);

    const locationDesc =
      input.latitude && input.longitude
        ? `Coordinates: ${input.latitude.toFixed(4)}, ${input.longitude.toFixed(4)}`
        : input.locationQuery || 'Andhra Pradesh & Telangana, India (Major healthcare centers)';

    const systemPrompt = `
You are the VaidyaArc Medical Facility Navigation Engine.
Your highest imperative is CLINICAL MATCH AND SPECIALIZATION PRIORITY.
DO NOT simply return random nearby clinics. Prioritize hospitals with established clinical departments, diagnostics (e.g. Endoscopy, Cath Lab, ICU, Trauma Care), and verified emergency facilities directly equipped to treat the patient's specific condition.

PATIENT CLINICAL CONTEXT:
- Presenting Complaint: "${input.chiefComplaint}"
- Severity Score: ${severity}/100 (${isEmergency ? 'EMERGENCY / RED FLAG' : severity >= 60 ? 'HIGH / URGENT' : 'MODERATE / ROUTINE'})
- Recommended Department: "${specialty}"
- Patient Geographic Location: "${locationDesc}"

OUTPUT REQUIREMENT:
Provide top 3 to 4 reputable hospitals/centers in or near that region that specialize in this exact condition.
Return strictly valid JSON only:
{
  "care_pathway": "${isEmergency ? 'Emergency Critical Evaluation' : severity >= 60 ? 'Urgent Specialized Consultation' : 'Routine Clinical Consultation'}",
  "recommended_specialty": "${specialty}",
  "urgency": "${isEmergency ? 'emergency' : severity >= 60 ? 'urgent' : 'routine'}",
  "search_location": "${locationDesc}",
  "matched_facilities": [
    {
      "facility_name": "Hospital Name",
      "facility_type": "Tertiary Multi-Specialty Hospital / Specialized Clinic",
      "matched_specialty": "Department Name (e.g. Center for Gastroenterology & Hepatology)",
      "match_rationale": "Clear medical reason why this hospital is best suited for the patient's specific symptoms and clinical equipment needed",
      "city": "City Name",
      "address": "Street / Area, City, State",
      "distance_km": "approx. X km",
      "timings": "24/7 Emergency & Inpatient | OPD 8:30 AM - 7:00 PM",
      "contact_phone": "+91-XXXXXXXXXX (or official helpline)",
      "maps_url": "https://www.google.com/maps/search/?api=1&query=Encoded+Hospital+Name+City",
      "emergency_available": true,
      "tier": "Tier 1 Advanced Tertiary"
    }
  ]
}
`;

    if (!apiKey) {
      return this.getFallbackFacilities(specialty, isEmergency, locationDesc);
    }

    for (const model of this.candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: 'application/json',
          },
        };

        const response = await axios.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 20000,
        });

        const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const cleaned = rawText
            .trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```$/i, '')
            .trim();
          const parsed = JSON.parse(cleaned);
          if (parsed && Array.isArray(parsed.matched_facilities) && parsed.matched_facilities.length > 0) {
            return parsed;
          }
        }
      } catch (err: any) {
        console.warn(`[FacilityRecommendation] Model ${model} call failed:`, err.message);
      }
    }

    return this.getFallbackFacilities(specialty, isEmergency, locationDesc);
  }

  private getFallbackFacilities(
    specialty: string,
    isEmergency: boolean,
    locationDesc: string
  ): FacilityRecommendationResult {
    return {
      care_pathway: isEmergency ? 'Emergency Critical Evaluation' : 'Urgent Specialized Consultation',
      recommended_specialty: specialty,
      urgency: isEmergency ? 'emergency' : 'urgent',
      search_location: locationDesc,
      matched_facilities: [
        {
          facility_name: `Apollo Hospitals - ${specialty} Center of Excellence`,
          facility_type: 'Super Specialty Tertiary Hospital',
          matched_specialty: `${specialty} & Emergency Services`,
          match_rationale: `Equipped with dedicated ${specialty} diagnostic suites, 24/7 high-dependency ICU, and certified medical specialists.`,
          city: 'Regional Medical Hub',
          address: 'Main Health Expressway, Medical District',
          distance_km: '3.5 km',
          timings: '24/7 Emergency Services | OPD: 8:00 AM - 8:00 PM',
          contact_phone: '1066 (24/7 National Emergency Hotline)',
          maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Apollo Hospital ' + specialty)}`,
          emergency_available: true,
          tier: 'Tier 1 Advanced Tertiary',
        },
        {
          facility_name: `Government General Hospital (GGH) / Medical College`,
          facility_type: 'Public Government Teaching Hospital',
          matched_specialty: `Department of ${specialty}`,
          match_rationale: `Comprehensive state-funded multi-specialty trauma, acute care, and subsidized diagnostic evaluation.`,
          city: 'City Center',
          address: 'Civil Hospital Road',
          distance_km: '4.2 km',
          timings: '24/7 Emergency & Casualty | OPD: 8:30 AM - 1:00 PM',
          contact_phone: '108 (Emergency Ambulance & Dispatch)',
          maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Government General Hospital')}`,
          emergency_available: true,
          tier: 'Tier 1 Advanced Tertiary',
        },
      ],
    };
  }
}

export const facilityRecommendationService = new FacilityRecommendationService();
export default facilityRecommendationService;
