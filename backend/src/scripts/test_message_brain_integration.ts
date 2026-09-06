/**
 * Automated Test Suite for Node Backend ↔ Python Clinical Brain Integration.
 * 
 * Verifies:
 * 1. Brain Service health check and turn invocation contracts.
 * 2. Normal non-emergency turn execution and assistant response generation.
 * 3. Emergency red-flag response propagation (immediateAttentionRequired === true).
 * 4. Multi-turn stateSnapshot persistence and rehydration on Conversation model.
 * 5. Assistant and Patient Message persistence in MongoDB.
 * 6. Python Brain unavailable / network error handling (HTTP 503 graceful fallback).
 * 7. Existing message authorization and patient resolution behavior (HTTP 401 / 404).
 */

import mongoose from 'mongoose';
import config from '../config';
import { clinicalBrainService, NormalizedClinicalInputDTO } from '../services/clinicalBrain.service';
import Message from '../models/Message';
import Conversation from '../models/Conversation';
import Patient from '../models/Patient';
import User from '../models/User';
import { sendMessage } from '../controllers/message.controller';

// Dedicated test database URI (never falls back to production/app MONGODB_URI)
const MONGODB_TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/vaidyaarc_test';

let testsPassed = 0;
let testsFailed = 0;
let testsSkipped = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    testsFailed++;
  } else {
    console.log(`  ✅ PASSED: ${message}`);
    testsPassed++;
  }
}

function skip(message: string) {
  console.log(`  ⏭️  SKIPPED: ${message}`);
  testsSkipped++;
}

async function runTestSuite() {
  console.log('================================================================================');
  console.log('VAIDYAARC NODE BACKEND ↔ PYTHON CLINICAL BRAIN INTEGRATION TEST SUITE');
  console.log('================================================================================\n');

  // Test 1: Python Brain Direct Service Tests
  console.log('--- TEST GROUP 1: Python Brain Service Direct Client ---');
  try {
    const health = await clinicalBrainService.checkHealth();
    assert(health.status === 'healthy', 'GET /health returns healthy status');
    assert(health.service === 'vaidyaarc-clinical-brain', 'Service identifier matches vaidyaarc-clinical-brain');
  } catch (err: any) {
    assert(false, `Python Brain health check failed (service must be running at http://localhost:8000): ${err.message}`);
  }

  // Test 2: Normal Turn Contract
  console.log('\n--- TEST GROUP 2: Normal Turn Processing Contract ---');
  try {
    const normalInput: NormalizedClinicalInputDTO = {
      patient_id: 'TEST_PAT_001',
      episode_id: 'TEST_EP_001',
      channel: 'mobile_app',
      message: {
        original_text: 'I have mild headache since yesterday',
        original_language: 'en',
        source: 'patient',
      },
      patient_profile: {
        age: 30,
        sex: 'male',
      },
    };

    const turnRes = await clinicalBrainService.processClinicalTurn(normalInput);
    assert(typeof turnRes.status === 'string', 'Turn response includes valid status');
    assert(turnRes.immediate_attention_required === false, 'Non-emergency turn has immediate_attention_required = false');
    assert(typeof turnRes.updated_state === 'object', 'Turn response includes updated_state object');
    assert(typeof turnRes.conversation_message === 'string' && turnRes.conversation_message.length > 0, 'Turn response includes non-empty conversation_message');
  } catch (err: any) {
    assert(false, `Normal turn processing failed: ${err.message}`);
  }

  // Test 3: Emergency Red-Flag Propagation
  console.log('\n--- TEST GROUP 3: Emergency Red-Flag Detection & Propagation ---');
  try {
    const emergencyInput: NormalizedClinicalInputDTO = {
      patient_id: 'TEST_EMERGENCY_PAT',
      episode_id: 'TEST_EMERGENCY_EP',
      channel: 'mobile_app',
      message: {
        original_text: 'I am having sudden severe chest pain with difficulty breathing',
        original_language: 'en',
        source: 'patient',
      },
    };

    const emergencyRes = await clinicalBrainService.processClinicalTurn(emergencyInput);
    assert(emergencyRes.status === 'emergency', 'Emergency turn returns status = "emergency"');
    assert(emergencyRes.immediate_attention_required === true, 'Emergency turn sets immediate_attention_required = true');
    assert(emergencyRes.red_flag_status === 'red_flags_detected', 'Emergency turn sets red_flag_status = "red_flags_detected"');
    assert(emergencyRes.conversation_message?.toUpperCase().includes('EMERGENCY') || false, 'Emergency conversation_message contains emergency warning');
  } catch (err: any) {
    assert(false, `Emergency turn processing failed: ${err.message}`);
  }

  // Test 4: Database & Controller Flow with Mocked/Live DB
  console.log('\n--- TEST GROUP 4: Message Controller End-to-End Flow & DB Persistence ---');
  let isDbConnected = false;
  try {
    await mongoose.connect(MONGODB_TEST_URI, { serverSelectionTimeoutMS: 2000 });
    isDbConnected = true;
    console.log('Connected to MongoDB test instance.');
  } catch (err) {
    console.log('MongoDB not reachable locally; skipping live DB persistence tests.');
  }

  if (isDbConnected) {
    try {
      // Setup test user, patient, and conversation
      const testUser = new User({
        name: 'Test Patient',
        phone: `+9199999${Math.floor(10000 + Math.random() * 90000)}`,
        passwordHash: 'test_password_hash_123',
        role: 'patient',
      });
      await testUser.save();

      const testPatient = new Patient({
        userId: testUser._id,
        patientCode: `PAT${Date.now()}`,
        demographics: { age: 35, gender: 'male' },
        status: 'active',
      });
      await testPatient.save();

      const testConversation = new Conversation({
        patientId: testPatient._id,
        episodeId: new mongoose.Types.ObjectId(),
        channel: 'mobile',
        language: 'en',
        status: 'active',
      });
      await testConversation.save();

      // Test 4A: Authorization Rejection on Missing User
      let authFailedAsExpected = false;
      const fakeReqAuth: any = {
        params: { conversationId: testConversation._id.toString() },
        body: { content: 'Hello' },
      };
      const fakeResAuth: any = {
        status: (code: number) => ({
          json: (_data: any) => {
            if (code === 401) authFailedAsExpected = true;
          },
        }),
      };
      await sendMessage(fakeReqAuth, fakeResAuth);
      assert(authFailedAsExpected, 'sendMessage rejects request without authenticated user (HTTP 401)');

      // Test 4B: Authorization Rejection on Wrong Patient Conversation
      let unauthConvFailed = false;
      const fakeReqWrongConv: any = {
        user: { id: testUser._id.toString() },
        params: { conversationId: new mongoose.Types.ObjectId().toString() },
        body: { content: 'Hello' },
      };
      const fakeResWrongConv: any = {
        status: (code: number) => ({
          json: (_data: any) => {
            if (code === 404) unauthConvFailed = true;
          },
        }),
      };
      await sendMessage(fakeReqWrongConv, fakeResWrongConv);
      assert(unauthConvFailed, 'sendMessage rejects unauthorized or non-existent conversation (HTTP 404)');

      // Test 4C: Successful Turn 1 - Patient Message & Assistant Message Persistence
      let turn1Success = false;
      let turn1Data: any = null;
      const fakeReqTurn1: any = {
        user: { id: testUser._id.toString() },
        params: { conversationId: testConversation._id.toString() },
        body: { content: 'I have severe burning stomach pain since 2 days' },
      };
      const fakeResTurn1: any = {
        status: (code: number) => ({
          json: (data: any) => {
            if (code === 201 && data.success) {
              turn1Success = true;
              turn1Data = data.data;
            }
          },
        }),
      };

      await sendMessage(fakeReqTurn1, fakeResTurn1);
      assert(turn1Success, 'sendMessage executes successfully and returns HTTP 201 with structured data');
      assert(turn1Data?.patientMessage?.content === 'I have severe burning stomach pain since 2 days', 'Patient message content preserved exactly in MongoDB');
      assert(turn1Data?.assistantMessage?.role === 'assistant', 'Assistant message created and persisted in MongoDB');
      assert(turn1Data?.assistantMessage?.content?.length > 0, 'Assistant message content populated from Python Brain');

      // Verify Conversation State Persistence
      const updatedConv = await Conversation.findById(testConversation._id);
      assert(updatedConv?.stateSnapshot !== undefined && updatedConv?.stateSnapshot !== null, 'Conversation.stateSnapshot is populated with Python updated_state');
      assert(typeof updatedConv?.clinicalStatus === 'string', 'Conversation.clinicalStatus is updated');

      // Test 4D: Multi-turn State Snapshot Continuity (Turn 2)
      let turn2Success = false;
      let turn2Data: any = null;
      const fakeReqTurn2: any = {
        user: { id: testUser._id.toString() },
        params: { conversationId: testConversation._id.toString() },
        body: { content: 'The pain is in my upper stomach and burning' },
      };
      const fakeResTurn2: any = {
        status: (code: number) => ({
          json: (data: any) => {
            if (code === 201 && data.success) {
              turn2Success = true;
              turn2Data = data.data;
            }
          },
        }),
      };

      await sendMessage(fakeReqTurn2, fakeResTurn2);
      assert(turn2Success, 'sendMessage handles Turn 2 with preserved stateSnapshot successfully');
      assert(turn2Data?.assistantMessage?.role === 'assistant', 'Turn 2 assistant response generated');

      // Test 4E: Emergency Message Sets Conversation emergency flags
      let emergencyTurnSuccess = false;
      let emergencyTurnData: any = null;
      const fakeReqEmerg: any = {
        user: { id: testUser._id.toString() },
        params: { conversationId: testConversation._id.toString() },
        body: { content: 'Now having sudden crushing chest pain with difficulty breathing' },
      };
      const fakeResEmerg: any = {
        status: (code: number) => ({
          json: (data: any) => {
            if (code === 201 && data.success) {
              emergencyTurnSuccess = true;
              emergencyTurnData = data.data;
            }
          },
        }),
      };

      await sendMessage(fakeReqEmerg, fakeResEmerg);
      assert(emergencyTurnSuccess, 'Emergency message executes and returns 201');
      assert(emergencyTurnData?.immediateAttentionRequired === true, 'Response payload has immediateAttentionRequired = true');
      const emergConv = await Conversation.findById(testConversation._id);
      assert(emergConv?.immediateAttentionRequired === true, 'Conversation in DB updated with immediateAttentionRequired = true');
      assert(emergConv?.clinicalStatus === 'emergency', 'Conversation in DB updated with clinicalStatus = "emergency"');

      // Test 4F: Brain Unavailable Graceful Error Handling (HTTP 503)
      const originalBrainUrl = config.brainServiceUrl;
      config.brainServiceUrl = 'http://127.0.0.1:9999'; // unreachable port
      let serviceUnavailableHandled = false;
      const fakeReqUnavailable: any = {
        user: { id: testUser._id.toString() },
        params: { conversationId: testConversation._id.toString() },
        body: { content: 'Test message during brain outage' },
      };
      const fakeResUnavailable: any = {
        status: (code: number) => ({
          json: (data: any) => {
            if (code === 503 && data.success === false) {
              serviceUnavailableHandled = true;
            }
          },
        }),
      };

      try {
        await sendMessage(fakeReqUnavailable, fakeResUnavailable);
      } finally {
        config.brainServiceUrl = originalBrainUrl;
      }
      assert(serviceUnavailableHandled, 'sendMessage returns HTTP 503 when Python Brain is unavailable');

      // Clean up test data
      await Message.deleteMany({ conversationId: testConversation._id });
      await Conversation.findByIdAndDelete(testConversation._id);
      await Patient.findByIdAndDelete(testPatient._id);
      await User.findByIdAndDelete(testUser._id);
    } catch (dbErr: any) {
      assert(false, `Database persistence test error: ${dbErr.message}`);
    } finally {
      await mongoose.disconnect();
    }
  } else {
    console.log(`Dedicated test MongoDB is unavailable at ${MONGODB_TEST_URI}; explicitly skipping DB integration tests.`);
    skip('sendMessage rejects request without authenticated user (HTTP 401) [DB unavailable]');
    skip('sendMessage rejects unauthorized or non-existent conversation (HTTP 404) [DB unavailable]');
    skip('sendMessage executes successfully and returns HTTP 201 with structured data [DB unavailable]');
    skip('Patient message content preserved exactly in MongoDB [DB unavailable]');
    skip('Assistant message created and persisted in MongoDB [DB unavailable]');
    skip('Assistant message content populated from Python Brain [DB unavailable]');
    skip('Conversation.stateSnapshot is populated with Python updated_state [DB unavailable]');
    skip('Conversation.clinicalStatus is updated [DB unavailable]');
    skip('sendMessage handles Turn 2 with preserved stateSnapshot successfully [DB unavailable]');
    skip('Turn 2 assistant response generated [DB unavailable]');
    skip('Emergency message executes and returns 201 [DB unavailable]');
    skip('Response payload has immediateAttentionRequired = true [DB unavailable]');
    skip('Conversation in DB updated with immediateAttentionRequired = true [DB unavailable]');
    skip('Conversation in DB updated with clinicalStatus = "emergency" [DB unavailable]');
    skip('sendMessage returns HTTP 503 when Python Brain is unavailable [DB unavailable]');
  }

  // Summary
  console.log('\n================================================================================');
  console.log(`TOTAL TESTS: ${testsPassed + testsFailed + testsSkipped} | PASSED: ${testsPassed} | FAILED: ${testsFailed} | SKIPPED: ${testsSkipped}`);
  console.log('================================================================================');

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

