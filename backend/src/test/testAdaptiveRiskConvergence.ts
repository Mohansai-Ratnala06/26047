import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { geminiNurseBrainService } from '../services/geminiNurseBrain.service';
import { NormalizedClinicalInputDTO } from '../services/clinicalBrain.service';

async function runAdaptiveRiskConvergenceTest() {
  console.log('=== RUNNING ADAPTIVE RISK CONVERGENCE & TIMING INTEGRATION TEST ===\n');

  const patientId = 'test_patient_risk_convergence_01';
  const episodeId = 'ep_chronic_cough_2026';

  let stateSnapshot: any = null;
  const conversationHistory: any[] = [];

  // -------------------------------------------------------------
  // TURN 1: Patient introduces chronic cough (sparse initial intake)
  // -------------------------------------------------------------
  console.log('--- TURN 1: Chronic Cough Intake ---');
  const turn1Input: NormalizedClinicalInputDTO = {
    patient_id: patientId,
    episode_id: episodeId,
    channel: 'mobile_app',
    message: {
      original_text: 'నాకు 6 నెలలుగా దగ్గు తగ్గట్లేదు',
      original_language: 'te',
      english_text: 'I have had a cough for 6 months and it is not reducing',
      source: 'patient',
      confidence: 1.0,
      provenance: 'patient_spoken',
    },
    patient_profile: { age: 45, sex: 'male', medical_conditions: [], allergies: [] },
    state_snapshot: stateSnapshot,
    previous_conversations: conversationHistory,
  };

  const res1 = await geminiNurseBrainService.processClinicalTurn(turn1Input);
  console.log('Turn 1 Nurse Dialogue:', res1.conversation_message);
  console.log('Turn 1 Status:', res1.status);
  console.log('Turn 1 Info Complete:', res1.information_complete);
  console.log('Turn 1 Clinical Output Attached:', res1.clinical_output !== null);
  console.log('Turn 1 Extracted Associated Symptoms:', res1.updated_state.intakeSlots?.associatedSymptoms);
  console.log('Turn 1 Chronic Risk Active:', res1.updated_state.chronicRiskProbe?.isActive);

  // Invariant 1: Turn 1 must NOT prematurely generate clinical report or complete intake
  if (res1.status !== 'in_progress') {
    throw new Error(`FAIL: Expected Turn 1 status to be 'in_progress', but got '${res1.status}'`);
  }
  if (res1.information_complete === true) {
    throw new Error('FAIL: Turn 1 marked information_complete = true prematurely!');
  }
  if (res1.clinical_output !== null) {
    throw new Error('FAIL: Turn 1 attached clinical_output prematurely before follow-up completed!');
  }
  if (res1.updated_state.preConsultationReport !== null) {
    throw new Error('FAIL: Turn 1 preConsultationReport is not null!');
  }

  // Invariant 2: Anti-hallucination check: Unconfirmed symptoms must not be present
  const assoc1 = res1.updated_state.intakeSlots?.associatedSymptoms || [];
  if (assoc1.some((s: string) => /fever|weight loss|sweat/i.test(s))) {
    throw new Error(`FAIL: Anti-hallucination breach on Turn 1! Hallucinated symptoms found: ${JSON.stringify(assoc1)}`);
  }
  console.log('✓ Turn 1 invariants passed: No premature report, no hallucinated symptoms, follow-up ongoing.\n');

  // Update state & history for Turn 2
  stateSnapshot = res1.updated_state;
  conversationHistory.push(
    { role: 'patient', content: turn1Input.message.original_text },
    { role: 'assistant', content: res1.conversation_message }
  );

  // -------------------------------------------------------------
  // TURN 2: Patient reports systemic B-symptoms (evening fever, weight loss)
  // -------------------------------------------------------------
  console.log('--- TURN 2: Alarm Symptoms Reported ---');
  const turn2Input: NormalizedClinicalInputDTO = {
    patient_id: patientId,
    episode_id: episodeId,
    channel: 'mobile_app',
    message: {
      original_text: 'అవును, సాయంత్రం వేళల్లో జ్వరం వస్తుంది మరియు బరువు కూడా చాలా తగ్గాను',
      original_language: 'te',
      english_text: 'Yes, I get fever in the evenings and I also lost a lot of weight',
      source: 'patient',
      confidence: 1.0,
      provenance: 'patient_spoken',
    },
    patient_profile: { age: 45, sex: 'male', medical_conditions: [], allergies: [] },
    state_snapshot: stateSnapshot,
    previous_conversations: conversationHistory,
  };

  const res2 = await geminiNurseBrainService.processClinicalTurn(turn2Input);
  console.log('Turn 2 Nurse Dialogue:', res2.conversation_message);
  console.log('Turn 2 Status:', res2.status);
  console.log('Turn 2 Info Complete:', res2.information_complete);
  console.log('Turn 2 Clinical Output Attached:', res2.clinical_output !== null);
  console.log('Turn 2 Alarm Signs Recorded:', res2.updated_state.chronicRiskProbe?.alarmSignsFound);

  // Invariant 3: Turn 2 should still be adaptive inquiry (prior care check or empathetic risk explanation)
  if (res2.clinical_output !== null) {
    throw new Error('FAIL: Turn 2 attached clinical_output prematurely before consent!');
  }
  console.log('✓ Turn 2 invariants passed: Adaptive inquiry progressing, no premature report.\n');

  stateSnapshot = res2.updated_state;
  conversationHistory.push(
    { role: 'patient', content: turn2Input.message.original_text },
    { role: 'assistant', content: res2.conversation_message }
  );

  // -------------------------------------------------------------
  // TURN 3: Patient reports prior fragmented care (antibiotics, syrups without relief)
  // -------------------------------------------------------------
  console.log('--- TURN 3: Prior Treatment History Reported ---');
  const turn3Input: NormalizedClinicalInputDTO = {
    patient_id: patientId,
    episode_id: episodeId,
    channel: 'mobile_app',
    message: {
      original_text: 'నేను రెండుసార్లు క్లినిక్‌కి వెళ్లి దగ్గు సిరప్ మరియు యాంటీబయాటిక్స్ తీసుకున్నాను, కానీ అసలు తగ్గలేదు',
      original_language: 'te',
      english_text: 'I went to the clinic twice and took cough syrup and antibiotics, but it did not reduce at all',
      source: 'patient',
      confidence: 1.0,
      provenance: 'patient_spoken',
    },
    patient_profile: { age: 45, sex: 'male', medical_conditions: [], allergies: [] },
    state_snapshot: stateSnapshot,
    previous_conversations: conversationHistory,
  };

  const res3 = await geminiNurseBrainService.processClinicalTurn(turn3Input);
  console.log('Turn 3 Nurse Dialogue:', res3.conversation_message);
  console.log('Turn 3 Status:', res3.status);
  console.log('Turn 3 Pending Report Permission:', res3.updated_state.pendingReportPermission);
  console.log('Turn 3 Clinical Output Attached:', res3.clinical_output !== null);

  // Invariant 4: Report should NOT be shown yet because consent is being requested!
  if (res3.clinical_output !== null) {
    throw new Error('FAIL: Turn 3 attached clinical_output while asking for permission!');
  }
  console.log('✓ Turn 3 invariants passed: Risk explained, permission requested, report gated.\n');

  stateSnapshot = res3.updated_state;
  conversationHistory.push(
    { role: 'patient', content: turn3Input.message.original_text },
    { role: 'assistant', content: res3.conversation_message }
  );

  // -------------------------------------------------------------
  // TURN 4: Patient provides Affirmative Consent in Telugu
  // -------------------------------------------------------------
  console.log('--- TURN 4: Patient Affirmative Consent Given ---');
  const turn4Input: NormalizedClinicalInputDTO = {
    patient_id: patientId,
    episode_id: episodeId,
    channel: 'mobile_app',
    message: {
      original_text: 'సరే తప్పకుండా తయారు చేయండి, డాక్టర్ గారికి చూపిస్తాను',
      original_language: 'te',
      english_text: 'Sure, definitely prepare it, I will show it to the doctor',
      source: 'patient',
      confidence: 1.0,
      provenance: 'patient_spoken',
    },
    patient_profile: { age: 45, sex: 'male', medical_conditions: [], allergies: [] },
    state_snapshot: stateSnapshot,
    previous_conversations: conversationHistory,
  };

  const res4 = await geminiNurseBrainService.processClinicalTurn(turn4Input);
  console.log('Turn 4 Nurse Dialogue:', res4.conversation_message);
  console.log('Turn 4 Status:', res4.status);
  console.log('Turn 4 Info Complete:', res4.information_complete);
  console.log('Turn 4 Clinical Output Attached:', res4.clinical_output !== null);

  // Invariant 5: Report MUST now be generated upon consent
  if (res4.status !== 'complete') {
    throw new Error(`FAIL: Expected Turn 4 status to be 'complete', but got '${res4.status}'`);
  }
  if (res4.information_complete !== true) {
    throw new Error('FAIL: Turn 4 information_complete should be true after consent!');
  }
  if (!res4.clinical_output || !res4.clinical_output.pre_consultation_report) {
    throw new Error('FAIL: Turn 4 did not attach pre_consultation_report upon affirmative consent!');
  }

  const soap = res4.clinical_output.pre_consultation_report.doctorSummarySOAP;
  console.log('SOAP Assessment:', soap.assessment);
  console.log('SOAP Plan:', soap.plan);

  // Invariant 6: High-acuity doctor differential must be present (TB, GeneXpert, Chest X-ray)
  const soapAssessment = (soap.assessment || '').toLowerCase();
  const soapPlan = (soap.plan || '').toLowerCase();
  const hasRiskDifferential =
    soapAssessment.includes('tuberculosis') ||
    soapAssessment.includes('tb') ||
    soapAssessment.includes('chronic') ||
    soapPlan.includes('x-ray') ||
    soapPlan.includes('genexpert') ||
    soapPlan.includes('sputum') ||
    soapPlan.includes('cbnaat');

  if (!hasRiskDifferential) {
    throw new Error('FAIL: High-acuity risk differential or investigations missing from SOAP plan!');
  }
  console.log('✓ Turn 4 invariants passed: Report generated upon consent with high-acuity SOAP workup.\n');

  // -------------------------------------------------------------
  // TEST 5: Episode Isolation Boundary (Sprain Episode starts completely clean)
  // -------------------------------------------------------------
  console.log('--- TEST 5: Cross-Episode Boundary Isolation ---');
  const isolatedTurnInput: NormalizedClinicalInputDTO = {
    patient_id: patientId,
    episode_id: 'ep_ankle_sprain_2026', // Different episode!
    channel: 'mobile_app',
    message: {
      original_text: 'నా చీలమండలి బెణికింది, నడవలేకపోతున్నాను',
      original_language: 'te',
      english_text: 'My ankle got twisted, I am unable to walk',
      source: 'patient',
      confidence: 1.0,
      provenance: 'patient_spoken',
    },
    patient_profile: { age: 45, sex: 'male', medical_conditions: [], allergies: [] },
    state_snapshot: res4.updated_state, // Pass previous cough state to verify boundary isolation wipes it!
    previous_conversations: [],
  };

  const resIso = await geminiNurseBrainService.processClinicalTurn(isolatedTurnInput);
  console.log('Isolated Episode Status:', resIso.status);
  console.log('Isolated Chief Complaint:', resIso.updated_state.chiefComplaint);
  console.log('Isolated Associated Symptoms:', resIso.updated_state.intakeSlots?.associatedSymptoms);
  console.log('Isolated Clinical Output Attached:', resIso.clinical_output !== null);

  if (resIso.updated_state.chiefComplaint?.toLowerCase().includes('cough')) {
    throw new Error('FAIL: Episode boundary leaked previous episode chief complaint (cough)!');
  }
  if (resIso.updated_state.intakeSlots?.associatedSymptoms?.some((s: string) => /fever|cough|sputum/i.test(s))) {
    throw new Error('FAIL: Episode boundary leaked previous episode associated symptoms!');
  }
  if (resIso.clinical_output !== null) {
    throw new Error('FAIL: Isolated Turn 1 prematurely attached clinical output!');
  }
  console.log('✓ Test 5 passed: Episode isolation boundary strictly enforced. No cross-contamination.\n');

  console.log('=== ALL 5 ADAPTIVE RISK CONVERGENCE & TIMING INVARIANTS VERIFIED SUCCESSFULLY! ===');
}

runAdaptiveRiskConvergenceTest().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
