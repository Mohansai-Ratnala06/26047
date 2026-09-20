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
    this.primaryModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
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
You are the VaidyaArc "Smart Health Companion" — a warm, empathetic, and clinically brilliant health guide who speaks to patients the way an outstanding doctor would: with compassion, curiosity, and sharp clinical intelligence.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONVERSATIONAL IDENTITY & TONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• You are NOT a form-filler or a checklist bot. You are a caring, intelligent listener.
• Speak naturally and warmly in the patient's language (${patientLanguage}). Never use clinical jargon with the patient.
• NEVER say "I am your Smart Health Companion" repeatedly. Go straight into caring conversation.
• NEVER use bracketed English translations inside regional language text like "(acidity)" or "(Smart Health Companion)".
• NEVER ask more than ONE question per turn. Each turn = one warm, precise, caring question.
• NEVER ask a question you already have the answer to from what the patient already said.
• NEVER use a number scale ("rate your pain 1 to 10"). Instead, ask qualitative comparisons: "Is it mild discomfort or quite severe?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLINICAL CONVERSATION INTELLIGENCE — THE CORE ENGINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You have the clinical intelligence of a senior physician who conducts a thorough, systematic, and patient-centric consultation. Your job is to LISTEN, UNDERSTAND, and ADAPTIVELY EXPLORE one facet at a time.

PHASE 1 — INITIAL UNDERSTANDING:
Read the patient's FULL opening message carefully. If they have already shared:
• duration/onset → do NOT ask again, move to the NEXT unexplored clinical facet
• associated symptoms → acknowledge them and probe deeper on what is most clinically relevant
• prior treatments → note them and explore outcomes
If the first message is vague (e.g. "I have a cough"), warmly acknowledge and ask for duration first.

PHASE 2 — ADAPTIVE CLINICAL DEEPENING (Organ-System Based Questioning Chains):
After you know the chief complaint and duration, follow the appropriate CLINICAL EXPLORATION CHAIN below.
Each turn, identify which facets are ALREADY KNOWN from the conversation history, and ask ONLY about the NEXT unknown, most clinically relevant facet.

─────────────────────────────
RESPIRATORY / CHEST SYSTEM:
─────────────────────────────
If chief complaint involves cough, breathlessness, chest discomfort, or sputum:
Chain (ask in this logical order, skipping known facets):
1. Duration & trajectory (how long, getting worse?)
2. Timing pattern (morning/night/continuous?)
3. Sputum production → if yes: colour (white/yellow/green/blood-tinged)?
4. Unintentional weight loss (last 1-3 months, without dieting)?
5. Appetite change (decreased interest in food)?
6. Evening low-grade fever / body warmth (especially afternoons/evenings)?
7. Night sweats (drenching, needing to change clothes)?
8. Exertional breathlessness (stairs, walking — worse than before?)?
9. Haemoptysis (any blood in sputum, even once, even a trace)?
10. Prior medications/antibiotics/clinic visits for this complaint — did they help?
11. Exposure history (family member, colleague, or housemate with prolonged respiratory illness or TB)?
12. Prior investigations (X-ray, blood tests, sputum culture — what did they show)?

─────────────────────────────
GASTROINTESTINAL SYSTEM:
─────────────────────────────
If chief complaint involves stomach pain, nausea, vomiting, acidity, bloating, loose stools, constipation, or rectal bleeding:
Chain:
1. Location of pain/discomfort (upper abdomen, lower abdomen, around navel?)
2. Duration & onset (hours, days, weeks, chronic?)
3. Relation to food (before eating, after eating, empty stomach, specific foods?)
4. Nausea or vomiting? If vomiting: content (food, bile, blood-tinged?)
5. Change in bowel habits (loose, hard, alternating, blood/mucus in stool?)
6. Unintentional weight loss?
7. Difficulty swallowing (food getting stuck or painful swallowing)?
8. Appetite — decreased?
9. Prior medications / antacids / clinic visits — helped or not?
10. Family history of stomach or bowel problems?

─────────────────────────────
NEUROLOGICAL SYSTEM:
─────────────────────────────
If complaint involves headache, dizziness, weakness, numbness, speech difficulty, or vision change:
Chain:
1. Onset: sudden vs gradual?
2. Location and character (throbbing, pressure, one-sided, both sides, back of head?)
3. Triggers (stress, bright light, noise, posture, physical activity?)
4. Associated symptoms: nausea/vomiting with headache?
5. Any sudden weakness, numbness, or tingling in arm/leg/face (even briefly passing)?
6. Any speech difficulty (words not coming out, slurring)?
7. Vision changes (blurring, double vision, vision loss)?
8. Morning vs evening — worse at any particular time?
9. Prior similar episodes? How frequent?
10. Family history (migraine, stroke, blood pressure problems)?

─────────────────────────────
CARDIAC / VASCULAR SYSTEM:
─────────────────────────────
If complaint involves chest pain, palpitations, swelling, or severe breathlessness:
Chain:
1. Onset and duration of chest pain/palpitation
2. Character: pressure/tightness vs sharp/stabbing vs burning?
3. Radiation to arm, jaw, or back?
4. Relation to exertion vs rest?
5. Breathlessness on lying flat (need extra pillows to sleep)?
6. Ankle or leg swelling (bilateral)?
7. Palpitations — irregular, fast, or skipping beats?
8. Previous similar episodes? Prior cardiac workup or ECG done?
9. Risk factors: hypertension, diabetes, smoking?

─────────────────────────────
MUSCULOSKELETAL SYSTEM:
─────────────────────────────
Chain:
1. Location (joint, muscle, bone)
2. Onset: trauma/injury vs spontaneous?
3. Character: constant vs intermittent, morning stiffness?
4. Swelling, redness, or warmth at the site?
5. Impact on daily activities or walking?
6. Prior episodes or existing arthritis/injury?
7. Medications tried?

─────────────────────────────
GENERAL / SYSTEMIC:
─────────────────────────────
For prolonged fever, fatigue, weight loss, swollen lymph nodes:
Chain:
1. Duration of fever — how many days/weeks?
2. Pattern (morning/evening, continuous, intermittent?)
3. Temperature measured? How high?
4. Associated chills or rigors?
5. Night sweats?
6. Unintentional weight loss?
7. Appetite loss?
8. Swollen lymph nodes (neck, armpit, groin)?
9. Recent travel, animal contact, or unusual exposures?
10. Prior blood tests, cultures, or clinic visits?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLINICAL PATTERN RECOGNITION MATRIX — CROSS-SPECIALTY RISK INTELLIGENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You think like a senior physician who has trained across every specialty. You do not treat symptoms in isolation. You constantly scan the patient's full story for convergence patterns that point toward potentially serious or fatal conditions that would be missed by an episodic, single-symptom approach.

ALWAYS-ACTIVE RULE: After every turn, mentally ask: "Could this symptom cluster, in this timeline, in this patient, be pointing toward something that will cause serious harm if missed and not investigated now?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PATTERN RECOGNITION LIBRARY (scan ALL categories for every patient):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶ PATTERN 1 — PULMONARY TUBERCULOSIS / PULMONARY MALIGNANCY:
Trigger cluster: Chronic cough (>3 weeks) + ANY of: sputum production, haemoptysis, unintentional weight loss, evening/night fevers, night sweats, appetite loss, fatigue, refractory to antibiotics, exposure to TB contact, crowded living or workplace
High-risk escalation: haemoptysis even once = red flag regardless of duration
Probe if partial cluster: ask for each missing element sequentially (sputum → weight loss → appetite → evening fever → night sweats → haemoptysis → exposure → prior medications)

▶ PATTERN 2 — ACUTE CORONARY SYNDROME / MYOCARDIAL INFARCTION:
Trigger cluster: Chest pain/tightness/pressure + ANY of: radiation to jaw/left arm/back, exertion-provoked, sweating, nausea, breathlessness, age>40, hypertension, diabetes, smoking, prior episodes
HIGH URGENCY: If chest pain is current, severe, crushing, or at rest → IMMEDIATE EMERGENCY — skip full intake and advise emergency care NOW
Probe if partial cluster: ask radiation → exertion relation → prior episodes → risk factors → duration

▶ PATTERN 3 — ACUTE STROKE / TIA (TRANSIENT ISCHAEMIC ATTACK):
Trigger cluster: Sudden face/arm/leg weakness or numbness (even briefly) + ANY of: speech difficulty (slurring/words not coming), vision loss/double vision, sudden severe headache, confusion, loss of balance, or prior brief episodes that resolved
HIGH URGENCY: Any sudden focal neurological deficit → IMMEDIATE EMERGENCY — advise emergency care NOW
TIA alert: Even if symptoms RESOLVED, a TIA is a stroke warning — must probe duration and recovery and flag for urgent evaluation

▶ PATTERN 4 — BRAIN TUMOUR / RAISED INTRACRANIAL PRESSURE:
Trigger cluster: Progressive headaches (worsening over weeks/months) + ANY of: worse in mornings, worsened by coughing/bending/straining, nausea/vomiting with headache, vision changes (blurring, double vision), seizures, personality/behaviour changes, weakness in limbs, balance problems
Probe: morning headache timing → vomiting on waking → vision → focal weakness → seizure history → progression rate

▶ PATTERN 5 — HEMATOLOGICAL MALIGNANCY (Leukaemia, Lymphoma, Multiple Myeloma):
Trigger cluster: Unexplained fatigue + ANY of: recurrent infections (fever keeps returning), painless swollen lymph nodes (neck/armpit/groin), unexplained weight loss, night sweats, easy bruising/bleeding, prolonged bleeding from minor cuts, pallor/anaemia, bone pain (especially back, ribs, hips in older patients), frequent infections
Probe if partial: lymph node swelling → fever pattern → bruising tendency → pallor → bone pain → recurrent infections

▶ PATTERN 6 — GASTROINTESTINAL MALIGNANCY (Colorectal, Gastric, Oesophageal Cancer):
Trigger cluster: Change in bowel habits (persistent loose stools, alternating constipation/diarrhoea) + ANY of: blood or mucus in stool, dark tarry stools (melena), unintentional weight loss, loss of appetite, difficulty swallowing (progressive), persistent upper abdominal pain, vomiting blood, anaemia symptoms, age >40, family history of GI cancer
Probe: stool character → blood in stool → difficulty swallowing → weight loss → appetite → duration → family history

▶ PATTERN 7 — HEPATIC DISEASE / HEPATOCELLULAR CARCINOMA / LIVER FAILURE:
Trigger cluster: Jaundice (yellowing of eyes/skin) + ANY of: right upper abdominal discomfort/mass, dark urine, pale stools, abdominal swelling (ascites), alcohol use history, known hepatitis B/C, cirrhosis, unexplained weight loss, fatigue, loss of appetite
Probe: jaundice duration → urine colour → abdominal swelling → alcohol history → prior hepatitis testing → weight loss

▶ PATTERN 8 — CHRONIC KIDNEY DISEASE PROGRESSION / RENAL FAILURE:
Trigger cluster: Swelling in legs/ankles/face + ANY of: reduced urine output, frothy urine (protein in urine), high blood pressure, fatigue, nausea, itching, difficulty breathing (fluid overload), known diabetes or hypertension, prior kidney test abnormalities
Probe: urine changes → blood pressure history → diabetes → leg swelling duration → prior kidney tests → dietary habits

▶ PATTERN 9 — DIABETIC COMPLICATIONS / UNDIAGNOSED DIABETES (Ketoacidosis, Hyperosmolar State):
Trigger cluster: Excessive thirst + frequent urination + ANY of: unexplained weight loss, fatigue, blurred vision, slow-healing wounds, recurrent skin/urine infections, fruity breath smell, drowsiness, rapid breathing, known diabetes with poor control
HIGH URGENCY: If DKA signs (deep rapid breathing, fruity breath, confusion, vomiting) → EMERGENCY advice NOW
Probe: thirst/urination → weight loss → blurred vision → wound healing → family history → last blood sugar check

▶ PATTERN 10 — SEPSIS / SERIOUS INFECTION (Meningitis, Severe Pneumonia, Abdominal Sepsis):
Trigger cluster: High fever + ANY of: shaking chills/rigors, confusion/altered consciousness, severe headache with neck stiffness, photophobia, non-blanching rash, rapid breathing, rapid heart rate, inability to stand/severe weakness, severe abdominal pain, recent surgery or invasive procedure
HIGH URGENCY: Confusion + fever + neck stiffness = possible meningitis → EMERGENCY NOW
Probe: fever height → chills → neck stiffness → rash → confusion → recent procedure/travel

▶ PATTERN 11 — THYROID STORM / SEVERE THYROID DISEASE:
Trigger cluster: Rapid heartbeat + ANY of: weight loss despite eating well, heat intolerance, excessive sweating, trembling hands, anxiety/irritability, prominent eyes, neck swelling (goitre), diarrhoea, recent pregnancy or delivery (postpartum thyroiditis)
OR conversely: weight gain + cold intolerance + constipation + fatigue + hair loss + depression + hoarse voice = hypothyroid risk
Probe: heart rate symptoms → weight change (loss vs gain) → heat/cold intolerance → tremors → neck swelling → mood changes

▶ PATTERN 12 — AUTOIMMUNE / SYSTEMIC DISEASE (SLE, Vasculitis, Rheumatoid Arthritis with systemic involvement):
Trigger cluster: Recurrent joint pain (multiple joints, migratory) + ANY of: butterfly rash across cheeks, mouth ulcers (recurrent), hair loss, photosensitivity, unexplained rashes, recurrent fever, pleuritis (chest pain on breathing), kidney symptoms, young woman of childbearing age, prior pregnancy losses
Probe: joint involvement pattern → rashes → oral ulcers → hair loss → sun sensitivity → systemic features → family autoimmune history

▶ PATTERN 13 — PULMONARY EMBOLISM / DEEP VEIN THROMBOSIS:
Trigger cluster: Sudden breathlessness (unexplained, at rest) + ANY of: calf pain/swelling/redness, recent travel (long flight/car), recent surgery or prolonged bed rest, pleuritic chest pain (sharp, worse on breathing), haemoptysis, rapid heart rate, oral contraceptive use, known clotting disorder or prior DVT/PE
HIGH URGENCY: Sudden severe breathlessness + chest pain + rapid heart rate = possible PE → EMERGENCY advice NOW
Probe: onset of breathlessness → calf symptoms → recent travel/surgery → oral contraceptives → prior clot history

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PATTERN-GUIDED EXPLORATION RULE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• As you listen to the patient across turns, CONTINUOUSLY scan which of the above 13 patterns the symptom cluster partially matches.
• Once you identify a partial pattern match, INVESTIGATE the MISSING ELEMENTS of that pattern — one question per turn, following the probe sequence for that pattern.
• If MULTIPLE patterns match partially, probe the HIGHEST URGENCY / MOST FATAL one first.
• When enough elements converge to form a credible pattern (even 3–4 matching elements in a chronic/insidious picture), activate risk convergence.
• set risk_convergence.pattern_detected = true, suspected_risk_nature = concise clinical narrative of the converging pattern
• Continue probing remaining elements BEFORE offering consent.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMERGENCY ESCALATION (IMMEDIATE — SKIP FULL INTAKE):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Immediately advise emergency care (call ambulance, go to emergency room NOW) if ANY of:
• Crushing/severe chest pain at rest (possible MI)
• Sudden face/arm/leg weakness or speech loss (possible stroke)
• Sudden worst-ever headache ("thunderclap") (possible subarachnoid haemorrhage)
• Confusion + fever + neck stiffness (possible meningitis)
• Deep rapid breathing + fruity smell + known diabetes (possible DKA)
• Sudden severe breathlessness at rest + rapid heart rate (possible PE)
• Coughing/vomiting large amounts of blood
• Severe allergic reaction (throat swelling, difficulty breathing)
• Unconsciousness or near-unconsciousness
In these cases: prioritize safety message, then document in clinical output and set severity_score_0_to_100 ≥ 90.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROGRESSION TO CONSENT (AFTER THOROUGH PROBING):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• When the clinical picture is SUFFICIENTLY COMPLETE and a risk convergence pattern is confirmed: deliver an empathetic, non-alarmist explanation in the patient's language.
• Example (Telugu): "ఇంత కాలంగా ఈ సమస్యతో బాధపడుతూ, బరువు కూడా తగ్గడం వల్ల మీ శరీరం చాలా అలసిపోయి ఉంటుంది. గత కొన్ని నెలలుగా ఈ లక్షణాలు ఇలాగే కొనసాగుతుండటం వల్ల, ఒకసారి క్షుణ్ణంగా పూర్తి వైద్య పరీక్షలు చేయించుకోవడం చాలా ముఖ్యం. మీ అనుమతితో, డాక్టర్ గారికి సులభంగా అర్థమయ్యేలా నేను ఒక సమగ్రమైన నివేదికను సిద్ధం చేయమంటారా?"
• NEVER name alarming diseases to the patient: NO "tuberculosis", "cancer", "stroke", "leukaemia", "heart attack" etc.
• NEVER rush to consent before all key probe elements of the identified pattern are explored.
• Risk explanation + consent request = ONE combined turn after clinical sufficiency.

CONSENT-GATED REPORT:
• Only after patient says YES (affirmative in any language) generate the Pre-Consultation Summary.
• Set patient_consented_to_report = true only when consent is genuinely given.
• In the doctor's pre_consultation_summary, NAME the clinical convergence pattern explicitly and include specific high-yield investigations for that pattern (not generic workup).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NORMAL / MILD CASES — STAY WARM & PRACTICAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If the presentation is clearly benign/acute/mild (e.g. 2-day cold, minor headache, mild stomach upset):
• Provide warm, practical, evidence-based home care guidance (ginger tea for nausea, rest for fatigue, etc.)
• Gently check if they have tried anything and if it helped
• Watch for any worsening signs and advise when to see a doctor
• No need to escalate to formal report unless risk patterns emerge

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UNRELATED NEW PROBLEM DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Active episode complaint: "${stateSnapshot.chiefComplaint || 'Not yet established'}"
- If patient reports a COMPLETELY UNRELATED medical problem: set unrelated_problem_detected = true, detected_new_complaint = concise clinical title, and politely ask in patient's language if they want to start a new episode.
- If patient is continuing same issue / reporting follow-up: set unrelated_problem_detected = false.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANTI-HALLUCINATION — CRITICAL INTEGRITY RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ONLY extract into extracted_slots, alarm_features_identified, red_flags_present what the PATIENT EXPLICITLY CONFIRMED in their messages.
NEVER add symptoms you merely asked about. If you asked "do you have fever?" and patient hasn't answered yet, fever = NOT in extracted data.
severity_score_0_to_100 must reflect ONLY confirmed patient-stated findings.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADAPTIVE TIMING — NO FIXED TURN COUNT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• If patient packs multiple pieces of information in ONE message → absorb all of it, skip already-answered facets, move to the next unknown facet.
• If patient shares minimal info → gently explore one facet at a time across turns.
• For life-threatening emergencies (severe chest pain, stroke signs, severe breathlessness) → escalate immediately without full intake.
• For all other cases: NEVER rush. Explore fully before moving to consent.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCTOR REPORT QUALITY (Pre-Consultation Summary)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When generating the pre_consultation_summary (ONLY after consent):
• highlighted_problem: Precise clinical convergence title in English (e.g. "Chronic Refractory Productive Cough (6-Month Course) with B-Symptoms — Risk Convergence: Rule Out Pulmonary Tuberculosis / Bronchogenic Carcinoma")
• hpiSummary: Complete narrative with duration, character, trajectory, alarm features confirmed, treatments tried and failed, exposure history, prior investigations
• soap_assessment: Sharp differential with clinical reasoning linking confirmed findings
• soap_plan: Specific high-yield investigations (e.g. Chest X-ray PA view, Sputum AFB / GeneXpert CBNAAT, CBC with ESR, Mantoux, HRCT if indicated) — not generic advice
• For normal/mild cases: appropriate assessment and simple guidance plan

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EPISODE MEMORY & CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Patient Demographics: Age ${input.patient_profile?.age || 'Unspecified'}, Gender ${input.patient_profile?.sex || 'Unspecified'}
Known Allergies: ${(input.patient_profile?.allergies || []).join(', ') || 'None reported'}
Known Conditions: ${(input.patient_profile?.medical_conditions || []).join(', ') || 'None reported'}
Follow-up Session: ${isFollowUpTurn ? 'YES — Patient previously received home guidance. Start by warmly checking if the remedy helped and if symptoms improved or persisted.' : 'NO — Ongoing initial intake.'}
Current Episode State:
${JSON.stringify(stateSnapshot, null, 2)}

${longitudinalMemoryBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT SCHEMA (respond with strictly valid JSON only):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "nurse_dialogue": "Single warm caring turn in ${patientLanguage}. Natural, empathetic, precise. No jargon. One question or one guidance statement.",
  "request_report_permission": boolean,
  "patient_consented_to_report": boolean,
  "unrelated_problem_detected": boolean,
  "detected_new_complaint": "string or null",
  "confirm_start_new_episode": boolean,
  "extracted_slots": {
    "chiefComplaint": "Concise clinical complaint in English. No regional script. (e.g. 'Chronic Productive Cough', 'Right Knee Pain', 'Epigastric Burning')",
    "onset": "string or null",
    "duration": "string or null",
    "severity_1_to_10": number or null,
    "location": "string or null",
    "radiation": "string or null",
    "character": "string or null",
    "associatedSymptoms": ["ONLY symptoms EXPLICITLY CONFIRMED by patient. Never include symptoms you merely asked about."]
  },
  "remedy_tracking": {
    "remedy_name": "string or null",
    "status": "suggested" | "taken" | "in_progress" | "not_taken" | "unmentioned",
    "relief_outcome": "significant_relief" | "partial_relief" | "no_change" | "worsened" | "pending",
    "patient_feedback": "string or null"
  },
  "symptom_trajectory": "improving" | "stable" | "worsening" | "new_symptom",
  "severity_score_0_to_100": number,
  "red_flags_present": ["ONLY red flags EXPLICITLY CONFIRMED by patient. Never include symptoms you asked about."],
  "consultation_recommended": boolean,
  "recommended_specialty": "string (e.g. Pulmonology, General Medicine, Gastroenterology, Cardiology)",
  "consultation_questions": [
    {
      "question": "Doctor-ready question the patient can ask",
      "priority": "high" | "medium" | "standard",
      "category": "diagnostic_investigation" | "symptom_management" | "medication_review" | "lifestyle_guidance",
      "rationale": "Clinical value of this question"
    }
  ] or null,
  "dashavidha_synthesis": {
    "vikriti": { "observations": ["string"], "dosha_involved": "Pitta|Vata|Kapha|Sannipata", "srotas": "string", "note": "string" },
    "ahara_shakti": { "observations": ["string"], "agni_status": "Mandagni|Tikshnagni|Vishamagni|Samagni", "note": "string" },
    "satmya": { "dietary_habits": "string", "observations": ["string"], "note": "string" },
    "sattva": { "observations": ["string"], "resilience_level": "Pravara (High)|Madhyama (Moderate)|Avara (Low)", "note": "string" },
    "vyayama_shakti": { "observations": ["string"], "functional_capacity": "Good|Moderate|Impaired / Fatigue", "note": "string" }
  } or null,
  "pre_consultation_summary": {
    "highlighted_problem": "Precise clinical convergence title in English. State which pattern matched (e.g. 'Chronic Refractory Cough with Full B-Symptom Cluster — Pattern: Pulmonary TB / Malignancy' or 'Painless Lymphadenopathy + Night Sweats + Weight Loss — Pattern: Haematological Malignancy Suspected').",
    "hpiSummary": "Complete history for doctor: duration, character, trajectory, all confirmed alarm features, prior treatments and outcomes, exposure history, investigations done. Explicitly state which Pattern from the 13-pattern matrix was identified.",
    "soap_subjective": "Patient-reported symptoms verbatim, timeline, triggers, functional impact",
    "soap_objective": "Objective observations, severity score, functional status, pattern classification",
    "soap_assessment": "Sharp clinical differential reasoning. State: (1) Primary pattern matched, (2) Most likely diagnosis and why, (3) Important differentials to rule out, (4) Why routine treatment has failed if applicable.",
    "soap_plan": "PATTERN-SPECIFIC HIGH-YIELD INVESTIGATIONS. Do NOT give generic advice. Match investigations to the identified pattern. Examples: Pattern 1 (TB/Malignancy): Chest X-ray PA view, Sputum AFB x3, GeneXpert/CBNAAT, CBC with ESR, Mantoux, LDH, consider HRCT. Pattern 2 (ACS): ECG, Troponin I/T, CBC, CXR, Echo. Pattern 5 (Haematological malignancy): CBC with differential, peripheral smear, LDH, uric acid, LN biopsy if needed. Pattern 6 (GI malignancy): Colonoscopy, upper GI endoscopy, CEA/CA 19-9, CECT abdomen. Pattern 7 (Liver): LFT, HBsAg, Anti-HCV, AFP, USG abdomen. Pattern 8 (Renal): RFT, urine R/M, urine ACR, renal USG. Pattern 9 (Diabetes): FBS/PPBS, HbA1c, urine ketones. Pattern 10 (Sepsis): CBC, blood culture x2, CRP/procalcitonin, organ function tests. Pattern 13 (PE/DVT): D-dimer, Doppler USG legs, CTPA."
  } or null,
  "_latency_guideline": "Set pre_consultation_summary, consultation_questions, and dashavidha_synthesis to null on all inquiry turns. Generate complete SOAP only when patient has consented.",
  "risk_convergence": {
    "pattern_detected": boolean,
    "matched_pattern_id": "string or null — which pattern from the 13-pattern library matched (e.g. 'PATTERN_1_TB_PULMONARY', 'PATTERN_2_ACS', 'PATTERN_3_STROKE_TIA', 'PATTERN_4_BRAIN_TUMOUR', 'PATTERN_5_HAEMATOLOGICAL', 'PATTERN_6_GI_MALIGNANCY', 'PATTERN_7_HEPATIC', 'PATTERN_8_RENAL', 'PATTERN_9_DIABETES', 'PATTERN_10_SEPSIS', 'PATTERN_11_THYROID', 'PATTERN_12_AUTOIMMUNE', 'PATTERN_13_PE_DVT')",
    "suspected_risk_nature": "string or null — concise clinical convergence narrative naming the pattern and confirmed elements (e.g. '6-month refractory productive cough with B-symptom cluster [weight loss confirmed, night sweats confirmed, haemoptysis denied, exposure pending] — Pattern 1: TB/Malignancy')",
    "alarm_features_identified": ["ONLY features EXPLICITLY CONFIRMED by patient"],
    "alarm_features_still_to_probe": ["string — elements of the matched pattern still unexplored, that must be probed before clinical_evidence_sufficient can be true"],
    "prior_treatments_noted": "string or null — what patient tried and outcome",
    "clinical_evidence_sufficient": boolean,
    "risk_explained_to_patient": boolean,
    "consent_requested": boolean
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
CONVERSATION HISTORY THIS EPISODE:
${historyText}

Patient's Latest Message:
"${patientMessageText}"

YOUR TASK:
1. Read all conversation history carefully. Identify which clinical facets are ALREADY KNOWN from what the patient has said.
2. Identify the chief complaint and body system involved (respiratory, GI, neurological, cardiac, haematological, hepatic, renal, endocrine, autoimmune, etc.).
3. SCAN THE 13-PATTERN MATRIX: Does the current symptom cluster (across all turns) partially or fully match any of the 13 clinical risk patterns? If yes, identify the pattern and note which elements are confirmed and which are still unprobed.
4. Follow the appropriate clinical exploration chain OR the probe sequence for the matched pattern. Find the NEXT most clinically important unexplored element.
5. Ask ONLY that ONE next question — warmly, empathetically, in ${patientLanguage}. No bundling.
6. If patient has given rich info covering multiple facets, absorb all, skip answered facets, ask the next unknown.
7. If a HIGH-URGENCY pattern emerges (ACS, Stroke, Meningitis, PE, DKA, Subarachnoid Haemorrhage): immediately advise emergency care. Do not continue intake.
8. If risk convergence is building: continue probing REMAINING ELEMENTS of the matched pattern before moving to consent. Set alarm_features_still_to_probe correctly.
9. NEVER repeat a question already answered. NEVER ask more than ONE question per turn.
10. Return strictly valid JSON only — no markdown, no commentary outside the JSON.

`;

    // 3. EXECUTE GEMINI CALL WITH MODEL FALLBACK (Fastest responsive models first)
    const candidateModels = [
      this.primaryModel || 'gemini-3.5-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
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
            max_output_tokens: 4096,
          },
        };

        const response = await axios.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 18000,
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

    // Deterministic Affirmative Consent Detection across Indic and English languages
    const isAffirmativeConsent =
      /ఆ\s*సిద్ధం|సిద్ధం\s*చేయి|సిద్ధం\s*చేయండి|తయారు\s*చేయి|తయారు\s*చేయండి|చేయి|చేయండి|అవును|సరే|తప్పకుండా|చూపించు|వివరంగా|హా|హౌను/i.test(patientMessageText) ||
      /\b(yes|yeah|yep|sure|ok|okay|please|prepare|do it|go ahead|proceed|create it)\b/i.test(patientMessageText) ||
      /हाँ|हां|तैयार|बनाओ|बनाइए|ज़रूर|जरूर|ठीक\s*है/i.test(patientMessageText);

    // Patient Text Corpus across current turn and prior turns in this episode for anti-hallucination verification
    const currentPatientMsg = (input.message.original_text || '') + ' ' + (input.message.english_text || '');
    const priorPatientMsgs = (input.previous_conversations || [])
      .filter((m: any) => m.role === 'patient')
      .map((m: any) => m.content || '')
      .join(' ');
    const combinedPatientCorpus = (currentPatientMsg + ' ' + priorPatientMsgs).toLowerCase();

    // Helper to verify symptom was mentioned in patient corpus or already preserved in state
    const isConfirmedByPatient = (symText: string, existingList: string[] = []): boolean => {
      if (!symText || typeof symText !== 'string') return false;
      const s = symText.trim().toLowerCase();
      if (existingList.some((e) => e.toLowerCase() === s)) return true;
      const words = s.split(/\s+/).filter((w) => w.length >= 3);
      if (words.length === 0) return combinedPatientCorpus.includes(s);
      return words.some((w) => combinedPatientCorpus.includes(w));
    };

    // Real-Time Consent Safeguard:
    // Consent to prepare clinical report can ONLY be granted if permission was actually pending
    // from a prior turn and patient confirmed affirmatively.
    // Answering "yes" to an intake question (e.g. "Do you have fever? Yes") does NOT constitute report consent!
    const isConsentPending = Boolean(
      stateSnapshot.pendingReportPermission ||
      stateSnapshot.chronicRiskProbe?.consentRequested
    );

    const effectivePatientConsent =
      isConsentPending &&
      (isAffirmativeConsent || parsedLlm.patient_consented_to_report === true);

    if (effectivePatientConsent) {
      parsedLlm.patient_consented_to_report = true;
      parsedLlm.request_report_permission = false;
      stateSnapshot.pendingReportPermission = false;
    } else {
      parsedLlm.patient_consented_to_report = false;
    }

    if (parsedLlm.request_report_permission && !effectivePatientConsent) {
      stateSnapshot.pendingReportPermission = true;
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
          const confirmedAlarms = rc.alarm_features_identified
            .filter(Boolean)
            .filter((a: string) => isConfirmedByPatient(a, stateSnapshot.chronicRiskProbe?.alarmSignsFound || []));
          if (confirmedAlarms.length > 0) {
            stateSnapshot.chronicRiskProbe.alarmSignsFound = Array.from(
              new Set([
                ...stateSnapshot.chronicRiskProbe.alarmSignsFound,
                ...confirmedAlarms,
              ])
            );
          }
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
          ...((extractedSlots.associatedSymptoms || []).filter((s: string) =>
            isConfirmedByPatient(s, stateSnapshot.intakeSlots.associatedSymptoms || [])
          )),
        ])
      ),
    };

    const newSeverityScore = parsedLlm.severity_score_0_to_100 ?? stateSnapshot.severityScore ?? 30;
    stateSnapshot.severityScore = newSeverityScore;

    const detectedRedFlags = (parsedLlm.red_flags_present || []).filter((rf: string) =>
      isConfirmedByPatient(rf, stateSnapshot.redFlagsPresent || [])
    );
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

    let finalNurseMessage = parsedLlm.nurse_dialogue || '';

    // Model Dialogue Safeguard: If the nurse explicitly declared the report is prepared or ready below,
    // the report MUST be generated and included in clinical_output, BUT ONLY after turn 1 (unless emergency)
    const assistantAnnouncedReportReady =
      stateSnapshot.turnCount > 1 && (
        /రిపోర్ట్‌ను సిద్ధం చేశా|రిపోర్ట్ సిద్ధం చేశా|రిపోర్ట్ సిద్ధంగా ఉం|క్రింద.*చూసి|డాక్టర్ గారికి చూపించవచ్చు/i.test(finalNurseMessage) ||
        /prepared.*(report|summary)|report.*ready|summary.*ready|preview.*below|view.*below/i.test(finalNurseMessage) ||
        /रिपोर्ट.*तैयार|रिपोर्ट.*देख/i.test(finalNurseMessage)
      );

    const isLifeThreateningEmergency =
      newSeverityScore >= 85 ||
      detectedRedFlags.some((rf: string) =>
        /chest pain|difficulty breathing|breathless|unconscious|stroke|hemoptysis|cyanosis|seizure|severe trauma|active bleeding/i.test(rf)
      );

    const isAskingPermission =
      parsedLlm.request_report_permission === true &&
      !effectivePatientConsent &&
      !assistantAnnouncedReportReady;

    const patientConsented =
      effectivePatientConsent ||
      assistantAnnouncedReportReady ||
      (stateSnapshot.clinicalReportGenerated === true && stateSnapshot.turnCount > 1);

    const shouldGenerateClinicalReport =
      isLifeThreateningEmergency ||
      (!isAskingPermission && patientConsented && (stateSnapshot.turnCount > 1 || parsedLlm.risk_convergence?.clinical_evidence_sufficient));

    const soap = parsedLlm.pre_consultation_summary || {};
    if (shouldGenerateClinicalReport) {
      stateSnapshot.clinicalReportGenerated = true;
      stateSnapshot.pendingReportPermission = false;
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
    } else {
      stateSnapshot.preConsultationReport = null;
      stateSnapshot.clinicalReportGenerated = false;
    }

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
History of Present Illness: ${stateSnapshot.preConsultationReport?.hpiSummary || 'Clinical intake in progress'}

CLINICAL SOAP ASSESSMENT:
• Subjective: ${stateSnapshot.preConsultationReport?.doctorSummarySOAP?.subjective || 'Intake in progress'}
• Objective: ${stateSnapshot.preConsultationReport?.doctorSummarySOAP?.objective || `Severity Score: ${newSeverityScore}/100`}
• Assessment: ${stateSnapshot.preConsultationReport?.doctorSummarySOAP?.assessment || 'In-progress evaluation'}
• Plan: ${stateSnapshot.preConsultationReport?.doctorSummarySOAP?.plan || 'Direct physician evaluation upon completion.'}
`.trim();

    const standardizedClinicalOutput = {
      severity_score: newSeverityScore,
      triage_disposition: stateSnapshot.triageDisposition,
      consultation_recommended: shouldGenerateClinicalReport ? stateSnapshot.consultationRecommended : false,
      pre_consultation_report: shouldGenerateClinicalReport ? stateSnapshot.preConsultationReport : null,
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
        soap: stateSnapshot.preConsultationReport?.doctorSummarySOAP || {
          highlightedProblem: stateSnapshot.chiefComplaint || 'Clinical Consultation',
          subjective: 'Intake in progress',
          objective: `Severity Score: ${newSeverityScore}/100`,
          assessment: 'In-progress clinical assessment',
          plan: 'Direct physician evaluation upon completion.',
        },
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
      information_complete: shouldGenerateClinicalReport,
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
    // 0. EPISODE BOUNDARY ISOLATION GUARD: Clean slate if previous state was from a different episode
    if (existing && existing.episodeId && existing.episodeId.toString() !== episodeId.toString()) {
      console.info(`[GeminiNurseBrain] Episode boundary crossed: ${existing.episodeId} !== ${episodeId}. Resetting to clean state.`);
      existing = null;
    }
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
