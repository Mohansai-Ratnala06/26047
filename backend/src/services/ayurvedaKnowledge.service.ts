import fs from 'fs';
import path from 'path';

export interface AyurvedaRecordDetail {
  indication: string;
  preparation: string;
  source_dosage?: string;
  warnings?: string[];
}

export interface AyurvedaProvenance {
  source_id: string;
  document_title: string;
  page: number;
  section: string;
  excerpt: string;
}

export interface AyurvedaKnowledgeRecord {
  record_id: string;
  name: string;
  aliases: string[];
  botanical_name: string | null;
  record_type: 'home_remedy' | 'pharmacopoeial_formulation' | 'secondary_literature';
  authority_level: 'primary_official' | 'secondary';
  evidence_type: string;
  formulation_form: string;
  ingredients: string[];
  traditional_indications: string[];
  indication_details: AyurvedaRecordDetail[];
  preparation_method?: string;
  source_dosage_info?: string;
  anupana?: string;
  warnings: string[];
  contraindications: string[];
  safety_notes: string[];
  limitations: string[];
  provenance: AyurvedaProvenance;
}

export interface AyurvedaRecommendationItem {
  record_id: string;
  name: string;
  remedy_type: string;
  matching_symptom: string;
  authority_level: string;
  preparation_summary: string;
  source_dosage_reference: string;
  anupana_reference?: string | null;
  safety_notes: string[];
  warnings: string[];
  limitations: string[];
  provenance: AyurvedaProvenance;
  prescription_disclaimer: string;
}

export interface AyurvedaEvaluationResult {
  decision: 'eligible' | 'blocked' | 'requires_clinician_review';
  summary: string;
  recommendations: AyurvedaRecommendationItem[];
  blocked_reasons: string[];
  safety_findings_summary: {
    red_flag_status: string;
    risk_level: string;
    severity_score: number;
    immediate_attention_required: boolean;
  };
  provenance_sources: string[];
  disclaimer: string;
  non_prescription_disclaimer: string;
}

const MANDATORY_NON_PRESCRIPTION_DISCLAIMER =
  'This reference is provided for informational and supportive home care guidance only based on official classical texts. It is NOT a medical prescription or individualized treatment plan. Consult a qualified Ayurvedic physician (B.A.M.S.) or medical practitioner.';

export class AyurvedaKnowledgeService {
  private records: AyurvedaKnowledgeRecord[] = [];
  private isLoaded: boolean = false;

  constructor() {
    this.loadRecords();
  }

  /**
   * Loads all 22 official statutory records from backend/src/data/ayurveda/ingested_records.json
   */
  private loadRecords(): void {
    try {
      const recordsPath = path.resolve(__dirname, '../data/ayurveda/ingested_records.json');
      if (!fs.existsSync(recordsPath)) {
        console.warn('[AyurvedaKnowledgeService] Warning: ingested_records.json not found at', recordsPath);
        return;
      }

      const rawData = fs.readFileSync(recordsPath, 'utf8');
      const parsed = JSON.parse(rawData);

      const allRecords: AyurvedaKnowledgeRecord[] = [];
      if (parsed.source_records) {
        for (const [_, sourceList] of Object.entries(parsed.source_records)) {
          if (Array.isArray(sourceList)) {
            allRecords.push(...(sourceList as AyurvedaKnowledgeRecord[]));
          }
        }
      }

      this.records = allRecords;
      this.isLoaded = true;
      console.info(`[AyurvedaKnowledgeService] Successfully loaded ${this.records.length} statutory records (CCRAS & API Part II Vol II).`);
    } catch (err: any) {
      console.error('[AyurvedaKnowledgeService] Error loading ingested_records.json:', err.message);
    }
  }

  public getRecordCount(): number {
    return this.records.length;
  }

  /**
   * Deterministic matching & clinical safety gate evaluation.
   *
   * @param symptomTerms Patient reported symptoms (e.g. ['stomach burning', 'indigestion', 'cough'])
   * @param patientAllergies Known allergies from patient profile
   * @param chronicConditions Known medical conditions (e.g. ['Hypertension', 'Diabetes'])
   * @param severityScore Clinical severity score 0-100 (if >= 60, remedies are strictly BLOCKED)
   * @param redFlagsDetected Array of active emergency red flags
   * @param patientDemographics Patient age & gender (pediatrics <12 or pregnancy caution)
   */
  public evaluateAyurveda(
    symptomTerms: string[],
    patientAllergies: string[] = [],
    chronicConditions: string[] = [],
    severityScore: number = 0,
    redFlagsDetected: string[] = [],
    patientDemographics?: { age?: number | null; gender?: string | null; isPregnant?: boolean }
  ): AyurvedaEvaluationResult {
    if (!this.isLoaded || this.records.length === 0) {
      this.loadRecords();
    }

    const blockedReasons: string[] = [];
    const isEmergency = redFlagsDetected.length > 0;
    const isSevere = severityScore >= 60;

    // 1. ABSOLUTE CLINICAL SAFETY LOCK
    // If severity score >= 60-70 or red flags detected, home remedies are strictly BLOCKED.
    if (isEmergency) {
      blockedReasons.push(`Medical red flags active (${redFlagsDetected.join(', ')}). Immediate consultation required. Ayurvedic home remedies strictly blocked.`);
    }
    if (isSevere) {
      blockedReasons.push(`Clinical severity score (${severityScore}/100) indicates significant distress. Direct physician consultation required.`);
    }

    if (isEmergency || isSevere) {
      return {
        decision: 'blocked',
        summary: 'Ayurvedic remedy recommendations are blocked due to elevated clinical severity or emergency red flags.',
        recommendations: [],
        blocked_reasons: blockedReasons,
        safety_findings_summary: {
          red_flag_status: isEmergency ? 'red_flags_detected' : 'none',
          risk_level: severityScore >= 80 ? 'CRITICAL' : 'HIGH',
          severity_score: severityScore,
          immediate_attention_required: true,
        },
        provenance_sources: [],
        disclaimer: 'Ayurveda knowledge is grounded strictly in approved government references (API Part II Vol II, CCRAS Home Remedies). Emergency care takes absolute priority.',
        non_prescription_disclaimer: MANDATORY_NON_PRESCRIPTION_DISCLAIMER,
      };
    }

    // 2. TOKEN NORMALIZATION & MATCHING
    const normalizedQueryTokens = this.normalizeQueryTerms(symptomTerms);
    if (normalizedQueryTokens.length === 0) {
      return {
        decision: 'eligible',
        summary: 'No specific symptom indications provided for Ayurvedic matching.',
        recommendations: [],
        blocked_reasons: [],
        safety_findings_summary: {
          red_flag_status: 'none',
          risk_level: 'LOW',
          severity_score: severityScore,
          immediate_attention_required: false,
        },
        provenance_sources: [],
        disclaimer: 'Ayurveda knowledge in VaidyaArc is grounded strictly in approved government references (API Part II Vol II, CCRAS Home Remedies).',
        non_prescription_disclaimer: MANDATORY_NON_PRESCRIPTION_DISCLAIMER,
      };
    }

    // 3. SCORING CANDIDATES
    interface ScoredCandidate {
      record: AyurvedaKnowledgeRecord;
      matchingSymptom: string;
      rankScore: number;
    }

    const scoredCandidates: ScoredCandidate[] = [];

    for (const record of this.records) {
      // Ksharasutra (procedural device) cannot be self-administered
      if (record.record_id === 'API2_FORM_051_KSHARASUTRA') {
        continue;
      }

      let bestScoreForRecord = 0;
      let matchedToken = '';

      for (const token of normalizedQueryTokens) {
        let score = 0;

        // Exact indication match: +8.0
        const hasExactIndication = record.traditional_indications.some(
          (ind) => ind.toLowerCase().trim() === token
        );
        if (hasExactIndication) {
          score = Math.max(score, 8.0);
        }

        // Substring indication match (min 4 chars): +5.0
        if (token.length >= 4) {
          const hasPartialIndication = record.traditional_indications.some(
            (ind) => ind.toLowerCase().includes(token) || token.includes(ind.toLowerCase())
          );
          if (hasPartialIndication) {
            score = Math.max(score, 5.0);
          }
        }

        // Name or alias match: +4.0
        const hasNameMatch =
          record.name.toLowerCase().includes(token) ||
          record.aliases.some((a) => a.toLowerCase().includes(token));
        if (hasNameMatch) {
          score = Math.max(score, 4.0);
        }

        if (score > bestScoreForRecord) {
          bestScoreForRecord = score;
          matchedToken = token;
        }
      }

      if (bestScoreForRecord > 0) {
        // Authority Level Bonus
        const authorityBonus = record.authority_level === 'primary_official' ? 100.0 : 10.0;
        const totalRankScore = authorityBonus + bestScoreForRecord;

        scoredCandidates.push({
          record,
          matchingSymptom: matchedToken,
          rankScore: totalRankScore,
        });
      }
    }

    // Sort descending by rank score
    scoredCandidates.sort((a, b) => b.rankScore - a.rankScore);

    // 4. SAFETY & CONTRAINDICATION FILTERING
    const eligibleRecommendations: AyurvedaRecommendationItem[] = [];
    const lowerAllergies = patientAllergies.map((a) => a.toLowerCase().trim()).filter(Boolean);
    const lowerConditions = chronicConditions.map((c) => c.toLowerCase().trim()).filter(Boolean);
    const isHypertensive = lowerConditions.some((c) => c.includes('hypertens') || c.includes('high bp') || c.includes('blood pressure'));
    const isPediatric = patientDemographics?.age != null && patientDemographics.age < 12;

    for (const { record, matchingSymptom } of scoredCandidates) {
      // 4.1 Allergy check
      const recordNamesAndIngredients = [
        record.name.toLowerCase(),
        ...record.aliases.map((a) => a.toLowerCase()),
        ...record.ingredients.map((i) => i.toLowerCase()),
      ];

      const hasAllergyConflict = lowerAllergies.some((allergy) =>
        recordNamesAndIngredients.some((item) => item.includes(allergy) || allergy.includes(item))
      );

      if (hasAllergyConflict) {
        blockedReasons.push(`Blocked ${record.name}: Patient allergy conflict detected.`);
        continue;
      }

      // 4.2 Hypertension Contraindication check (e.g. Bhaskaralavana Churna has >14% sodium)
      if (record.record_id === 'API2_FORM_029_BHASKARALAVANA' && isHypertensive) {
        blockedReasons.push(`Blocked ${record.name}: High mineral salt content contraindicated in hypertension.`);
        continue;
      }

      // 4.3 Demographic caution
      if (isPediatric && record.record_type === 'pharmacopoeial_formulation') {
        blockedReasons.push(`Blocked ${record.name}: Pharmacopoeial formulations require direct pediatric clinician review.`);
        continue;
      }

      // Pick the best matching indication detail
      let bestDetail = record.indication_details.find((d) =>
        d.indication.toLowerCase().includes(matchingSymptom) || matchingSymptom.includes(d.indication.toLowerCase())
      );
      if (!bestDetail && record.indication_details.length > 0) {
        bestDetail = record.indication_details[0];
      }

      const prepSummary = bestDetail?.preparation || record.preparation_method || record.formulation_form;
      const dosageRef = bestDetail?.source_dosage || record.source_dosage_info || 'Consult physician for adult dosage';

      if (eligibleRecommendations.length < 3) {
        eligibleRecommendations.push({
          record_id: record.record_id,
          name: record.name,
          remedy_type: record.record_type,
          matching_symptom: matchingSymptom,
          authority_level: record.authority_level,
          preparation_summary: prepSummary,
          source_dosage_reference: dosageRef,
          anupana_reference: record.anupana || null,
          safety_notes: record.safety_notes || [],
          warnings: record.warnings || [],
          limitations: record.limitations || [],
          provenance: record.provenance,
          prescription_disclaimer: MANDATORY_NON_PRESCRIPTION_DISCLAIMER,
        });
      }
    }

    const provenanceSet = new Set(eligibleRecommendations.map((r) => r.provenance.source_id));

    return {
      decision: eligibleRecommendations.length > 0 ? 'eligible' : 'blocked',
      summary: eligibleRecommendations.length > 0
        ? `Identified ${eligibleRecommendations.length} evidence-backed home remedy recommendation(s) grounded in approved official sources.`
        : 'No suitable home remedies matched without clinical contraindications.',
      recommendations: eligibleRecommendations,
      blocked_reasons: blockedReasons,
      safety_findings_summary: {
        red_flag_status: 'none',
        risk_level: severityScore >= 40 ? 'MODERATE' : 'LOW',
        severity_score: severityScore,
        immediate_attention_required: false,
      },
      provenance_sources: Array.from(provenanceSet),
      disclaimer: 'Ayurveda knowledge in VaidyaArc is grounded strictly in approved government references (API Part II Vol II, CCRAS Home Remedies). Recommendations do not replace physician examination.',
      non_prescription_disclaimer: MANDATORY_NON_PRESCRIPTION_DISCLAIMER,
    };
  }

  private normalizeQueryTerms(terms: string[]): string[] {
    const tokens: Set<string> = new Set();
    for (const term of terms) {
      if (!term || typeof term !== 'string') continue;
      const cleaned = term.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
      if (!cleaned) continue;

      // Add full compound phrase
      if (cleaned.length >= 3) {
        tokens.add(cleaned);
      }

      // Add individual words
      const words = cleaned.split(/\s+/).filter((w) => w.length >= 3);
      for (const word of words) {
        tokens.add(word);
      }
    }
    return Array.from(tokens);
  }
}

export const ayurvedaKnowledgeService = new AyurvedaKnowledgeService();
export default ayurvedaKnowledgeService;
