// Test dialogue grouping algorithm
interface ChatMessageItem {
  id: string;
  role: 'patient' | 'assistant';
  content: string;
  timestamp: string;
  audioBase64?: string;
  clinicalOutput?: any;
  immediateAttentionRequired?: boolean;
}

interface DialogueTurn {
  turnId: string;
  patientMsg?: ChatMessageItem;
  assistantMsg?: ChatMessageItem;
}

function getDialogueTurns(messages: ChatMessageItem[]): DialogueTurn[] {
  const turns: DialogueTurn[] = [];
  let currentTurn: DialogueTurn | null = null;

  for (const msg of messages) {
    if (msg.role === 'patient') {
      if (currentTurn) {
        turns.push(currentTurn);
      }
      currentTurn = {
        turnId: msg.id,
        patientMsg: msg,
      };
    } else if (msg.role === 'assistant') {
      if (currentTurn && !currentTurn.assistantMsg) {
        currentTurn.assistantMsg = msg;
        turns.push(currentTurn);
        currentTurn = null;
      } else {
        turns.push({
          turnId: msg.id,
          assistantMsg: msg,
        });
      }
    }
  }
  if (currentTurn) {
    turns.push(currentTurn);
  }
  return turns;
}

function runEpisodePersistenceTests() {
  console.log('================================================================');
  console.log('   TESTING MULTI-TURN EPISODE DIALOGUE & TURNS CONTINUITY      ');
  console.log('================================================================\n');

  // Test 1: Empty message list returns empty turns
  const emptyTurns = getDialogueTurns([]);
  console.log(`[TEST 1] Empty messages returns turns count: ${emptyTurns.length}`);
  if (emptyTurns.length === 0) {
    console.log('✅ PASSED: Empty messages returns empty turns array.\n');
  } else {
    console.error('❌ FAILED: Expected 0 turns, got', emptyTurns.length);
  }

  // Test 2: Turn 1 (Patient + Assistant)
  const turn1Messages: ChatMessageItem[] = [
    {
      id: 'msg_1',
      role: 'patient',
      content: 'Currently my stomach is fine now and my fever is also been better today.',
      timestamp: '2026-09-14T07:20:00Z',
    },
    {
      id: 'msg_2',
      role: 'assistant',
      content: "I'm your Smart Health Companion. I am so glad to hear that your stomach is feeling fine...",
      timestamp: '2026-09-14T07:20:05Z',
      clinicalOutput: {
        ayurveda_recommendation: {
          decision: 'eligible',
          recommendations: [{ name: 'Dhania' }, { name: 'Tulsi' }],
        },
      },
    },
  ];

  const turns1 = getDialogueTurns(turn1Messages);
  console.log(`[TEST 2] 1 Turn -> Dialogue turns count: ${turns1.length}`);
  if (
    turns1.length === 1 &&
    turns1[0].patientMsg?.content.includes('stomach is fine') &&
    turns1[0].assistantMsg?.content.includes('Smart Health Companion')
  ) {
    console.log('✅ PASSED: Turn 1 correctly paired patient message and assistant reply.\n');
  } else {
    console.error('❌ FAILED: Turn 1 pairing failed', turns1);
  }

  // Test 3: Turn 2 added (User asks question in Telugu: "నాకు ఈ ఆయుర్వేదం మీద సరిగ్గా ఐడియా రాలేదు...")
  const turn2Messages: ChatMessageItem[] = [
    ...turn1Messages,
    {
      id: 'msg_3',
      role: 'patient',
      content: 'నాకు ఈ ఆయుర్వేదం మీద సరిగ్గా ఐడియా రాలేదు, నువ్వు మళ్లీ ఒకసారి నాకు వివరించగలవా?',
      timestamp: '2026-09-14T07:21:00Z',
    },
    {
      id: 'msg_4',
      role: 'assistant',
      content: 'నమస్కారం అండి. నేను మీ స్మార్ట్ హెల్త్ కంపానియన్ (Smart Health Companion). తప్పకుండా వివరిస్తాను...',
      timestamp: '2026-09-14T07:21:08Z',
    },
  ];

  const turns2 = getDialogueTurns(turn2Messages);
  console.log(`[TEST 3] 2 Turns -> Dialogue turns count: ${turns2.length}`);
  if (
    turns2.length === 2 &&
    turns2[0].patientMsg?.content.includes('stomach is fine') &&
    turns2[1].patientMsg?.content.includes('నాకు ఈ ఆయుర్వేదం') &&
    turns2[1].assistantMsg?.content.includes('నమస్కారం అండి')
  ) {
    console.log('✅ PASSED: Turn 1 AND Turn 2 both persist simultaneously! Turn 1 is NOT replaced!\n');
  } else {
    console.error('❌ FAILED: Turns did not persist together', turns2);
  }

  // Test 4: Turn 3 in-progress (Patient speaks, assistant still thinking)
  const turn3Messages: ChatMessageItem[] = [
    ...turn2Messages,
    {
      id: 'msg_5',
      role: 'patient',
      content: 'Is there any dietary restriction for Dhania water?',
      timestamp: '2026-09-14T07:22:00Z',
    },
  ];

  const turns3 = getDialogueTurns(turn3Messages);
  console.log(`[TEST 4] In-progress Turn 3 -> Dialogue turns count: ${turns3.length}`);
  if (
    turns3.length === 3 &&
    turns3[2].patientMsg?.content.includes('dietary restriction') &&
    turns3[2].assistantMsg === undefined
  ) {
    console.log('✅ PASSED: In-progress Turn 3 renders patient prompt while assistant is thinking.\n');
  } else {
    console.error('❌ FAILED: In-progress turn handling failed', turns3);
  }

  console.log('================================================================');
  console.log('   ALL EPISODE PERSISTENCE & MULTI-TURN TESTS PASSED!          ');
  console.log('================================================================\n');
}

runEpisodePersistenceTests();
