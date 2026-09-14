import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { clinicalBrainService, NormalizedClinicalInputDTO } from '../services/clinicalBrain.service';

async function runGeminiNurseTests() {
  console.log('================================================================');
  console.log('  TESTING GEMINI 3.5 FLASH DUAL-STREAM NURSE & AYURVEDA BRAIN   ');
  console.log('================================================================\n');

  const testPatientId = 'patient_test_999';
  const testEpisodeId = 'episode_test_888';

  // --- TURN 1: Mild Initial Complaint ---
  console.log('[TURN 1] Patient reports mild stomach burning in Telugu: "కడుపులో మంటగా ఉంది"');
  const turn1Input: NormalizedClinicalInputDTO = {
    patient_id: testPatientId,
    episode_id: testEpisodeId,
    channel: 'mobile_app',
    message: {
      original_text: 'నాకు కడుపులో మంటగా ఉంది (I have stomach burning since morning)',
      original_language: 'te',
      english_text: 'I have stomach burning since morning',
      confidence: 1.0,
      source: 'patient',
    },
    patient_profile: {
      age: 32,
      sex: 'Male',
      medical_conditions: [],
      allergies: [],
    },
    state_snapshot: null,
  };

  const turn1Response = await clinicalBrainService.processClinicalTurn(turn1Input);
  console.log('\n--- Turn 1 Nurse Response ---');
  console.log('Nurse Message:', turn1Response.conversation_message);
  console.log('Severity Score:', turn1Response.clinical_output?.severity_score);
  console.log('Triage Disposition:', turn1Response.clinical_output?.triage_disposition);
  console.log('Missing Slots:', turn1Response.missing_information);

  // --- TURN 2: Patient answers follow-up (mild severity 3/10, no red flags) ---
  console.log('\n================================================================');
  console.log('[TURN 2] Patient gives mild details (severity 3/10, after oily food)');
  const turn2Input: NormalizedClinicalInputDTO = {
    patient_id: testPatientId,
    episode_id: testEpisodeId,
    channel: 'mobile_app',
    message: {
      original_text: 'నొప్పి చాలా తక్కువగా ఉంది, సుమారు 3/10. నిన్న రాత్రి మసాలా తిన్నాక మొదలైంది. (Pain is mild, about 3/10. Started after spicy food last night).',
      original_language: 'te',
      english_text: 'Pain is mild, about 3/10. Started after spicy food last night.',
      confidence: 1.0,
      source: 'patient',
    },
    patient_profile: {
      age: 32,
      sex: 'Male',
      medical_conditions: [],
      allergies: [],
    },
    state_snapshot: turn1Response.updated_state,
  };

  const turn2Response = await clinicalBrainService.processClinicalTurn(turn2Input);
  console.log('\n--- Turn 2 Nurse Response (Should include CCRAS Remedy & Friendly Bedside Tone) ---');
  console.log('Nurse Message:', turn2Response.conversation_message);
  console.log('Severity Score:', turn2Response.clinical_output?.severity_score);
  console.log('Consultation Recommended:', turn2Response.clinical_output?.consultation_recommended);
  console.log('Remedies Offered in State:', turn2Response.updated_state?.remediesOffered);

  // --- TURN 3: Next-Day Follow-Up (Patient returns reporting status) ---
  console.log('\n================================================================');
  console.log('[TURN 3] Next-Day Follow-up: Patient returns saying it improved after remedy');
  const turn3Input: NormalizedClinicalInputDTO = {
    patient_id: testPatientId,
    episode_id: testEpisodeId,
    channel: 'mobile_app',
    message: {
      original_text: 'నిన్న మీరు చెప్పిన అల్లం తీసుకున్నాను, ఇప్పుడు మంట చాలా తగ్గింది. (I took the ginger remedy you suggested yesterday, the burning reduced a lot).',
      original_language: 'te',
      english_text: 'I took the ginger remedy you suggested yesterday, the burning reduced a lot.',
      confidence: 1.0,
      source: 'patient',
    },
    patient_profile: {
      age: 32,
      sex: 'Male',
      medical_conditions: [],
      allergies: [],
    },
    state_snapshot: turn2Response.updated_state,
  };

  const turn3Response = await clinicalBrainService.processClinicalTurn(turn3Input);
  console.log('\n--- Turn 3 Nurse Response (Follow-up Continuity & Encouragement) ---');
  console.log('Nurse Message:', turn3Response.conversation_message);
  console.log('Patient Response Logged:', turn3Response.updated_state?.patientReportedResponse);
  console.log('Triage Disposition:', turn3Response.clinical_output?.triage_disposition);

  // --- TURN 4: Severe Case / Red Flag Scenario (> 60-70 severity) ---
  console.log('\n================================================================');
  console.log('[TURN 4] Severe Condition Test: Crushing chest pain with left arm radiation (Score > 70)');
  const turn4Input: NormalizedClinicalInputDTO = {
    patient_id: 'patient_severe_111',
    episode_id: 'episode_severe_222',
    channel: 'mobile_app',
    message: {
      original_text: 'నాకు ఛాతీలో విపరీతమైన నొప్పి ఉంది, ఎడమ చేతికి పాకుతోంది, శ్వాస తీసుకోవడం కష్టంగా ఉంది! 9/10 నొప్పి! (Severe crushing chest pain radiating to left arm, difficulty breathing! 9/10 pain!)',
      original_language: 'te',
      english_text: 'Severe crushing chest pain radiating to left arm, difficulty breathing! 9/10 pain!',
      confidence: 1.0,
      source: 'patient',
    },
    patient_profile: {
      age: 58,
      sex: 'Male',
      medical_conditions: ['Hypertension'],
      allergies: [],
    },
    state_snapshot: null,
  };

  const turn4Response = await clinicalBrainService.processClinicalTurn(turn4Input);
  console.log('\n--- Turn 4 Emergency Response (Doctor Consultation & Pre-Consultation Report) ---');
  console.log('Nurse Message:', turn4Response.conversation_message);
  console.log('Immediate Attention Required:', turn4Response.immediate_attention_required);
  console.log('Red Flags Present:', turn4Response.red_flags);
  console.log('Severity Score:', turn4Response.clinical_output?.severity_score);
  console.log('Consultation Recommended:', turn4Response.clinical_output?.consultation_recommended);
  console.log('Ayurvedic Remedies (Should be EMPTY/BLOCKED):', turn4Response.clinical_output?.ayurveda_recommendation?.decision);
  console.log('\n--- Generated Pre-Consultation Report ---');
  console.log(JSON.stringify(turn4Response.clinical_output?.pre_consultation_report, null, 2));

  console.log('\n================================================================');
  console.log('  ALL MULTI-TURN GEMINI 3.5 FLASH NURSE & AYURVEDA TESTS FINISHED ');
  console.log('================================================================\n');
}

runGeminiNurseTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
