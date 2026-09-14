import { ayurvedaKnowledgeService } from '../services/ayurvedaKnowledge.service';

function runTests() {
  console.log('=== RUNNING AYURVEDA MATCHER VERIFICATION TESTS ===\n');

  // Test 1: Count of records
  const count = ayurvedaKnowledgeService.getRecordCount();
  console.log(`[TEST 1] Loaded record count: ${count}`);
  if (count !== 22) {
    console.error(`FAILED: Expected 22 records, got ${count}`);
  } else {
    console.log('PASSED: Exactly 22 statutory records loaded.\n');
  }

  // Test 2: Mild cough -> Should return Adrak / Dalchini / Tulsi with CCRAS provenance
  const coughResult = ayurvedaKnowledgeService.evaluateAyurveda(
    ['cough', 'dry cough'],
    [],
    [],
    25, // mild severity
    []
  );
  console.log(`[TEST 2] Cough Evaluation: Decision = ${coughResult.decision}`);
  console.log(`Matched remedies: ${coughResult.recommendations.map(r => `${r.name} (${r.provenance.source_id})`).join(', ')}`);
  if (coughResult.decision === 'eligible' && coughResult.recommendations.length > 0) {
    console.log('PASSED: Mild cough matched CCRAS home remedies.\n');
  } else {
    console.error('FAILED: Cough did not return eligible remedies.\n');
  }

  // Test 3: Indigestion + Hypertension -> Bhaskaralavana Churna must be BLOCKED due to >14% sodium
  const htnResult = ayurvedaKnowledgeService.evaluateAyurveda(
    ['indigestion', 'dyspepsia'],
    [],
    ['Hypertension', 'High BP'],
    30,
    []
  );
  console.log(`[TEST 3] Indigestion + Hypertension: Decision = ${htnResult.decision}`);
  const hasBhaskara = htnResult.recommendations.some(r => r.record_id === 'API2_FORM_029_BHASKARALAVANA');
  const hasHtnBlockReason = htnResult.blocked_reasons.some(b => b.includes('hypertension'));
  console.log(`Bhaskaralavana present: ${hasBhaskara}, Block reason logged: ${hasHtnBlockReason}`);
  if (!hasBhaskara && hasHtnBlockReason) {
    console.log('PASSED: Bhaskaralavana successfully blocked for hypertensive patient.\n');
  } else {
    console.error('FAILED: Hypertension contraindication check failed.\n');
  }

  // Test 4: Severe Condition / Emergency (Severity >= 60-70 or Red Flags) -> Must be strictly BLOCKED
  const emergencyResult = ayurvedaKnowledgeService.evaluateAyurveda(
    ['chest pain', 'radiating pain'],
    [],
    [],
    75, // severe
    ['Acute chest pain radiating to arm']
  );
  console.log(`[TEST 4] Severe/Emergency: Decision = ${emergencyResult.decision}`);
  console.log(`Blocked reasons: ${emergencyResult.blocked_reasons.join(' | ')}`);
  if (emergencyResult.decision === 'blocked' && emergencyResult.recommendations.length === 0) {
    console.log('PASSED: Severe condition / emergency strictly BLOCKS all remedies.\n');
  } else {
    console.error('FAILED: Emergency did not block remedies.\n');
  }

  // Test 5: Ginger Allergy -> Adrak must be blocked
  const allergyResult = ayurvedaKnowledgeService.evaluateAyurveda(
    ['indigestion'],
    ['ginger'],
    [],
    20,
    []
  );
  console.log(`[TEST 5] Ginger Allergy: Decision = ${allergyResult.decision}`);
  const hasAdrak = allergyResult.recommendations.some(r => r.record_id === 'CCRAS_HR_001_ADRAK');
  const hasAllergyBlock = allergyResult.blocked_reasons.some(b => b.toLowerCase().includes('allergy'));
  console.log(`Adrak present: ${hasAdrak}, Allergy block reason: ${hasAllergyBlock}`);
  if (!hasAdrak && hasAllergyBlock) {
    console.log('PASSED: Adrak blocked due to patient ginger allergy.\n');
  } else {
    console.error('FAILED: Allergy check failed.\n');
  }
}

runTests();
