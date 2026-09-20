import axios from 'axios';
import {
  NormalizedClinicalInputDTO,
  TurnResponseDTO,
} from './clinicalBrain.service';
import {
  ayurvedaKnowledgeService,
  AyurvedaEvaluationResult,
} from './ayurvedaKnowledge.service';

export interface EpisodeClinicalState {
  episodeId: string;
  patientId: string;
  chiefComplaint: string | null;
  intakeSlots: {
    onset?: string;
    duration?: string;
    severity?: number; // 1-10 scale
    location?: string;
    radiation?: string;
    character?: string; // burning, sharp, dull, throbbing
    aggravatingFactors?: string[];
    relievingFactors?: string[];
    associatedSymptoms?: string[];
  };
  vitalsMentioned: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: string;
    bloodSugar?: string;
  };
  severityScore: number; // 0-100 clinical scale
  redFlagsChecked: boolean;
  redFlagsPresent: string[];
  missingSlots: string[];
  triageDisposition: 'self_care' | 'routine_consult' | 'urgent_clinic' | 'emergency';
  remediesOffered: {
    remedy: string;
    recordId: string;
    offeredAt: string;
    source: string;
    status?: 'suggested' | 'taken' | 'in_progress' | 'discontinued';
    reliefReported?: 'significant_relief' | 'partial_relief' | 'no_change' | 'worsened' | 'pending';
    patientFeedback?: string;
  }[];
  patientReportedResponse?: 'improved' | 'same' | 'worsened' | 'unknown';
  consultationRecommended: boolean;
  preConsultationReport?: {
    generatedAt: string;
    patientId: string;
    episodeId: string;
    chiefComplaint: string;
    hpiSummary: string;
    severityScore: number;
    timeline: string[];
    remediesTried: string[];
    redFlags: string[];
    recommendedSpecialty: string;
    doctorSummarySOAP: {
      subjective: string;
      objective: string;
      assessment: string;
      plan: string;
      highlightedProblem?: string;
    };
  } | null;
  consultationQuestions?: any[];
  dashavidhaState?: Record<string, any>;
  pendingEpisodeConfirmation?: {
    detectedNewComplaint: string;
    askedAt: string;
  } | null;
  pendingReportPermission?: boolean;
  clinicalReportGenerated?: boolean;
  // Adaptive chronic risk probe — tracks conversational outcomes across turns.
  // Gemini owns clinical reasoning; TypeScript only records what was surfaced.
  chronicRiskProbe?: {
    isActive: boolean;
    detectedChronic: boolean;
    chronicTrigger: string;
    alarmSignsFound: string[];       // Signs patient confirmed (enriches doctor report only)
    priorTreatmentsSummary: string;  // What patient said they've tried (enriches doctor report)
    riskExplainedToPatient: boolean; // Has the empathetic explanation been delivered?
    consentRequested: boolean;       // Has consent for the summary been requested?
  };
  turnCount: number;
  lastUpdated: string;
}

export function isPlaceholderOrConversationalComplaint(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return true;
  const s = val.trim();
  if (s.length < 2) return true;
  // Indic script check (Telugu, Devanagari, Tamil, Kannada, Malayalam, Bengali, etc.)
  if (/[\u0900-\u0D7F]/.test(s)) return true;
  const lower = s.toLowerCase();
  if (
    lower.includes('voice consultation') ||
    lower.includes('ai triage') ||
    lower.includes('clinical consultation') ||
    lower.includes('symptom intake') ||
    lower.includes('health intake') ||
    lower.includes('general health assessment') ||
    lower.includes('clinical evaluation') ||
    lower === 'symptom' ||
    lower === 'discomfort' ||
    lower === 'pain'
  ) {
    return true;
  }
  if (s.endsWith('.') || s.endsWith('?')) {
    return true;
  }
  return false;
}

export class GeminiNurseBrainService {
  private geminiApiKey: string | undefined;
  private primaryModel: string;

  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.primaryModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  }

  /**
   * Main entry point: Processes a clinical conversation turn using Gemini 3.5 Flash,
   * deterministic Ayurvedic safety matching, and persistent episode state memory.
   */
  async processClinicalTurn(input: NormalizedClinicalInputDTO): Promise<TurnResponseDTO> {
    const apiKey = process.env.GEMINI_API_KEY || this.geminiApiKey;
    if (!apiKey) {
      throw new Error('[GeminiNurseBrainService] GEMINI_API_KEY is not configured in environment.');
    }

    const patientId = input.patient_id || 'unknown_patient';
    const episodeId = input.episode_id || 'unknown_episode';

    // 1. REHYDRATE OR INITIALIZE EPISODE MEMORY (strictly isolated by patientId + episodeId)
    let stateSnapshot: EpisodeClinicalState = this.initializeOrMigrateState(
      input.state_snapshot,
      patientId,
      episodeId
    );
    stateSnapshot.turnCount = (stateSnapshot.turnCount || 0) + 1;

    const isFollowUpTurn =
      stateSnapshot.remediesOffered &&
      stateSnapshot.remediesOffered.length > 0 &&
      stateSnapshot.turnCount > 1;

    // 2. COMPOSE GEMINI SYSTEM & CONVERSATIONAL INTAKE PROMPT
    const patientMessageText =
      input.message.original_text ||
      input.message.english_text ||
      '';
    const patientLanguage = input.message.original_language || 'en';

    // 2A. RECALL LONGITUDINAL EPISODE MEMORY (alarm signs, prior care, risk patterns across turns)
    const longitudinalMemoryBlock = this.buildLongitudinalRiskContext(stateSnapshot);

    const systemPrompt = `
You are the VaidyaArc "Smart Health Companion" — an empathetic, attentive, caring, and clinically knowledgeable friend and personal health guide.
Your mission is to care for the patient like a warm, supportive companion who looks after their health journey across days.

CONVERSATIONAL PERSONA & TONE RULES:
1. NEVER INTERROGATE & NEVER CONFUSE:
   - DO NOT sound like a clinical doctor or an interrogation bot.
   - NEVER ask the patient to "rate pain on a scale of 1 to 10".
   - NEVER ask multiple questions in a single turn. Ask ONLY 1 simple, gentle, friendly check-in question at a time.
   - Use warm, everyday language. Do not use confusing clinical jargon.
2. NO REPETITIVE INTRODUCTIONS:
   - DO NOT say "I am your Smart Health Companion" on every turn. Jump straight into warm, natural, caring conversation.
3. RELATIVE & CONTINUOUS CONVERSATIONAL FLOW:
   - Always start by warmly acknowledging how the patient is feeling relative to what was discussed in previous turns.
   - If they took a remedy, gently ask if it gave them any relief or comfort.
   - If they are returning today, check if they are feeling a bit better or if the discomfort persists.
4. NO BRACKETED ENGLISH WORDS IN REGIONAL LANGUAGES:
   - In regional languages (Telugu, Hindi, Tamil, etc.), speak purely and naturally in that script.
   - DO NOT include English translations in parentheses like "(Smart Health Companion)", "(Dhania)", or "(acidity)".

5. CLINICAL ESCALATION & LONGITUDINAL RISK CONVERGENCE PROTOCOL (ALWAYS ACTIVE ACROSS ALL DISEASES):
   You possess deep clinical acuity to identify both acute emergencies AND insidious, chronic conditions that patients or past episodic consultations often miss.

   A) ACUTE HIGH-RISK PRESENTATIONS:
      - When severe acute symptoms appear (chest pain, severe breathlessness, stroke signs, sudden severe pain, high acute fever):
        * Prioritize immediate safety, express comforting reassurance, and recommend immediate physician evaluation.
        * Set "request_report_permission": true or trigger emergency clinical output.

   B) LONGITUDINAL / INSIDIOUS RISK CONVERGENCE (TB, EARLY CANCERS, OCCULT STROKE/TIA, SILENT CARDIAC/RENAL DECLINE):
      - CLINICAL BACKGROUND:
        A critical failure mode in healthcare is episodic fragmentation: a patient with a 6-month chronic cough treats it as a "seasonal cough", visiting doctors intermittently for cough syrups and short antibiotic courses without anyone connecting the dots until late-phase disease (such as Phase-2 pulmonary tuberculosis with cavitation, or bronchogenic carcinoma).
        Similarly, subtle transient neurological deficits (TIAs), insidious gastrointestinal lesions, or constitutional decline (unexplained weight loss, evening fevers) are frequently ignored.
      - ALWAYS-ON ADAPTIVE DETECTION (ANY LANGUAGE, ANY PHRASING):
        Listen attentively in ANY language (${patientLanguage}) for:
        * Chronicity (> 2-3 weeks, months, recurring episodes, or prolonged duration).
        * Refractoriness (symptoms persisting despite syrups, home remedies, or prior clinic visits).
        * Insidious progression or unexplained functional decline.
      - ADAPTIVE, FLUID INTAKE (ZERO INTERROGATION, NO FIXED TURNS):
        * DO NOT use a rigid script or count turns. Decide next steps based on CLINICAL SUFFICIENCY.
        * If a patient shares extensive details in a single message (e.g. mentions 6-month cough, weight loss, evening fevers, and multiple unhelpful doctor visits), DO NOT ask redundant questions! Immediately assimilate their complete story in that turn.
        * If details are sparse, gently explore missing clinical facets across turns with warmth:
          1. Trajectory & Duration: How long has it persisted, and is it worsening?
          2. Cardinal Alarm Symptoms: Gently check for systemic alarm features suited to the body system:
             • Respiratory/Chest: Low-grade evening fevers, night sweats, unintentional weight loss, loss of appetite, blood flecks in sputum.
             • Gastrointestinal: Unintended weight loss, swallowing difficulty, dark/tarry stools, persistent vomiting.
             • Neurological: Transient limb weakness, subtle speech difficulty, visual disturbances, morning headaches.
             • Cardiac/Vascular: Exertional shortness of breath, orthopnea, bilateral ankle swelling, syncopal episodes.
             • Systemic/General: Profound unprovoked fatigue, swollen lymph nodes, recurrent infections.
          3. Prior Medical Care & Fragmented Treatments:
             • Gently ask if they have consulted clinics or taken antibiotics/medicines/tests (X-ray, blood tests) previously.
        * Ask ONLY ONE caring question per turn. Never fire a multi-item checklist.
      - EMPATHETIC, NON-ALARMIST PATIENT DIALOGUE:
        * In chat with the patient, NEVER frighten them with alarming disease names (STRICTLY FORBIDDEN: "You may have Tuberculosis", "You might have Cancer", "You could be having a stroke").
        * Instead, explain empathetically:
          "Dealing with this for so long must be very wearing on you. Because these symptoms have continued for [duration] despite previous medicines, persistent symptoms like this really deserve a proper in-depth medical evaluation to find the root cause early. This is the right time to consult a specialist."
      - CONSENT-GATED PRE-CONSULTATION SUMMARY:
        * Politely ask for consent in ${patientLanguage}:
          "With your permission, shall I prepare your complete Pre-Consultation Summary with your full timeline and details so your doctor has the full picture and nothing gets overlooked?"
        * Set "request_report_permission": true, "patient_consented_to_report": false.
        * When the patient confirms ("yes", "please prepare", "okay", "sure", "అవును", "తయారు చేయండి", etc.):
          - Set "patient_consented_to_report": true.
          - Inform them warmly: "I have prepared your complete Clinical Assessment Report in real-time. You can preview it below to show your doctor."
      - HIGH-ACUITY DOCTOR DIFFERENTIAL & INVESTIGATIONS (SOAP REPORT):
        * While the patient receives comfort, the doctor receives a sharp, unabridged clinical workup.
        * In "pre_consultation_summary":
          - "highlighted_problem": State the clinical risk convergence clearly (e.g. "Chronic Refractory Productive Cough (6-Month Course) – Risk Convergence: Rule Out Pulmonary Tuberculosis, Bronchiectasis, Occult Pulmonary Neoplasm").
          - "soap_assessment": Explicit differential diagnosis synthesizing chronicity, lack of response to prior empiric therapy, and cardinal alarm features.
          - "soap_plan": Specific high-yield diagnostic investigations to order (e.g. Chest X-ray PA view, Sputum AFB / GeneXpert CBNAAT, CBC with ESR, high-resolution imaging) to prevent the doctor from repeating another routine prescription.

6. UNRELATED NEW PROBLEM DETECTION & PATIENT CONFIRMATION:
   - Compare the patient's statement against the active episode complaint: "${stateSnapshot.chiefComplaint || 'None yet'}".
   - IF the patient is continuing the same issue or reporting remedies/follow-up:
     -> Set "unrelated_problem_detected": false.
   - IF the patient reports a COMPLETELY UNRELATED medical problem (e.g. active episode is stomach acidity, but patient reports ankle twist/fracture or eye infection):
     -> Set "unrelated_problem_detected": true
     -> Set "detected_new_complaint": "Concise clinical title of the new problem"
     -> In nurse_dialogue, politely ask for confirmation in the patient's language (${patientLanguage}):
        "I notice you are describing [new problem], which seems different from your ongoing [current complaint]. Would you like to start a separate health episode for this while keeping your current consultation active?"
   - IF stateSnapshot.pendingEpisodeConfirmation is already set:
     -> If the patient confirms/accepts ("yes", "start new", "sure", "correct", etc.):
        Set "confirm_start_new_episode": true
        In nurse_dialogue, warmly acknowledge starting the new episode and ask the first gentle question about the new problem.
     -> If the patient says "no" or clarifies it's related:
        Set "confirm_start_new_episode": false
        Continue under the existing episode.

${longitudinalMemoryBlock}

PATIENT & EPISODE CONTEXT:
- Demographics: Age ${input.patient_profile?.age || 'Unspecified'}, Gender ${input.patient_profile?.sex || 'Unspecified'}
- Known Allergies: ${(input.patient_profile?.allergies || []).join(', ') || 'None reported'}
- Known Conditions: ${(input.patient_profile?.medical_conditions || []).join(', ') || 'None reported'}
- Episode Active State: ${JSON.stringify(stateSnapshot, null, 2)}
- Is Follow-up Session: ${isFollowUpTurn ? 'YES (Patient previously received guidance and is reporting current status)' : 'NO (Ongoing initial intake)'}

OUTPUT SCHEMA:
Respond with strictly valid JSON only:
{
  "nurse_dialogue": "Warm, caring, single-sentence check-in or guidance in the patient's language (${patientLanguage}).",
  "request_report_permission": boolean,
  "patient_consented_to_report": boolean,
  "unrelated_problem_detected": boolean,
  "detected_new_complaint": "string or null",
  "confirm_start_new_episode": boolean,
  "extracted_slots": {
    "chiefComplaint": "string or null - A concise, professional clinical complaint in English (e.g. 'Acute Lower Extremity Pain', 'Right Knee Pain', 'Epigastric Burning', 'Persistent Cough'). NEVER output raw conversational phrases or regional non-English script.",
    "onset": "string or null",
    "duration": "string or null",
    "severity_1_to_10": number or null,
    "location": "string or null",
    "radiation": "string or null",
    "character": "string or null",
    "associatedSymptoms": ["string"]
  },
  "remedy_tracking": {
    "remedy_name": "string or null",
    "status": "suggested" | "taken" | "in_progress" | "not_taken" | "unmentioned",
    "relief_outcome": "significant_relief" | "partial_relief" | "no_change" | "worsened" | "pending",
    "patient_feedback": "string or null"
  },
  "symptom_trajectory": "improving" | "stable" | "worsening" | "new_symptom",
  "severity_score_0_to_100": number,
  "red_flags_present": ["string"],
  "consultation_recommended": boolean,
  "recommended_specialty": "string (e.g. Gastroenterology, Pulmonology, General Medicine, Cardiology, Neurology)",
  "consultation_questions": [
    {
      "question": "Clear, doctor-ready question the patient can ask their physician",
      "priority": "high" | "medium" | "standard",
      "category": "diagnostic_investigation" | "symptom_management" | "medication_review" | "lifestyle_guidance",
      "rationale": "Why this question is clinically valuable for this specific case"
    }
  ],
  "dashavidha_synthesis": {
    "vikriti": {
      "observations": ["Specific clinical observations of doshic morbidity and Srotas disturbance"],
      "dosha_involved": "Pitta" | "Vata" | "Kapha" | "Sannipata",
      "srotas": "Annavaha" | "Pranavaha" | "Rasavaha" | "Purishavaha" | "Other",
      "note": "Short non-diagnostic Ayurvedic clinical correlation"
    },
    "ahara_shakti": {
      "observations": ["Observations on appetite, digestion speed, acid burning, or bloating"],
      "agni_status": "Mandagni" | "Tikshnagni" | "Vishamagni" | "Samagni",
      "note": "Agni functional assessment"
    },
    "satmya": {
      "dietary_habits": "string (e.g. spicy food, irregular meals, vegetarian)",
      "observations": ["Dietary tolerance and habits"],
      "note": "Habituation assessment"
    },
    "sattva": {
      "observations": ["Patient psychological composure, distress level, or resilience"],
      "resilience_level": "Pravara (High)" | "Madhyama (Moderate)" | "Avara (Low)",
      "note": "Mental fortitude evaluation"
    },
    "vyayama_shakti": {
      "observations": ["Physical activity capacity, fatigue, weakness"],
      "functional_capacity": "Good" | "Moderate" | "Impaired / Fatigue",
      "note": "Physical endurance capacity"
    }
  },
  "pre_consultation_summary": {
    "highlighted_problem": "Focal clinical problem title in English (e.g. Acute Epigastric Burning & Suspected Acid Peptic Disorder, or Acute Lower Extremity Discomfort & Gait Impairment)",
    "hpiSummary": "Concise medical history in English for the doctor",
    "soap_subjective": "Doctor SOAP subjective note capturing patient symptoms, timeline, and triggers",
    "soap_objective": "Doctor SOAP objective observations, vitals, distress level, and calculated severity score",
    "soap_assessment": "Doctor SOAP clinical assessment and differential considerations",
    "soap_plan": "Doctor SOAP recommended triage plan, diagnostic workup, and dietary precautions"
  },
  "risk_convergence": {
    "pattern_detected": "boolean - true if any insidious, chronic (>2-3 weeks), or refractory risk trajectory is identified",
    "suspected_risk_nature": "string or null - concise clinical nature of the risk pattern (e.g. '6-month chronic cough with systemic B-symptoms and refractory antibiotic history; rule out pulmonary TB or occult neoplasm')",
    "alarm_features_identified": ["string - specific cardinal alarm symptoms confirmed by patient (e.g. 'evening fevers', 'night sweats', 'weight loss')"],
    "prior_treatments_noted": "string or null - summary of past clinic visits, syrups, antibiotics, or tests tried by patient",
    "clinical_evidence_sufficient": "boolean - true if the clinical picture is sufficiently understood to move to empathetic risk explanation and consent",
    "risk_explained_to_patient": "boolean - true if you delivered the empathetic, non-alarmist risk explanation in nurse_dialogue this turn",
    "consent_requested": "boolean - true if you asked for permission to generate the Pre-Consultation Summary this turn"
  }
}
`;

    const historyText =
      input.previous_conversations && input.previous_conversations.length > 0
        ? input.previous_conversations
            .map((m: any) => `${m.role === 'patient' ? 'Patient' : 'Smart Health Companion'}: "${m.content}"`)
            .join('\n')
        : 'No prior dialogue turns in this episode yet.';

    const userPrompt = `
RECENT DIALOGUE TURNS IN THIS EPISODE:
${historyText}

Patient's Latest Spoken / Written Message:
"${patientMessageText}"

Clinical Companion Mission:
- Empathize warmly in ${patientLanguage}. Ask ONLY 1 simple, gentle check-in question at a time. Zero interrogation.
- ALWAYS-ON ADAPTIVE RISK CONVERGENCE:
  • Identify any chronic, insidious, or refractory trajectory (e.g. chronic cough, unresolving weakness, progressive weight loss) in any language.
  • Evaluate clinical sufficiency adaptively. If the patient already provided rich history in this turn or earlier, immediately synthesize it without asking redundant questions!
  • If key clinical facets are missing, gently explore trajectory, alarm symptoms, and prior care with compassion.
  • When risk is established, explain empathetically without alarming disease names, and seek consent to prepare the Pre-Consultation Summary.
  • In the doctor's pre_consultation_summary, deliver a high-acuity differential (SOAP assessment & targeted investigations).
Return strictly valid JSON only.
`;

    // 3. EXECUTE GEMINI CALL WITH MODEL FALLBACK (Fastest responsive models first)
    const candidateModels = [
      this.primaryModel || 'gemini-3.5-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-flash-latest',
    ].filter((v, i, a) => a.indexOf(v) === i);

    let rawLlmOutput = '';
    let parsedLlm: any = null;

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [
            {
              parts: [
                { text: systemPrompt },
                { text: userPrompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            response_mime_type: 'application/json',
          },
        };

        const response = await axios.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 9000,
        });

        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          rawLlmOutput = response.data.candidates[0].content.parts[0].text;
          const cleaned = rawLlmOutput
            .trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```$/i, '')
            .trim();
          parsedLlm = JSON.parse(cleaned);
          break; // Success!
        }
      } catch (err: any) {
        console.warn(`[GeminiNurseBrainService] Model ${model} failed:`, err.response?.data?.error?.message || err.message);
      }
    }

    if (!parsedLlm) {
      throw new Error('[GeminiNurseBrainService] Failed to receive structured response from Gemini models.');
    }

    // Handle Unrelated Problem Confirmation State
    if (parsedLlm.unrelated_problem_detected && parsedLlm.detected_new_complaint) {
      stateSnapshot.pendingEpisodeConfirmation = {
        detectedNewComplaint: parsedLlm.detected_new_complaint,
        askedAt: new Date().toISOString(),
      };
    } else if (parsedLlm.confirm_start_new_episode) {
      stateSnapshot.pendingEpisodeConfirmation = null;
    }

    // Handle Report Permission & Real-Time Generation State
    if (parsedLlm.request_report_permission) {
      stateSnapshot.pendingReportPermission = true;
    }
    if (parsedLlm.patient_consented_to_report) {
      stateSnapshot.pendingReportPermission = false;
      stateSnapshot.clinicalReportGenerated = true;
    }

    // 3B. MERGE RISK CONVERGENCE & LONGITUDINAL PROBE OUTCOMES
    // Gemini owns the clinical reasoning across any language; TypeScript persists findings for doctor report
    const rc = parsedLlm.risk_convergence;
    if (rc && typeof rc === 'object') {
      if (rc.pattern_detected || stateSnapshot.chronicRiskProbe?.isActive) {
        if (!stateSnapshot.chronicRiskProbe) {
          stateSnapshot.chronicRiskProbe = {
            isActive: true,
            detectedChronic: Boolean(rc.pattern_detected),
            chronicTrigger: rc.suspected_risk_nature || 'Longitudinal risk pattern identified',
            alarmSignsFound: [],
            priorTreatmentsSummary: '',
            riskExplainedToPatient: false,
            consentRequested: false,
          };
        } else {
          stateSnapshot.chronicRiskProbe.isActive = true;
          if (rc.suspected_risk_nature) {
            stateSnapshot.chronicRiskProbe.chronicTrigger = rc.suspected_risk_nature;
          }
        }

        if (Array.isArray(rc.alarm_features_identified) && rc.alarm_features_identified.length > 0) {
          stateSnapshot.chronicRiskProbe.alarmSignsFound = Array.from(
            new Set([
              ...stateSnapshot.chronicRiskProbe.alarmSignsFound,
              ...rc.alarm_features_identified.filter(Boolean),
            ])
          );
        }

        if (rc.prior_treatments_noted && typeof rc.prior_treatments_noted === 'string') {
          stateSnapshot.chronicRiskProbe.priorTreatmentsSummary = rc.prior_treatments_noted.trim();
        }

        if (rc.risk_explained_to_patient === true) {
          stateSnapshot.chronicRiskProbe.riskExplainedToPatient = true;
        }

        if (rc.consent_requested === true || parsedLlm.request_report_permission === true) {
          stateSnapshot.chronicRiskProbe.consentRequested = true;
        }
      }
    }

    // 4. CUMULATIVE MERGE WITH EPISODE MEMORY (Never erase existing data)
    const extractedSlots = parsedLlm.extracted_slots || {};
    const clinicalComplaintCandidate =
      (typeof parsedLlm.pre_consultation_summary?.highlighted_problem === 'string' && parsedLlm.pre_consultation_summary.highlighted_problem.trim()) ||
      (typeof extractedSlots.chiefComplaint === 'string' && extractedSlots.chiefComplaint.trim()) ||
      null;

    if (
      clinicalComplaintCandidate &&
      (!stateSnapshot.chiefComplaint || isPlaceholderOrConversationalComplaint(stateSnapshot.chiefComplaint))
    ) {
      stateSnapshot.chiefComplaint = clinicalComplaintCandidate;
    }

    stateSnapshot.intakeSlots = {
      onset: extractedSlots.onset || stateSnapshot.intakeSlots.onset,
      duration: extractedSlots.duration || stateSnapshot.intakeSlots.duration,
      severity: extractedSlots.severity_1_to_10 ?? stateSnapshot.intakeSlots.severity,
      location: extractedSlots.location || stateSnapshot.intakeSlots.location,
      radiation: extractedSlots.radiation || stateSnapshot.intakeSlots.radiation,
      character: extractedSlots.character || stateSnapshot.intakeSlots.character,
      aggravatingFactors: Array.from(
        new Set([
          ...(stateSnapshot.intakeSlots.aggravatingFactors || []),
          ...(extractedSlots.aggravatingFactors || []),
        ])
      ),
      relievingFactors: Array.from(
        new Set([
          ...(stateSnapshot.intakeSlots.relievingFactors || []),
          ...(extractedSlots.relievingFactors || []),
        ])
      ),
      associatedSymptoms: Array.from(
        new Set([
          ...(stateSnapshot.intakeSlots.associatedSymptoms || []),
          ...(extractedSlots.associatedSymptoms || []),
        ])
      ),
    };

    const newSeverityScore = parsedLlm.severity_score_0_to_100 ?? stateSnapshot.severityScore ?? 30;
    stateSnapshot.severityScore = newSeverityScore;

    const detectedRedFlags = parsedLlm.red_flags_present || [];
    if (detectedRedFlags.length > 0) {
      stateSnapshot.redFlagsChecked = true;
      stateSnapshot.redFlagsPresent = Array.from(
        new Set([...stateSnapshot.redFlagsPresent, ...detectedRedFlags])
      );
    }

    // Remedy tracking & adherence merge
    const remedyTracking = parsedLlm.remedy_tracking;
    if (remedyTracking && remedyTracking.status && remedyTracking.status !== 'unmentioned') {
      const matchIndex = stateSnapshot.remediesOffered.findIndex(
        (r) =>
          !remedyTracking.remedy_name ||
          r.remedy.toLowerCase().includes(remedyTracking.remedy_name.toLowerCase()) ||
          remedyTracking.remedy_name.toLowerCase().includes(r.remedy.toLowerCase())
      );
      if (matchIndex !== -1) {
        stateSnapshot.remediesOffered[matchIndex].status = remedyTracking.status;
        stateSnapshot.remediesOffered[matchIndex].reliefReported = remedyTracking.relief_outcome;
        stateSnapshot.remediesOffered[matchIndex].patientFeedback = remedyTracking.patient_feedback || undefined;
      }
    }

    stateSnapshot.patientReportedResponse =
      parsedLlm.symptom_trajectory === 'improving'
        ? 'improved'
        : parsedLlm.symptom_trajectory === 'worsening'
        ? 'worsened'
        : stateSnapshot.patientReportedResponse || 'unknown';

    stateSnapshot.consultationRecommended = Boolean(
      parsedLlm.consultation_recommended ||
      newSeverityScore >= 60 ||
      detectedRedFlags.length > 0 ||
      parsedLlm.symptom_trajectory === 'worsening'
    );

    // 5. DETERMINISTIC STATUTORY & CLASSICAL AYURVEDIC RETRIEVAL (CCRAS, API-II, Charaka, Sushruta, Ashtanga Hridaya, Sahasrayogam)
    const symptomTerms = [
      stateSnapshot.chiefComplaint || '',
      ...(stateSnapshot.intakeSlots.associatedSymptoms || []),
      stateSnapshot.intakeSlots.character || '',
    ].filter(Boolean);

    let ayurvedaEval: AyurvedaEvaluationResult = ayurvedaKnowledgeService.evaluateAyurveda(
      symptomTerms,
      input.patient_profile?.allergies || [],
      input.patient_profile?.medical_conditions || [],
      newSeverityScore,
      detectedRedFlags,
      {
        age: input.patient_profile?.age,
        gender: input.patient_profile?.sex,
      }
    );

    // If eligible remedies found and not severe, record them into episode memory
    if (ayurvedaEval.decision === 'eligible' && ayurvedaEval.recommendations.length > 0) {
      for (const rec of ayurvedaEval.recommendations) {
        if (!stateSnapshot.remediesOffered.some((r) => r.recordId === rec.record_id)) {
          stateSnapshot.remediesOffered.push({
            remedy: rec.name,
            recordId: rec.record_id,
            offeredAt: new Date().toISOString(),
            source: rec.provenance.source_id,
            status: 'suggested',
            reliefReported: 'pending',
          });
        }
      }
    }

    // 6. SYNTHESIZE DYNAMIC DASHAVIDHA ATURA PARIKSHA (Charaka Vimana 8/94)
    const patientAge = input.patient_profile?.age;
    const classicalLifeStage =
      patientAge !== undefined && patientAge !== null
        ? patientAge < 16
          ? 'Bālya (Childhood / Kapha phase - Charaka Vimāna 8/122)'
          : patientAge <= 60
          ? 'Madhyama Vaya (Youth/Middle age / Pitta phase - Charaka Vimāna 8/122)'
          : 'Vārdhakya (Old age / Vata phase - Charaka Vimāna 8/122)'
        : 'Madhyama Vaya (Estimated Adult / Pitta phase)';

    const dS = parsedLlm.dashavidha_synthesis || {};
    const dashavidhaProfile = {
      prakriti: {
        status: 'not_assessed',
        reported_observations: [],
        clinical_limitations: ['Constitutional baseline requires in-person pulse and physical examination by an Ayurvedic physician.'],
        assessment_note: 'Constitutional baseline requires in-person clinical assessment by a qualified Ayurvedic physician.',
      },
      vikriti: {
        status: dS.vikriti?.observations?.length > 0 ? 'structurally_extracted' : 'not_assessed',
        reported_observations: dS.vikriti?.observations || [
          `${stateSnapshot.chiefComplaint || 'Presenting discomfort'} manifesting with acute symptoms.`,
        ],
        clinical_limitations: [],
        assessment_note: dS.vikriti?.note || `Observed doshic disturbance in ${dS.vikriti?.srotas || 'Annavaha'} Srotas (${dS.vikriti?.dosha_involved || 'Pitta'} predominance).`,
      },
      sara: {
        status: 'not_assessed',
        reported_observations: [],
        clinical_limitations: ['Tissue excellence assessment requires direct physical inspection.'],
        assessment_note: 'Requires in-person clinical assessment by a qualified Ayurvedic physician.',
      },
      samhanana: {
        status: 'not_assessed',
        reported_observations: [],
        clinical_limitations: ['Body compactness and symmetry requires direct anthropometric evaluation.'],
        assessment_note: 'Requires in-person clinical assessment by a qualified Ayurvedic physician.',
      },
      pramana: {
        status:
          stateSnapshot.vitalsMentioned && Object.keys(stateSnapshot.vitalsMentioned).length > 0
            ? 'structurally_extracted'
            : 'not_assessed',
        reported_observations:
          stateSnapshot.vitalsMentioned && Object.keys(stateSnapshot.vitalsMentioned).length > 0
            ? Object.entries(stateSnapshot.vitalsMentioned).map(([k, v]) => `${k.toUpperCase()}: ${v}`)
            : [],
        structured_findings:
          stateSnapshot.vitalsMentioned && Object.keys(stateSnapshot.vitalsMentioned).length > 0
            ? { modern_measurements: stateSnapshot.vitalsMentioned }
            : undefined,
        assessment_note: 'Objective physical measurements documented from reported clinical vitals.',
      },
      satmya: {
        status: 'structurally_extracted',
        reported_observations: dS.satmya?.observations || ['Patient food habits and environmental tolerances documented.'],
        structured_findings: {
          dietary_habits: dS.satmya?.dietary_habits || 'Standard home diet',
          reported_allergies: input.patient_profile?.allergies || ['None reported'],
        },
        assessment_note: dS.satmya?.note || 'Adaptability and dietary habituation assessed from patient profile.',
      },
      sattva: {
        status: 'structurally_extracted',
        reported_observations: dS.sattva?.observations || ['Patient is communicative and responsive.'],
        assessment_note: dS.sattva?.note || `Mental resilience observed as ${dS.sattva?.resilience_level || 'Madhyama'}.`,
      },
      ahara_shakti: {
        status: 'structurally_extracted',
        reported_observations: dS.ahara_shakti?.observations || [
          `Digestive capability evaluated relative to ${stateSnapshot.chiefComplaint || 'reported symptoms'}.`,
        ],
        assessment_note: dS.ahara_shakti?.note || `Agni functional status assessed as ${dS.ahara_shakti?.agni_status || 'Mandagni'}.`,
      },
      vyayama_shakti: {
        status: 'structurally_extracted',
        reported_observations: dS.vyayama_shakti?.observations || ['Patient activity and functional endurance level documented.'],
        assessment_note: dS.vyayama_shakti?.note || `Functional physical capacity: ${dS.vyayama_shakti?.functional_capacity || 'Moderate'}.`,
      },
      vaya: {
        status: 'structurally_extracted',
        reported_observations: [
          `Patient chronological age is ${patientAge || 'documented in adult range'}.`,
          `Corresponds to ${classicalLifeStage}.`,
        ],
        structured_findings: {
          classical_life_stage: classicalLifeStage,
          chronological_age: patientAge,
        },
        assessment_note: `Chronological stage assessed according to Charaka Vimāna 8/122.`,
      },
    };
    stateSnapshot.dashavidhaState = dashavidhaProfile;

    // 7. CONSULTATION QUESTIONS & PRE-CONSULTATION REPORT
    const questions = parsedLlm.consultation_questions || [
      {
        question: `What is the underlying clinical trigger for my persistent ${stateSnapshot.chiefComplaint || 'discomfort'}?`,
        priority: 'high',
        category: 'diagnostic_investigation',
        rationale: 'Clarifies root etiology and required diagnostic workup.',
      },
      {
        question: 'Are there specific dietary triggers or lifestyle habits I should strictly avoid while recovering?',
        priority: 'medium',
        category: 'lifestyle_guidance',
        rationale: 'Prevents symptom exacerbation and supports healing.',
      },
    ];
    stateSnapshot.consultationQuestions = questions;

    const soap = parsedLlm.pre_consultation_summary || {};
    stateSnapshot.preConsultationReport = {
      generatedAt: new Date().toISOString(),
      patientId,
      episodeId,
      chiefComplaint: stateSnapshot.chiefComplaint || 'Acute Symptom Intake',
      hpiSummary: soap.hpiSummary || `${stateSnapshot.chiefComplaint || 'Symptom'} intake evaluated with severity score ${newSeverityScore}/100.`,
      severityScore: newSeverityScore,
      timeline: [
        `Intake initiated: ${stateSnapshot.lastUpdated || new Date().toISOString()}`,
        `Current clinical severity evaluated at ${newSeverityScore}/100`,
        ...stateSnapshot.remediesOffered.map(
          (r) => `Remedy: ${r.remedy} (${r.status || 'suggested'}${r.reliefReported ? `, relief: ${r.reliefReported}` : ''})`
        ),
      ],
      remediesTried: stateSnapshot.remediesOffered.map((r) => r.remedy),
      redFlags: stateSnapshot.redFlagsPresent,
      recommendedSpecialty: parsedLlm.recommended_specialty || 'General Physician',
      doctorSummarySOAP: {
        highlightedProblem: soap.highlighted_problem || `${stateSnapshot.chiefComplaint || 'Acute Complaint'} [Severity: ${newSeverityScore}/100]`,
        subjective: soap.soap_subjective || `Patient reports ${stateSnapshot.chiefComplaint || 'discomfort'} with character: ${stateSnapshot.intakeSlots.character || 'unspecified'}, duration: ${stateSnapshot.intakeSlots.duration || 'ongoing'}.`,
        objective: soap.soap_objective || `Severity Score: ${newSeverityScore}/100. Reported vitals: ${JSON.stringify(stateSnapshot.vitalsMentioned)}`,
        assessment: soap.soap_assessment || (detectedRedFlags.length > 0 ? 'Urgent / Red-Flag Presentation' : 'Elevated severity requiring clinical consultation'),
        plan: soap.soap_plan || 'Direct physician evaluation, physical examination, and appropriate diagnostic workup.',
      },
    };

    stateSnapshot.triageDisposition =
      detectedRedFlags.length > 0
        ? 'emergency'
        : newSeverityScore >= 60
        ? 'urgent_clinic'
        : 'self_care';

    stateSnapshot.lastUpdated = new Date().toISOString();

    // 8. COMPOSE COMPLETE STANDARDIZED clinical_output FOR ClinicalResultsScreen
    const riskLevel =
      detectedRedFlags.length > 0 || newSeverityScore >= 80
        ? 'URGENT'
        : newSeverityScore >= 60
        ? 'HIGH'
        : newSeverityScore >= 35
        ? 'MODERATE'
        : 'LOW';

    const carePathway =
      detectedRedFlags.length > 0
        ? 'Emergency Care'
        : newSeverityScore >= 60
        ? 'Urgent Consultation'
        : 'Routine Consultation';

    const fullNarrative = `
PATIENT PRESENTATION:
Chief Complaint: ${stateSnapshot.chiefComplaint || 'Acute Symptom Intake'}
History of Present Illness: ${stateSnapshot.preConsultationReport.hpiSummary}

CLINICAL SOAP ASSESSMENT:
• Subjective: ${stateSnapshot.preConsultationReport.doctorSummarySOAP.subjective}
• Objective: ${stateSnapshot.preConsultationReport.doctorSummarySOAP.objective}
• Assessment: ${stateSnapshot.preConsultationReport.doctorSummarySOAP.assessment}
• Plan: ${stateSnapshot.preConsultationReport.doctorSummarySOAP.plan}
`.trim();

    const standardizedClinicalOutput = {
      severity_score: newSeverityScore,
      triage_disposition: stateSnapshot.triageDisposition,
      consultation_recommended: stateSnapshot.consultationRecommended,
      pre_consultation_report: stateSnapshot.preConsultationReport,
      safety_findings: {
        immediate_attention_required: detectedRedFlags.length > 0 || newSeverityScore >= 80,
        red_flags: stateSnapshot.redFlagsPresent,
      },
      risk_assessment: {
        risk_level: riskLevel,
        risk_score: newSeverityScore,
        risk_signals: stateSnapshot.redFlagsPresent,
      },
      care_navigation: {
        care_pathway: carePathway,
        recommended_specialty: parsedLlm.recommended_specialty || 'General Medicine',
        navigation_explanation: `Based on clinical intake and risk stratification, a ${carePathway} with a specialist in ${parsedLlm.recommended_specialty || 'General Medicine'} is recommended.`,
        matched_facilities: [],
      },
      intake_summary: {
        chief_complaint: stateSnapshot.chiefComplaint || 'Clinical Consultation',
        severity: stateSnapshot.intakeSlots.severity ? String(stateSnapshot.intakeSlots.severity) : newSeverityScore >= 60 ? 'Severe' : newSeverityScore >= 35 ? 'Moderate' : 'Mild',
        duration: stateSnapshot.intakeSlots.duration || 'Not reported',
        location: stateSnapshot.intakeSlots.location || 'Not localized',
        nature_of_pain: stateSnapshot.intakeSlots.character || 'Not specified',
        associated_symptoms: stateSnapshot.intakeSlots.associatedSymptoms || [],
      },
      clinical_summary: {
        primary_concern: stateSnapshot.chiefComplaint || 'Clinical Consultation',
        summary_narrative: fullNarrative,
        data_completeness: stateSnapshot.chiefComplaint && stateSnapshot.intakeSlots.duration ? 'complete' : 'in_progress',
        chief_complaint: {
          structured_data: {
            chief_complaint: stateSnapshot.chiefComplaint || 'Clinical Consultation',
          },
        },
        history_of_present_illness: {
          structured_data: {
            severity: stateSnapshot.intakeSlots.severity ? String(stateSnapshot.intakeSlots.severity) : newSeverityScore >= 60 ? 'Severe' : newSeverityScore >= 35 ? 'Moderate' : 'Mild',
            duration: stateSnapshot.intakeSlots.duration || 'Not reported',
            location: stateSnapshot.intakeSlots.location || 'Not localized',
            nature_of_pain: stateSnapshot.intakeSlots.character || 'Not specified',
            associated_symptoms: stateSnapshot.intakeSlots.associatedSymptoms || [],
          },
        },
        past_medical_history: {
          structured_data: {
            medical_conditions: input.patient_profile?.medical_conditions || [],
          },
        },
        past_surgical_history: {
          structured_data: {
            surgical_history: [],
          },
        },
        medication_history: {
          structured_data: {
            medications: [],
          },
        },
        allergy_history: {
          structured_data: {
            allergies: input.patient_profile?.allergies || [],
          },
        },
        soap: stateSnapshot.preConsultationReport.doctorSummarySOAP,
      },
      consultation_questions: {
        questions,
      },
      ayurveda_recommendation: {
        ...ayurvedaEval,
        remedies_tracked: stateSnapshot.remediesOffered,
      },
      dashavidha_atura_pariksha: dashavidhaProfile,
    };

    let finalNurseMessage = parsedLlm.nurse_dialogue || '';

    // Safety and timing logic for Real-Time Clinical Assessment & Home Care generation:
    // Rule: The assessment report MUST NOT be generated after a single question or before follow-up completes.
    // It is ONLY generated in real-time when:
    // 1. Immediate life-threatening emergency is detected (immediate patient safety, e.g. severe dyspnea, chest pain)
    // 2. High severity (>=60) or completed follow-up AND patient gave permission/consent to prepare the report
    // IMPORTANT: If the nurse is actively asking for permission (request_report_permission: true),
    // wait for the patient's reply on the next turn! Do NOT prematurely show the report while asking for permission!
    const isLifeThreateningEmergency =
      newSeverityScore >= 85 ||
      detectedRedFlags.some((rf: string) =>
        /chest pain|difficulty breathing|breathless|unconscious|stroke|hemoptysis|cyanosis|seizure/i.test(rf)
      );

    const isAskingPermission = parsedLlm.request_report_permission === true;
    const patientConsented = parsedLlm.patient_consented_to_report === true || stateSnapshot.clinicalReportGenerated === true;

    const shouldGenerateClinicalReport =
      isLifeThreateningEmergency ||
      (!isAskingPermission && patientConsented);

    if (shouldGenerateClinicalReport) {
      stateSnapshot.clinicalReportGenerated = true;
    }

    const isComplete = shouldGenerateClinicalReport;

    const status: 'in_progress' | 'complete' | 'emergency' =
      isLifeThreateningEmergency
        ? 'emergency'
        : shouldGenerateClinicalReport
        ? 'complete'
        : 'in_progress';

    return {
      session_id: episodeId,
      patient_id: patientId,
      status,
      conversation_message: finalNurseMessage,
      information_complete: isComplete,
      missing_information: stateSnapshot.missingSlots,
      immediate_attention_required: detectedRedFlags.length > 0 || newSeverityScore >= 80,
      red_flag_status: detectedRedFlags.length > 0 ? 'red_flags_detected' : 'no_obvious_red_flags',
      red_flags: stateSnapshot.redFlagsPresent,
      updated_state: stateSnapshot,
      clinical_output: shouldGenerateClinicalReport ? standardizedClinicalOutput : null,
      unrelated_problem_detected: Boolean(parsedLlm.unrelated_problem_detected),
      detected_new_complaint: parsedLlm.detected_new_complaint || null,
      confirm_start_new_episode: Boolean(parsedLlm.confirm_start_new_episode),
    };
  }

  /**
   * FORMATS PERSISTENT LONGITUDINAL RISK MEMORY ACROSS TURNS
   *
   * Pure memory recall from stateSnapshot — NO regex gating.
   * If alarm signs, prior treatments, or chronic risk patterns were previously surfaced,
   * this injects a concise status recap into the prompt so Gemini remembers what the patient
   * already shared without ever repeating questions or feeling like a cold checklist.
   */
  private buildLongitudinalRiskContext(state: EpisodeClinicalState): string {
    const probe = state.chronicRiskProbe;
    if (!probe || !probe.isActive) return '';

    const lines: string[] = [];
    if (probe.chronicTrigger) {
      lines.push(`• Ongoing risk presentation noted: "${probe.chronicTrigger}"`);
    }
    if (Array.isArray(probe.alarmSignsFound) && probe.alarmSignsFound.length > 0) {
      lines.push(`• Cardinal alarm signs already identified: ${probe.alarmSignsFound.join(', ')}`);
    }
    if (probe.priorTreatmentsSummary) {
      lines.push(`• Prior treatments/care already reported: ${probe.priorTreatmentsSummary}`);
    }
    if (probe.riskExplainedToPatient) {
      lines.push('• Empathetic risk explanation has already been communicated to the patient');
    }
    if (probe.consentRequested) {
      lines.push('• Permission for Pre-Consultation Summary has already been requested — awaiting patient response');
    }

    if (lines.length === 0) return '';
    return `\nLONGITUDINAL MEMORY FROM PREVIOUS EPISODE TURNS:\n${lines.join('\n')}\n`;
  }

  private initializeOrMigrateState(

    existing: any,
    patientId: string,
    episodeId: string
  ): EpisodeClinicalState {
    if (existing && typeof existing === 'object' && existing.intakeSlots && existing.remediesOffered) {
      return {
        ...existing,
        patientId,
        episodeId,
        vitalsMentioned: existing.vitalsMentioned || {},
        redFlagsPresent: Array.isArray(existing.redFlagsPresent)
          ? existing.redFlagsPresent
          : Array.isArray(existing.red_flags)
          ? existing.red_flags
          : [],
        missingSlots: Array.isArray(existing.missingSlots)
          ? existing.missingSlots
          : ['duration', 'severity', 'character'],
        remediesOffered: Array.isArray(existing.remediesOffered) ? existing.remediesOffered : [],
        consultationQuestions: Array.isArray(existing.consultationQuestions) ? existing.consultationQuestions : [],
        dashavidhaState: existing.dashavidhaState || {},
        // Preserve active chronic risk probe across turns
        chronicRiskProbe: existing.chronicRiskProbe || undefined,
        turnCount: existing.turnCount || 0,
        lastUpdated: existing.lastUpdated || new Date().toISOString(),
      };
    }

    return {
      episodeId,
      patientId,
      chiefComplaint: existing?.chief_complaint || existing?.primary_symptom || null,
      intakeSlots: existing?.intakeSlots || {
        onset: existing?.onset || undefined,
        duration: existing?.duration || undefined,
        severity: existing?.severity != null ? Number(existing.severity) : undefined,
        location: existing?.location || undefined,
        radiation: existing?.radiation || undefined,
        character: existing?.nature_of_pain || undefined,
        aggravatingFactors: existing?.aggravating_factors || [],
        relievingFactors: existing?.relieving_factors || [],
        associatedSymptoms: existing?.associated_symptoms || [],
      },
      vitalsMentioned: existing?.vitalsMentioned || {},
      severityScore: existing?.severityScore || 25,
      redFlagsChecked: existing?.redFlagsChecked || false,
      redFlagsPresent: existing?.redFlagsPresent || existing?.red_flags || [],
      missingSlots: existing?.missingSlots || ['duration', 'severity', 'character'],
      triageDisposition: existing?.triageDisposition || 'self_care',
      remediesOffered: existing?.remediesOffered || [],
      patientReportedResponse: existing?.patientReportedResponse || 'unknown',
      consultationRecommended: existing?.consultationRecommended || false,
      preConsultationReport: existing?.preConsultationReport || null,
      consultationQuestions: existing?.consultationQuestions || [],
      dashavidhaState: existing?.dashavidhaState || {},
      // Preserve chronic risk probe from prior state if any
      chronicRiskProbe: existing?.chronicRiskProbe || undefined,
      turnCount: existing?.turnCount || 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const geminiNurseBrainService = new GeminiNurseBrainService();
export default geminiNurseBrainService;
