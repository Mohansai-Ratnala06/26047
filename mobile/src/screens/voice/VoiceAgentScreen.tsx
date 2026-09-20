import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Keyboard,
  LayoutAnimation,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  useAudioPlayer,
  useAudioPlayerStatus,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer, Header, GlassCard, Badge, Card, Button } from '../../components';
import { useTranslation } from '../../i18n';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { sttApi } from '../../api/sttApi';
import { ttsApi } from '../../api/ttsApi';
import { conversationApi, TurnResponseData } from '../../api/conversationApi';
import { episodeApi } from '../../api/episodeApi';
import { RootStackParamList } from '../../navigation/types';

export type CompanionMode = 'voice' | 'chat';

interface ChatMessageItem {
  id: string;
  role: 'patient' | 'assistant';
  content: string;
  timestamp: string;
  audioBase64?: string;
  clinicalOutput?: any;
  immediateAttentionRequired?: boolean;
}

export interface DialogueTurn {
  turnId: string;
  patientMsg?: ChatMessageItem;
  assistantMsg?: ChatMessageItem;
}

export const getDialogueTurns = (messages: ChatMessageItem[]): DialogueTurn[] => {
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
};

const QUICK_TOUCH_OPTIONS = [
  { label: 'Stomach Burning', prompt: 'నాకు కడుపులో మంటగా ఉంది (I have stomach burning since morning)' },
  { label: 'Dry Cough', prompt: 'నాకు పొడి దగ్గు మరియు గొంతు నొప్పిగా ఉంది (I have dry cough and throat irritation)' },
  { label: 'Mild Indigestion', prompt: 'నాకు అజీర్తిగా మరియు కడుపు ఉబ్బరంగా ఉంది (I have mild indigestion and bloating)' },
  { label: 'Headache & Cold', prompt: 'నాకు తలనొప్పి మరియు జలుబుగా ఉంది (I have a mild headache and cold)' },
  { label: 'Follow-up / Still Hurting', prompt: 'నేను మీరు చెప్పిన మందు తీసుకున్నాను, ఇంకా నొప్పిగా ఉంది (I took the remedy, but it is still hurting)' },
  { label: 'Feeling Better Today', prompt: 'మీరు చెప్పిన చిట్కాతో ఇప్పుడు చాలా నయమైంది (I feel much better after trying the home remedy)' },
];

export const VoiceAgentScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();

  // Active interaction mode: 'voice' | 'chat'
  const [activeMode, setActiveMode] = useState<CompanionMode>('voice');

  // Voice & STT state
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessingBrain, setIsProcessingBrain] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('en-IN');
  const [sttStatus, setSttStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Chat input state
  const [inputText, setInputText] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const chatScrollRef = useRef<ScrollView>(null);

  // Dynamic keyboard height tracking (ensures text input floats above keyboard on Android & iOS)
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const onKeyboardShow = (e: any) => {
      const height = e?.endCoordinates?.height || 0;
      if (height > 0) {
        try {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        } catch (_) {}
        setKeyboardHeight(height);
        setTimeout(() => {
          chatScrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    };

    const onKeyboardHide = () => {
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch (_) {}
      setKeyboardHeight(0);
    };

    const willShowSub = Keyboard.addListener('keyboardWillShow', onKeyboardShow);
    const didShowSub = Keyboard.addListener('keyboardDidShow', onKeyboardShow);
    const willHideSub = Keyboard.addListener('keyboardWillHide', onKeyboardHide);
    const didHideSub = Keyboard.addListener('keyboardDidHide', onKeyboardHide);

    return () => {
      willShowSub.remove();
      didShowSub.remove();
      willHideSub.remove();
      didHideSub.remove();
    };
  }, []);

  // Conversation & clinical state
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [brainResponse, setBrainResponse] = useState<TurnResponseData | null>(null);

  // Episode History Modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyEpisodes, setHistoryEpisodes] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Native audio recorder hook
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Native audio player hook for TTS playback
  const audioPlayer = useAudioPlayer(null);
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const [lastAudioBase64, setLastAudioBase64] = useState<string | null>(null);
  const [isSynthesizingTts, setIsSynthesizingTts] = useState(false);
  const [activeAudioMsgId, setActiveAudioMsgId] = useState<string | null>(null);
  const [loadingAudioMsgId, setLoadingAudioMsgId] = useState<string | null>(null);

  // Automatically reset active audio message when playback finishes
  useEffect(() => {
    if (audioStatus.didJustFinish) {
      setActiveAudioMsgId(null);
    }
  }, [audioStatus.didJustFinish]);

  // -------------------------------------------------------------
  // ANIMATIONS FOR FLUID ORGANIC ORB & GLOW
  // -------------------------------------------------------------
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;

  // Continuous gentle breathing animation
  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1.08,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [breatheAnim]);

  // Active listening pulse & outer ripple animation
  useEffect(() => {
    let pulseLoop: Animated.CompositeAnimation | null = null;
    let rippleLoop: Animated.CompositeAnimation | null = null;

    if (isListening || audioStatus.playing) {
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.18,
            duration: 800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.96,
            duration: 800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

      rippleLoop = Animated.loop(
        Animated.timing(rippleAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );

      pulseLoop.start();
      rippleLoop.start();
    } else {
      pulseAnim.setValue(1);
      rippleAnim.setValue(0);
    }

    return () => {
      if (pulseLoop) pulseLoop.stop();
      if (rippleLoop) rippleLoop.stop();
    };
  }, [isListening, audioStatus.playing, pulseAnim, rippleAnim]);

  // -------------------------------------------------------------
  // AUDIO PLAYBACK HANDLERS
  // -------------------------------------------------------------
  const playSpokenAudio = async (base64Audio: string) => {
    try {
      setLastAudioBase64(base64Audio);
      // Clean potential data-URI header prefix to avoid base64 decoding corruption
      const cleanBase64 = base64Audio.replace(/^data:audio\/[^;]+;base64,/, '').trim();
      // Generate a unique timestamped URI to prevent OS-level file caching and lock collisions
      const audioUri = `${FileSystem.cacheDirectory}vaidya_tts_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(audioUri, cleanBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });

      if (audioStatus.playing) {
        audioPlayer.pause();
      }

      audioPlayer.replace({ uri: audioUri });
      audioPlayer.play();
    } catch (playErr: any) {
      console.warn('[VoiceAgentScreen] Audio playback warning:', playErr?.message || playErr);
    }
  };

  const handlePlayMessageAudio = async (messageId: string, text: string, base64Audio?: string) => {
    // If THIS specific message is currently playing, tap will pause it
    if (activeAudioMsgId === messageId && audioStatus.playing) {
      audioPlayer.pause();
      return;
    }

    // If THIS message is currently paused, tap will resume playback
    if (activeAudioMsgId === messageId && !audioStatus.playing && lastAudioBase64) {
      audioPlayer.play();
      return;
    }

    // If another message was playing, pause it before switching tracks
    if (audioStatus.playing) {
      audioPlayer.pause();
    }

    setActiveAudioMsgId(messageId);

    // If audio is already directly attached to this message item
    if (base64Audio) {
      await playSpokenAudio(base64Audio);
      return;
    }

    // Check if audio was previously synthesized and cached in chatMessages state
    const cachedMsg = chatMessages.find((m) => m.id === messageId);
    if (cachedMsg?.audioBase64) {
      await playSpokenAudio(cachedMsg.audioBase64);
      return;
    }

    // On-demand speech synthesis from backend TTS service
    if (text && text.trim()) {
      try {
        setLoadingAudioMsgId(messageId);
        setIsSynthesizingTts(true);
        setSttStatus('Generating voice response...');

        // Auto-detect language code based on text characters or detectedLanguage
        const targetLang = /[\u0C00-\u0C7F]/.test(text)
          ? 'te-IN'
          : /[\u0900-\u097F]/.test(text)
          ? 'hi-IN'
          : /[\u0B80-\u0BFF]/.test(text)
          ? 'ta-IN'
          : /[\u0C80-\u0CFF]/.test(text)
          ? 'kn-IN'
          : (detectedLanguage || 'en-IN');

        const ttsRes = await ttsApi.synthesizeSpeech(text, targetLang);
        const freshAudio = (ttsRes as any)?.data?.audioBase64 || (ttsRes as any)?.audioBase64;

        if (freshAudio) {
          // Cache audio onto message state so subsequent speaker taps are immediate
          setChatMessages((prev) =>
            prev.map((msg) => (msg.id === messageId ? { ...msg, audioBase64: freshAudio } : msg))
          );
          await playSpokenAudio(freshAudio);
        } else {
          console.warn('[VoiceAgentScreen] No audio returned from TTS synthesis');
          setActiveAudioMsgId(null);
        }
      } catch (ttsErr: any) {
        console.warn('[VoiceAgentScreen] Speech synthesis failed:', ttsErr?.message || ttsErr);
        setActiveAudioMsgId(null);
      } finally {
        setLoadingAudioMsgId(null);
        setIsSynthesizingTts(false);
        setSttStatus(null);
      }
    }
  };

  const handleReplaySpokenAudio = async () => {
    if (audioStatus.playing) {
      audioPlayer.pause();
      return;
    }

    if (lastAudioBase64) {
      await playSpokenAudio(lastAudioBase64);
    } else if (brainResponse?.assistantMessage?.content) {
      const assistantId = brainResponse.assistantMessage._id || 'latest_assistant';
      await handlePlayMessageAudio(
        assistantId,
        brainResponse.assistantMessage.content,
        brainResponse.audioBase64
      );
    }
  };

  // -------------------------------------------------------------
  // CONSULTATION HISTORY HANDLERS
  // -------------------------------------------------------------
  const handleOpenHistoryModal = async () => {
    setShowHistoryModal(true);
    setIsLoadingHistory(true);
    try {
      const res = await episodeApi.getEpisodes();
      const episodeList = res?.success && Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
      setHistoryEpisodes(episodeList);
    } catch (err: any) {
      console.warn('Failed to load past episodes:', err.message);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSelectHistoricalEpisode = async (selectedEpId: string) => {
    try {
      if (audioStatus.playing) {
        audioPlayer.pause();
      }
      setActiveAudioMsgId(null);
      setLoadingAudioMsgId(null);
      setIsLoadingHistory(true);
      setActiveEpisodeId(selectedEpId);

      const msgsRes = await conversationApi.getEpisodeMessages(selectedEpId, 100);
      const messagesList = (msgsRes as any)?.data?.messages || (msgsRes as any)?.messages || [];
      if (Array.isArray(messagesList)) {
        const formatted: ChatMessageItem[] = messagesList.map((m: any) => ({
          id: m._id || String(Math.random()),
          role: m.role,
          content: m.content,
          timestamp: m.timestamp || new Date().toISOString(),
          audioBase64: m.audioBase64,
          clinicalOutput: m.structuredData?.clinical_output,
          immediateAttentionRequired: Boolean(m.structuredData?.immediate_attention_required),
        }));
        setChatMessages(formatted);

        const assistantMsgs = messagesList.filter((m: any) => m.role === 'assistant');
        const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
        if (lastAssistant) {
          const patientMsgs = messagesList.filter((m: any) => m.role === 'patient');
          const lastPatient = patientMsgs[patientMsgs.length - 1];

          // Check if any assistant message in the episode contains clinicalOutput
          const assistantWithClinicalOutput = [...assistantMsgs].reverse().find(
            (m: any) => m.structuredData?.clinical_output
          );
          let foundClinicalOutput =
            assistantWithClinicalOutput?.structuredData?.clinical_output ||
            lastAssistant.structuredData?.clinical_output ||
            null;

          // Fallback: check Episode document directly in case clinicalOutput was stored on ep.clinicalOutput
          if (!foundClinicalOutput) {
            try {
              const epRes = await episodeApi.getEpisodeById(selectedEpId);
              const epData = (epRes as any)?.data || epRes;
              if (epData?.clinicalOutput) {
                foundClinicalOutput = epData.clinicalOutput;
              }
            } catch (_) {}
          }

          setBrainResponse({
            patientMessage: lastPatient || ({} as any),
            assistantMessage: lastAssistant,
            turnStatus: 'complete',
            immediateAttentionRequired: Boolean(lastAssistant.structuredData?.immediate_attention_required),
            informationComplete: Boolean(foundClinicalOutput || lastAssistant.structuredData?.clinical_output),
            missingInformation: [],
            clinicalOutput: foundClinicalOutput,
          });
          setTranscript(lastPatient?.content || '');
        } else {
          setBrainResponse(null);
          setTranscript('');
        }
      }
      setShowHistoryModal(false);
    } catch (err: any) {
      console.warn('Failed to switch historical episode:', err.message);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // -------------------------------------------------------------
  // SESSION REHYDRATION & INITIALIZATION
  // -------------------------------------------------------------
  const handleStartNewConsultation = () => {
    if (audioStatus.playing) {
      audioPlayer.pause();
    }
    setActiveAudioMsgId(null);
    setLoadingAudioMsgId(null);
    setActiveEpisodeId(null);
    setConversationId(null);
    setBrainResponse(null);
    setTranscript('');
    setChatMessages([]);
    setLastAudioBase64(null);
    setErrorMessage(null);
    setSttStatus('New consultation ready. How can I care for you today?');
  };

  const getOrCreateActiveEpisode = async (initialChiefComplaint?: string): Promise<string> => {
    if (activeEpisodeId) return activeEpisodeId;
    try {
      const res = await episodeApi.getEpisodes();
      const episodeList = res?.success && Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
      const openEpisode = episodeList.find((ep: any) => ep.status === 'open');
      if (openEpisode && openEpisode._id) {
        setActiveEpisodeId(openEpisode._id);
        return openEpisode._id;
      }
    } catch (err) {
      console.warn('Could not fetch existing episodes:', err);
    }
    // Lazy creation: only instantiate in DB when patient actually sends a symptom/turn, with explicit consent
    const createRes = await episodeApi.createEpisode({
      chiefComplaint: initialChiefComplaint || 'Clinical Consultation & Symptom Intake',
      type: 'symptom',
      patientConsent: {
        consented: true,
        consentedAt: new Date().toISOString(),
        scope: 'clinical_intake_and_triage',
        version: '1.0',
      },
    });
    if (createRes?.success && createRes.data?._id) {
      setActiveEpisodeId(createRes.data._id);
      return createRes.data._id;
    }
    throw new Error('Failed to create or link an active medical episode.');
  };

  useEffect(() => {
    let isMounted = true;
    const initConversation = async () => {
      try {
        const res = await episodeApi.getEpisodes();
        const episodeList = res?.success && Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
        const openEpisode = episodeList.find((ep: any) => ep.status === 'open');
        if (openEpisode && openEpisode._id) {
          if (isMounted) {
            setActiveEpisodeId(openEpisode._id);
          }
          const convRes = await conversationApi.createConversation({
            episodeId: openEpisode._id,
            channel: 'voice',
            language: 'en',
          });
          if (isMounted && convRes.success && convRes.data?._id) {
            setConversationId(convRes.data._id);

            // Rehydrate complete episode consultation history and clinical state
            try {
              const msgsRes = await conversationApi.getEpisodeMessages(openEpisode._id, 100);
              const messagesList = (msgsRes as any)?.data?.messages || (msgsRes as any)?.messages || [];
            if (isMounted && Array.isArray(messagesList) && messagesList.length > 0) {
              const formatted: ChatMessageItem[] = messagesList.map((m: any) => ({
                id: m._id || String(Math.random()),
                role: m.role,
                content: m.content,
                timestamp: m.timestamp || new Date().toISOString(),
                audioBase64: m.audioBase64,
                clinicalOutput: m.structuredData?.clinical_output || (m.role === 'assistant' ? res.data?.clinicalOutput : null),
                immediateAttentionRequired: Boolean(m.structuredData?.immediate_attention_required),
              }));
              setChatMessages(formatted);

              const assistantMsgs = messagesList.filter((m: any) => m.role === 'assistant');
              const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
              if (lastAssistant) {
                const patientMsgs = messagesList.filter((m: any) => m.role === 'patient');
                const lastPatient = patientMsgs[patientMsgs.length - 1];

                setBrainResponse({
                  patientMessage: lastPatient || ({} as any),
                  assistantMessage: lastAssistant,
                  turnStatus: (res.data.clinicalStatus as any) || 'in_progress',
                  immediateAttentionRequired: Boolean(res.data.immediateAttentionRequired),
                  informationComplete: Boolean(res.data.clinicalOutput),
                  missingInformation: res.data.stateSnapshot?.missingSlots || [],
                  clinicalOutput: res.data.clinicalOutput || lastAssistant.structuredData?.clinical_output || null,
                });
                setTranscript(lastPatient?.content || '');
              }
            }
          } catch (rehydrateErr: any) {
            console.info('[VoiceAgentScreen] New intake session started.');
          }
        }
      }
    } catch (err: any) {
      console.warn('Conversation setup note:', err.message);
    }
  };
    initConversation();
    return () => {
      isMounted = false;
      if (audioStatus.playing) {
        audioPlayer.pause();
      }
    };
  }, []);

  // -------------------------------------------------------------
  // VOICE RECORDING & TRANSCRIPTION
  // -------------------------------------------------------------
  const startRecording = async () => {
    if (audioStatus.playing) {
      audioPlayer.pause();
    }
    setErrorMessage(null);
    setTranscript('');

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage('Microphone permission is required to speak.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      setIsListening(true);
      setSttStatus("I'm listening, go ahead...");
    } catch (micErr: any) {
      console.error('Recording initialization error:', micErr);
      setErrorMessage('Could not start microphone: ' + (micErr.message || micErr));
      setIsListening(false);
    }
  };

  const stopRecordingAndTranscribe = async () => {
    setIsListening(false);
    setIsTranscribing(true);
    setSttStatus('Listening to your symptoms...');

    try {
      await audioRecorder.stop();
      const recordedUri = audioRecorder.uri;

      if (!recordedUri) {
        throw new Error('No audio recording found on device.');
      }

      const audioPayload = {
        uri: recordedUri,
        name: 'recording.m4a',
        type: 'audio/m4a',
      };

      const sttRes = await sttApi.transcribeAudio(audioPayload, 'unknown');

      if (!sttRes.success || !sttRes.data?.text) {
        throw new Error(sttRes.message || 'Could not understand clearly. Please speak again.');
      }

      const recognizedText = sttRes.data.text;
      const recognizedLang = sttRes.data.language || 'en-IN';

      setTranscript(recognizedText);
      setDetectedLanguage(recognizedLang);
      setIsTranscribing(false);

      await dispatchMessageToClinicalBrain(recognizedText, recognizedLang, 'voice');
    } catch (err: any) {
      console.error('STT error:', err);
      setIsTranscribing(false);
      setIsProcessingBrain(false);
      setErrorMessage(err.message || 'Speech recognition failed. Please try again.');
    }
  };

  const handleVoiceToggle = async () => {
    if (!isListening) {
      await startRecording();
    } else {
      await stopRecordingAndTranscribe();
    }
  };

  // -------------------------------------------------------------
  // MESSAGE DISPATCH TO CLINICAL BRAIN
  // -------------------------------------------------------------
  const dispatchMessageToClinicalBrain = async (
    text: string,
    language: string,
    inputType: 'voice' | 'text'
  ) => {
    if (!text || !text.trim()) return;

    setIsProcessingBrain(true);
    setSttStatus('Thinking...');

    // Optimistically push patient message to chat timeline
    const tempPatientMsg: ChatMessageItem = {
      id: String(Date.now()),
      role: 'patient',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, tempPatientMsg]);

    try {
      let activeConvId = conversationId;
      if (!activeConvId) {
        const epId = await getOrCreateActiveEpisode();
        const convRes = await conversationApi.createConversation({
          episodeId: epId,
          channel: inputType,
          language: language || 'en',
        });
        if (convRes.success && convRes.data?._id) {
          activeConvId = convRes.data._id;
          setConversationId(activeConvId);
        } else {
          throw new Error('Could not establish an active consultation session.');
        }
      }

      const messageRes = await conversationApi.sendMessage(activeConvId, {
        content: text,
        inputType,
        language: language || 'en',
        generateAudio: activeMode === 'voice' || inputType === 'voice',
      });

      if (!messageRes.success || !messageRes.data) {
        throw new Error(messageRes.message || 'Failed to receive clinical guidance.');
      }

      const turnData = messageRes.data;
      setBrainResponse(turnData);

      // If patient confirmed an unrelated problem, update to the new concurrent episode
      if (turnData.switchedToNewEpisode && turnData.activeEpisodeId) {
        setActiveEpisodeId(turnData.activeEpisodeId);
        if (turnData.activeConversationId) {
          setConversationId(turnData.activeConversationId);
        }
      }

      // Push assistant reply to chat timeline
      if (turnData.assistantMessage?.content) {
        const assistantItem: ChatMessageItem = {
          id: turnData.assistantMessage._id || String(Date.now() + 1),
          role: 'assistant',
          content: turnData.assistantMessage.content,
          timestamp: turnData.assistantMessage.timestamp || new Date().toISOString(),
          audioBase64: turnData.audioBase64,
          clinicalOutput: turnData.clinicalOutput,
          immediateAttentionRequired: turnData.immediateAttentionRequired,
        };
        setChatMessages((prev) => [...prev, assistantItem]);
      }

      setIsProcessingBrain(false);
      setSttStatus(null);

      // Auto-play audio response in voice mode or if audio is returned
      if (turnData.audioBase64 && (inputType === 'voice' || activeMode === 'voice')) {
        const assistantMsgId = turnData.assistantMessage?._id || String(Date.now() + 1);
        setActiveAudioMsgId(assistantMsgId);
        await playSpokenAudio(turnData.audioBase64);
      } else if (!turnData.audioBase64 && (inputType === 'voice' || activeMode === 'voice') && turnData.assistantMessage?.content) {
        const assistantMsgId = turnData.assistantMessage?._id || String(Date.now() + 1);
        handlePlayMessageAudio(assistantMsgId, turnData.assistantMessage.content);
      }
    } catch (brainErr: any) {
      console.error('Brain dispatch error:', brainErr);
      setIsProcessingBrain(false);
      setErrorMessage(brainErr.message || 'Unable to connect to your Smart Health Companion. Please retry.');
    }
  };

  const handleSendTextMessage = async () => {
    if (!inputText.trim()) return;
    const textToSend = inputText.trim();
    setInputText('');
    const lang = /[\u0C00-\u0C7F]/.test(textToSend)
      ? 'te'
      : /[\u0900-\u097F]/.test(textToSend)
      ? 'hi'
      : (detectedLanguage ? detectedLanguage.substring(0, 2) : 'en');
    await dispatchMessageToClinicalBrain(textToSend, lang, 'text');
  };

  const handleQuickOptionSelect = async (optionPrompt: string) => {
    setDetectedLanguage('te-IN');
    await dispatchMessageToClinicalBrain(optionPrompt, 'te', 'text');
  };

  const isEmergency =
    brainResponse?.immediateAttentionRequired === true ||
    brainResponse?.turnStatus === 'emergency';

  // -------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------
  return (
    <ScreenContainer
      scrollable={activeMode === 'voice'}
      hasBottomTabs={activeMode === 'voice' || keyboardHeight === 0}
      style={[
        activeMode === 'chat' ? styles.chatScreenContent : styles.voiceScreenContent,
        activeMode === 'chat' && {
          paddingBottom:
            Platform.OS === 'android'
              ? (keyboardHeight > 0 ? keyboardHeight + 6 : 84)
              : (keyboardHeight > 0 ? 8 : 84),
        },
      ]}
      contentContainerStyle={styles.container}
    >
      {/* Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeftCol}>
          <Text style={styles.headerCompanionName}>Smart Health Companion</Text>
          <View style={styles.statusIndicatorRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerSubtitle}>AI Clinical Health Companion</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          {/* Quick Header Assessment Button (Direct access ONLY when pre-consultation report is ready) */}
          {(() => {
            const activeReportOutput =
              brainResponse?.clinicalOutput?.pre_consultation_report
                ? brainResponse.clinicalOutput
                : chatMessages.slice().reverse().find((m) => m.clinicalOutput?.pre_consultation_report)?.clinicalOutput;
            if (!activeReportOutput) return null;
            return (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('ClinicalResults', {
                    clinicalOutput: activeReportOutput,
                    conversationId: conversationId || undefined,
                  })
                }
                style={styles.headerReportActionBtn}
                accessibilityLabel="View Assessment Report"
              >
                <Ionicons name="document-text" size={18} color={colors.primary} />
              </TouchableOpacity>
            );
          })()}

          <TouchableOpacity
            onPress={handleOpenHistoryModal}
            style={styles.headerActionBtn}
            accessibilityLabel={t('voice.historyTitle')}
          >
            <Ionicons name="time-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleStartNewConsultation}
            style={styles.headerActionBtn}
            accessibilityLabel={t('voice.startNewConsultation')}
          >
            <Ionicons name="refresh" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Option-Based Touch Assistance Chips (Visible before dialogue starts) */}
      {chatMessages.length === 0 ? (
        <View style={styles.chipsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScrollContent}
          >
            {QUICK_TOUCH_OPTIONS.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.touchChip}
                onPress={() => handleQuickOptionSelect(item.prompt)}
                activeOpacity={0.8}
              >
                <Text style={styles.touchChipText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Quick Option-Based Touch Assistance Chips */}
      <View style={styles.chipsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScrollContent}
        >
          {QUICK_TOUCH_OPTIONS.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.touchChip}
              onPress={() => handleQuickOptionSelect(item.prompt)}
              activeOpacity={0.8}
            >
              <Text style={styles.touchChipText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Error Alert Card */}
      {errorMessage ? (
        <Card variant="outlined" style={styles.errorCard}>
          <View style={styles.alertRow}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        </Card>
      ) : null}

      {/* Emergency Alert Banner */}
      {isEmergency ? (
        <View style={styles.emergencyBanner}>
          <View style={styles.emergencyHeaderRow}>
            <Ionicons name="warning" size={22} color="#FFFFFF" />
            <Text style={styles.emergencyTitle}>CLINICAL ALERT / IMMEDIATE ATTENTION</Text>
          </View>
          <Text style={styles.emergencySubtitle}>
            Your reported symptoms indicate significant distress. Please consult a doctor or emergency room immediately.
          </Text>
        </View>
      ) : null}

      {/* ============================================================= */}
      {/* MODE 1: VOICE ASSISTANCE INTERFACE (Reference 2: Organic Fluid Orb) */}
      {/* ============================================================= */}
      {activeMode === 'voice' ? (
        <View style={styles.voiceModeContainer}>
          {/* Organic Fluid Glowing Orb Stage - VISIBLE ONLY ON FIRST INTERACTION */}
          {chatMessages.length === 0 ? (
            <>
              <View style={styles.orbStage}>
                {/* Animated Outer Ripple when active */}
                {(isListening || audioStatus.playing) && (
                  <Animated.View
                    style={[
                      styles.orbRipple,
                      {
                        transform: [
                          {
                            scale: rippleAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.45],
                            }),
                          },
                        ],
                        opacity: rippleAnim.interpolate({
                          inputRange: [0, 0.7, 1],
                            outputRange: [0.6, 0.25, 0],
                          }),
                        },
                      ]}
                    />
                  )}

                {/* Glowing Middle Halo */}
                <Animated.View
                  style={[
                    styles.orbHalo,
                    isEmergency && styles.orbHaloEmergency,
                    {
                      transform: [{ scale: isListening || audioStatus.playing ? pulseAnim : breatheAnim }],
                    },
                  ]}
                />

                {/* Core Fluid Orb Touch Target */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={handleVoiceToggle}
                  style={[
                    styles.fluidOrbCore,
                    isListening && styles.fluidOrbCoreListening,
                    isEmergency && styles.fluidOrbCoreEmergency,
                  ]}
                >
                  {/* Internal Organic Liquid Highlight */}
                  <View style={styles.orbInnerHighlight} />

                  {isTranscribing || isProcessingBrain || isSynthesizingTts ? (
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  ) : audioStatus.playing ? (
                    <Ionicons name="volume-high" size={48} color="#FFFFFF" />
                  ) : (
                    <Ionicons name={isListening ? 'stop' : 'mic'} size={46} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Dynamic Status Typography */}
              <Text style={styles.orbStatusPrompt}>
                {audioStatus.playing
                  ? t('voice.speakingPrompt')
                  : isListening
                  ? t('voice.listeningPrompt')
                  : isTranscribing || isProcessingBrain
                  ? t('voice.thinkingPrompt')
                  : t('voice.tapToSpeak')}
              </Text>
            </>
          ) : (
            /* Active Companion Status Pill once conversation has started */
            (isListening || isTranscribing || isProcessingBrain || audioStatus.playing) && (
              <View style={styles.compactStatusPill}>
                <View style={[styles.compactStatusDot, isListening && styles.compactStatusDotListening]} />
                <Text style={styles.compactStatusText}>
                  {audioStatus.playing
                    ? t('voice.speakingPrompt')
                    : isListening
                    ? t('voice.listeningPrompt')
                    : t('voice.thinkingPrompt')}
                </Text>
              </View>
            )
          )}

          {/* Running Multi-Turn Conversational Feed in Voice Mode (Persists Across Turns) */}
          {chatMessages.length > 0 ? (
            <View style={styles.voiceHistoryContainer}>
              {getDialogueTurns(chatMessages).map((turn, turnIdx) => {
                const allTurns = getDialogueTurns(chatMessages);
                const isLatestTurn = turnIdx === allTurns.length - 1;
                const turnClinicalOutput =
                  turn.assistantMsg?.clinicalOutput ||
                  (isLatestTurn ? brainResponse?.clinicalOutput : null);

                return (
                  <View key={turn.turnId || String(turnIdx)} style={styles.turnWrapper}>
                    <GlassCard tint="mint" style={styles.liveVoiceCard}>
                      {turn.patientMsg ? (
                        <View style={styles.liveVoiceSection}>
                          <Text style={styles.liveVoiceRoleLabel}>{t('voice.youSaidLabel')}</Text>
                          <Text style={styles.liveVoicePatientText}>"{turn.patientMsg.content}"</Text>
                        </View>
                      ) : null}

                      {turn.assistantMsg ? (
                        <View style={[styles.liveVoiceSection, turn.patientMsg ? styles.liveVoiceDivider : null]}>
                          <View style={styles.assistantHeaderRow}>
                            <Text style={styles.liveVoiceRoleLabel}>{t('voice.assistantLabel')}</Text>
                            <TouchableOpacity
                              onPress={() =>
                                handlePlayMessageAudio(
                                  turn.assistantMsg!.id,
                                  turn.assistantMsg!.content,
                                  turn.assistantMsg!.audioBase64
                                )
                              }
                              style={styles.miniAudioBtn}
                              accessibilityLabel="Listen to Response"
                              disabled={loadingAudioMsgId === turn.assistantMsg!.id}
                            >
                              {loadingAudioMsgId === turn.assistantMsg!.id ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                              ) : (
                                <Ionicons
                                  name={
                                    activeAudioMsgId === turn.assistantMsg!.id && audioStatus.playing
                                      ? 'pause'
                                      : activeAudioMsgId === turn.assistantMsg!.id && !audioStatus.playing
                                      ? 'play'
                                      : 'volume-high'
                                  }
                                  size={18}
                                  color={colors.primary}
                                />
                              )}
                            </TouchableOpacity>
                          </View>
                          <Text style={styles.liveVoiceAssistantText}>
                            {turn.assistantMsg.content}
                          </Text>
                        </View>
                      ) : isProcessingBrain && isLatestTurn ? (
                        <View style={[styles.liveVoiceSection, styles.liveVoiceDivider]}>
                          <View style={styles.thinkingInlineRow}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.thinkingInlineText}>Thinking and formulating guidance...</Text>
                          </View>
                        </View>
                      ) : null}
                    </GlassCard>

                    {/* Grounded Ayurvedic Home Care Card ONLY for the latest conversation turn and when NOT in acute emergency */}
                    {isLatestTurn &&
                    !turnClinicalOutput?.safety_findings?.immediate_attention_required &&
                    turnClinicalOutput?.triage_disposition !== 'emergency' &&
                    !turnClinicalOutput?.immediateAttentionRequired &&
                    (turnClinicalOutput?.severity_score == null || turnClinicalOutput.severity_score < 80) &&
                    turnClinicalOutput?.ayurveda_recommendation?.decision === 'eligible' &&
                    turnClinicalOutput.ayurveda_recommendation.recommendations?.length > 0 ? (
                      <Card variant="mintWash" style={styles.homeCareCard}>
                        <View style={styles.homeCareHeaderRow}>
                          <Ionicons name="leaf-outline" size={20} color={colors.primary} />
                          <Text style={styles.homeCareTitle}>{t('voice.homeCareTitle')}</Text>
                        </View>
                        {turnClinicalOutput.ayurveda_recommendation.recommendations.map(
                          (item: any, i: number) => (
                            <View key={i} style={styles.remedyItemRow}>
                              <Text style={styles.remedyName}>{item.name}</Text>
                              <Text style={styles.remedyPrep}>{item.preparation_summary}</Text>
                              <Text style={styles.remedyDosage}>Dose: {item.source_dosage_reference}</Text>
                            </View>
                          )
                        )}
                        <Text style={styles.remedyDisclaimer}>
                          {t('voice.homeCareDisclaimer')}
                        </Text>
                      </Card>
                    ) : null}

                    {/* Grounded Clinical Assessment or Escalation Card attached directly to the latest turn ONLY when pre-consultation report is ready */}
                    {(() => {
                      const targetOutput = turnClinicalOutput || (isLatestTurn ? brainResponse?.clinicalOutput : null);
                      if (!isLatestTurn || !targetOutput || !targetOutput.pre_consultation_report) return null;

                      const isEscalated =
                        targetOutput.consultation_recommended ||
                        targetOutput.immediateAttentionRequired ||
                        targetOutput.safety_findings?.immediate_attention_required ||
                        (targetOutput.severity_score != null && targetOutput.severity_score >= 60);

                      return isEscalated ? (
                        <View style={styles.chatEscalationCard}>
                          <View style={styles.escalationHeaderRow}>
                            <Ionicons name="medical" size={18} color={colors.error} />
                            <Text style={styles.escalationTitle}>Physician Consultation Recommended</Text>
                          </View>
                          <Text style={styles.escalationDesc}>
                            Your Smart Health Companion has prepared your complete Pre-Consultation Summary for your physician.
                          </Text>
                          <TouchableOpacity
                            style={styles.chatEscalationBtn}
                            onPress={() =>
                              navigation.navigate('ClinicalResults', {
                                clinicalOutput: targetOutput,
                                conversationId: conversationId || undefined,
                              })
                            }
                          >
                            <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
                            <Text style={styles.chatEscalationBtnText}>Preview Pre-Consultation Summary</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.chatReportCardBtn}
                          onPress={() =>
                            navigation.navigate('ClinicalResults', {
                              clinicalOutput: targetOutput,
                              conversationId: conversationId || undefined,
                            })
                          }
                          activeOpacity={0.88}
                        >
                          <View style={styles.chatReportIconWrap}>
                            <Ionicons name="document-text" size={18} color={colors.primary} />
                          </View>
                          <View style={styles.chatReportTextCol}>
                            <Text style={styles.chatReportTitle}>Clinical Assessment Report Ready</Text>
                            <Text style={styles.chatReportSubtitle}>Tap to view triage analysis & Daśavidha assessment</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                );
              })}
            </View>
          ) : transcript ? (
            <GlassCard tint="mint" style={styles.liveVoiceCard}>
              <View style={styles.liveVoiceSection}>
                <Text style={styles.liveVoiceRoleLabel}>YOU SAID</Text>
                <Text style={styles.liveVoicePatientText}>"{transcript}"</Text>
              </View>
              {isProcessingBrain && (
                <View style={[styles.liveVoiceSection, styles.liveVoiceDivider]}>
                  <View style={styles.thinkingInlineRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.thinkingInlineText}>Thinking and formulating guidance...</Text>
                  </View>
                </View>
              )}
            </GlassCard>
          ) : null}

          {/* In-Voice Mode Grounded Clinical Assessment Card fallback if no turns container active */}
          {(() => {
            const fallbackOutput = brainResponse?.clinicalOutput;
            if (chatMessages.length !== 0 || !fallbackOutput || !fallbackOutput.pre_consultation_report) return null;

            const isEscalated =
              fallbackOutput.consultation_recommended ||
              brainResponse.immediateAttentionRequired ||
              fallbackOutput.safety_findings?.immediate_attention_required ||
              (fallbackOutput.severity_score != null && fallbackOutput.severity_score >= 60);

            return isEscalated ? (
              <View style={styles.chatEscalationCard}>
                <View style={styles.escalationHeaderRow}>
                  <Ionicons name="medical" size={18} color={colors.error} />
                  <Text style={styles.escalationTitle}>Physician Consultation Recommended</Text>
                </View>
                <Text style={styles.escalationDesc}>
                  Your Smart Health Companion has prepared your complete Pre-Consultation Summary for your physician.
                </Text>
                <TouchableOpacity
                  style={styles.chatEscalationBtn}
                  onPress={() =>
                    navigation.navigate('ClinicalResults', {
                      clinicalOutput: fallbackOutput,
                      conversationId: conversationId || undefined,
                    })
                  }
                >
                  <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.chatEscalationBtnText}>Preview Pre-Consultation Summary</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.chatReportCardBtn}
                onPress={() =>
                  navigation.navigate('ClinicalResults', {
                    clinicalOutput: fallbackOutput,
                    conversationId: conversationId || undefined,
                  })
                }
                activeOpacity={0.88}
              >
                <View style={styles.chatReportIconWrap}>
                  <Ionicons name="document-text" size={18} color={colors.primary} />
                </View>
                <View style={styles.chatReportTextCol}>
                  <Text style={styles.chatReportTitle}>Clinical Assessment Report Ready</Text>
                  <Text style={styles.chatReportSubtitle}>Tap to view triage analysis & Daśavidha assessment</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </TouchableOpacity>
            );
          })()}

          {/* Floating Bottom Control Bar (Reference 2: Chat Icon, Center Mic, Action) */}
          <View style={styles.voiceBottomBar}>
            {/* Switch to Chat Icon Button */}
            <TouchableOpacity
              style={styles.floatingControlBtn}
              onPress={() => setActiveMode('chat')}
              accessibilityLabel="Switch to Chat Mode"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
            </TouchableOpacity>

            {/* Center Mic Action Button */}
            <TouchableOpacity
              style={[
                styles.centerMicFloatBtn,
                isListening && styles.centerMicFloatBtnListening,
              ]}
              onPress={handleVoiceToggle}
              accessibilityLabel="Toggle Microphone"
            >
              <Ionicons name={isListening ? 'stop' : 'mic'} size={28} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Cross / Reset Action Button */}
            <TouchableOpacity
              style={styles.floatingControlBtn}
              onPress={() => {
                if (isListening) {
                  handleVoiceToggle();
                } else {
                  handleStartNewConsultation();
                }
              }}
              accessibilityLabel="Reset / Close"
            >
              <Ionicons name="close" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* ============================================================= */
        /* MODE 2: CHAT & TOUCH ASSISTANCE INTERFACE (Gemini Mobile Style) */
        /* ============================================================= */
        <View style={styles.chatModeContainer}>
          {/* Conversational Message Feed */}
          <ScrollView
            ref={chatScrollRef}
            style={styles.chatScrollArea}
            contentContainerStyle={styles.chatScrollContent}
            onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {chatMessages.length === 0 ? (
              <View style={styles.emptyChatWelcome}>
                <View style={styles.emptyWelcomeIconWrap}>
                  <Ionicons name="heart-half-outline" size={36} color={colors.primary} />
                </View>
                <Text style={styles.emptyWelcomeTitle}>I'm your Smart Health Companion</Text>
                <Text style={styles.emptyWelcomeSubtitle}>
                  Describe any discomfort or choose a quick topic above. I am here to care for you.
                </Text>
              </View>
            ) : (
              chatMessages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.chatBubbleRow,
                    msg.role === 'patient' ? styles.chatBubbleRowPatient : styles.chatBubbleRowAssistant,
                  ]}
                >
                  {msg.role === 'assistant' && (
                    <View style={styles.assistantAvatarSmall}>
                      <Ionicons name="medkit" size={14} color="#FFFFFF" />
                    </View>
                  )}

                  <View
                    style={[
                      styles.chatBubble,
                      msg.role === 'patient' ? styles.chatBubblePatient : styles.chatBubbleAssistant,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chatBubbleText,
                        msg.role === 'patient' ? styles.chatBubbleTextPatient : styles.chatBubbleTextAssistant,
                      ]}
                    >
                      {msg.content}
                    </Text>

                    {/* Audio Play Button on Assistant Bubble */}
                    {msg.role === 'assistant' ? (
                      <TouchableOpacity
                        onPress={() => handlePlayMessageAudio(msg.id, msg.content, msg.audioBase64)}
                        style={styles.chatBubbleAudioBtn}
                        accessibilityLabel="Listen to Message"
                        disabled={loadingAudioMsgId === msg.id}
                      >
                        {loadingAudioMsgId === msg.id ? (
                          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 4 }} />
                        ) : (
                          <Ionicons
                            name={
                              activeAudioMsgId === msg.id && audioStatus.playing
                                ? 'pause'
                                : activeAudioMsgId === msg.id && !audioStatus.playing
                                ? 'play'
                                : 'volume-high-outline'
                            }
                            size={16}
                            color={colors.primary}
                          />
                        )}
                        <Text style={styles.chatBubbleAudioLabel}>
                          {loadingAudioMsgId === msg.id
                            ? 'Loading...'
                            : activeAudioMsgId === msg.id && audioStatus.playing
                            ? 'Pause'
                            : activeAudioMsgId === msg.id && !audioStatus.playing
                            ? 'Resume'
                            : 'Listen'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {/* Grounded Ayurvedic Home Remedy Badge in Bubble (Latest Turn Only) */}
                    {msg.role === 'assistant' &&
                    msg.id === chatMessages.filter((m) => m.role === 'assistant').slice(-1)[0]?.id &&
                    msg.clinicalOutput?.ayurveda_recommendation?.decision === 'eligible' &&
                    msg.clinicalOutput.ayurveda_recommendation.recommendations?.length > 0 ? (
                      <View style={styles.chatRemedyCard}>
                        <View style={styles.chatRemedyHeader}>
                          <Ionicons name="leaf" size={14} color={colors.primary} />
                          <Text style={styles.chatRemedyTitle}>
                            {msg.clinicalOutput.ayurveda_recommendation.recommendations[0].name}
                          </Text>
                        </View>
                        <Text style={styles.chatRemedyPrep}>
                          {msg.clinicalOutput.ayurveda_recommendation.recommendations[0].preparation_summary}
                        </Text>
                        <Text style={styles.chatRemedyDose}>
                          Dose: {msg.clinicalOutput.ayurveda_recommendation.recommendations[0].source_dosage_reference}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))
            )}

            {isProcessingBrain ? (
              <View style={styles.chatTypingIndicator}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.chatTypingText}>Typing...</Text>
              </View>
            ) : null}

            {/* In-feed Clinical Assessment or Escalation card in Chat Mode ONLY when pre-consultation report is ready */}
            {(() => {
              const activeChatOutput =
                brainResponse?.clinicalOutput?.pre_consultation_report
                  ? brainResponse.clinicalOutput
                  : chatMessages.slice().reverse().find((m) => m.clinicalOutput?.pre_consultation_report)?.clinicalOutput;
              if (!activeChatOutput) return null;

              const isEscalated =
                activeChatOutput.consultation_recommended ||
                activeChatOutput.immediateAttentionRequired ||
                activeChatOutput.safety_findings?.immediate_attention_required ||
                (activeChatOutput.severity_score != null && activeChatOutput.severity_score >= 60);

              return isEscalated ? (
                <View style={styles.chatEscalationCard}>
                  <View style={styles.escalationHeaderRow}>
                    <Ionicons name="medical" size={18} color={colors.error} />
                    <Text style={styles.escalationTitle}>Physician Consultation Recommended</Text>
                  </View>
                  <Text style={styles.escalationDesc}>
                    Your Smart Health Companion has prepared your complete Pre-Consultation Summary for your physician.
                  </Text>
                  <TouchableOpacity
                    style={styles.chatEscalationBtn}
                    onPress={() =>
                      navigation.navigate('ClinicalResults', {
                        clinicalOutput: activeChatOutput,
                        conversationId: conversationId || undefined,
                      })
                    }
                  >
                    <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.chatEscalationBtnText}>Preview Pre-Consultation Summary</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.chatReportCardBtn}
                  onPress={() =>
                    navigation.navigate('ClinicalResults', {
                      clinicalOutput: activeChatOutput,
                      conversationId: conversationId || undefined,
                    })
                  }
                  activeOpacity={0.88}
                >
                  <View style={styles.chatReportIconWrap}>
                    <Ionicons name="document-text" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.chatReportTextCol}>
                    <Text style={styles.chatReportTitle}>Clinical Assessment Report Ready</Text>
                    <Text style={styles.chatReportSubtitle}>Tap to view triage analysis & Daśavidha assessment</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                </TouchableOpacity>
              );
            })()}
          </ScrollView>

          {/* Gemini-Style Floating Pill Input Bar - Anchored right above bottom tabs */}
          <View style={styles.chatInputPillContainer}>
            <TextInput
              style={styles.chatTextInput}
              placeholder={t('voice.typeSymptomPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              onFocus={() => {
                setTimeout(() => {
                  chatScrollRef.current?.scrollToEnd({ animated: true });
                }, 150);
              }}
            />

            <View style={styles.chatInputButtonsRow}>
              {/* Mic Button - 1-tap switch from Chat to Voice Assistant */}
              <TouchableOpacity
                onPress={() => setActiveMode('voice')}
                style={styles.micShortcutBtn}
                accessibilityLabel="Switch to Voice Assistant"
              >
                <Ionicons name="mic" size={20} color={colors.primary} />
              </TouchableOpacity>

              {/* Message Send Button right alongside Mic */}
              <TouchableOpacity
                onPress={handleSendTextMessage}
                disabled={inputText.trim().length === 0}
                style={[
                  styles.sendIconBtn,
                  inputText.trim().length === 0 && styles.sendIconBtnDisabled,
                ]}
                accessibilityLabel={t('voice.sendBtn')}
              >
                <Ionicons
                  name="arrow-up"
                  size={20}
                  color={inputText.trim().length === 0 ? '#94A3B8' : '#FFFFFF'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ============================================================= */}
      {/* CONSULTATION EPISODE HISTORY MODAL */}
      {/* ============================================================= */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.historyModalCard}>
            <View style={styles.historyModalHeader}>
              <View style={styles.historyHeaderTitleCol}>
                <Text style={styles.historyModalTitle}>Consultation History</Text>
                <Text style={styles.historyModalSubtitle}>Review past symptom discussions</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowHistoryModal(false)}
                style={styles.modalCloseBtn}
                accessibilityLabel="Close History"
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {isLoadingHistory ? (
              <View style={styles.historyLoadingBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.historyLoadingText}>Loading previous consultations...</Text>
              </View>
            ) : historyEpisodes.length === 0 ? (
              <View style={styles.historyEmptyState}>
                <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
                <Text style={styles.historyEmptyTitle}>No Previous Consultations</Text>
                <Text style={styles.historyEmptySubtitle}>
                  Your conversation history with your Smart Health Companion will be stored here.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.historyListScroll} showsVerticalScrollIndicator={false}>
                {historyEpisodes.map((ep: any) => {
                  const isCurrent = ep._id === activeEpisodeId;
                  const epDate = ep.startedAt || ep.createdAt
                    ? new Date(ep.startedAt || ep.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Recent';

                  return (
                    <TouchableOpacity
                      key={ep._id}
                      style={[styles.historyItemCard, isCurrent && styles.historyItemCardActive]}
                      onPress={() => handleSelectHistoricalEpisode(ep._id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.historyItemTopRow}>
                        <Text style={styles.historyItemDate}>{epDate}</Text>
                        <View
                          style={[
                            styles.historyStatusBadge,
                            ep.status === 'open' ? styles.badgeOpen : styles.badgeResolved,
                          ]}
                        >
                          <Text style={styles.historyStatusBadgeText}>
                            {isCurrent ? 'ACTIVE NOW' : (ep.status || 'Resolved').toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.historyItemComplaint} numberOfLines={2}>
                        {ep.chiefComplaint || 'Clinical Consultation'}
                      </Text>
                      <View style={styles.historyItemFooter}>
                        <Text style={styles.historyItemViewPrompt}>Tap to view conversation →</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 6,
    paddingTop: spacing.xs,
    paddingBottom: 100,
    backgroundColor: '#FAFDFB',
  },
  chatScreenContent: {
    flex: 1,
    paddingHorizontal: 6, // Widen chat across screen width without heavy bounding
    paddingTop: 4,
    paddingBottom: 84,    // Keeps input pill floating right above the bottom tab bar
  },
  voiceScreenContent: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 90,
  },

  // Top Header
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  headerLeftCol: {
    flex: 1,
  },
  headerCompanionName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(10, 77, 82, 0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerReportActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },


  // Touch Assistance Chips
  chipsWrapper: {
    marginBottom: spacing.sm,
  },
  chipsScrollContent: {
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  touchChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.soft,
  },
  touchChipText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primaryDark,
  },

  // Alerts
  errorCard: {
    marginBottom: spacing.sm,
    borderColor: colors.error,
    backgroundColor: '#FEF2F2',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
    flex: 1,
  },
  emergencyBanner: {
    backgroundColor: '#DC2626',
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  emergencyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  emergencyTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  emergencySubtitle: {
    fontSize: typography.fontSize.sm,
    color: '#FFFFFF',
    lineHeight: 18,
  },

  // -------------------------------------------------------------
  // VOICE MODE STYLES (Reference 2)
  // -------------------------------------------------------------
  voiceModeContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  orbStage: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  orbRipple: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(52, 211, 153, 0.4)',
  },
  orbHalo: {
    position: 'absolute',
    width: 175,
    height: 175,
    borderRadius: 88,
    backgroundColor: 'rgba(167, 243, 208, 0.55)',
    borderWidth: 2,
    borderColor: 'rgba(110, 231, 183, 0.7)',
  },
  orbHaloEmergency: {
    backgroundColor: 'rgba(254, 202, 202, 0.6)',
    borderColor: 'rgba(239, 68, 68, 0.8)',
  },
  fluidOrbCore: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 12,
  },
  fluidOrbCoreListening: {
    backgroundColor: '#059669',
  },
  fluidOrbCoreEmergency: {
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
  },
  orbInnerHighlight: {
    position: 'absolute',
    top: 10,
    left: 20,
    width: 50,
    height: 25,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    transform: [{ rotate: '-25deg' }],
  },
  orbStatusPrompt: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primaryDark,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  voiceHistoryContainer: {
    width: '100%',
  },
  turnWrapper: {
    width: '100%',
    marginBottom: spacing.xs,
  },
  turnHeaderBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(10, 77, 82, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 6,
  },
  turnHeaderBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thinkingInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  thinkingInlineText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontStyle: 'italic',
  },
  liveVoiceCard: {
    width: '100%',
    padding: spacing.md,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  liveVoiceSection: {
    paddingVertical: 2,
  },
  liveVoiceDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(10, 77, 82, 0.1)',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  liveVoiceRoleLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  liveVoicePatientText: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    fontStyle: 'italic',
  },
  assistantHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  liveVoiceAssistantText: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  miniAudioBtn: {
    padding: 4,
  },

  // Home Care Card
  homeCareCard: {
    width: '100%',
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 20,
  },
  homeCareHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  homeCareTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  remedyItemRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  remedyName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  remedyPrep: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    marginTop: 2,
  },
  remedyDosage: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: typography.fontWeight.semiBold,
  },
  remedyDisclaimer: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },

  // Voice Bottom Floating Control Bar (Reference 2)
  voiceBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 220,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: spacing.sm,
    ...shadows.card,
  },
  floatingControlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(10, 77, 82, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerMicFloatBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.card,
  },
  centerMicFloatBtnListening: {
    backgroundColor: '#DC2626',
  },

  // -------------------------------------------------------------
  // CHAT MODE STYLES (Gemini Style - Full Width & Anchored Bottom)
  // -------------------------------------------------------------
  chatModeContainer: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'space-between',
  },
  chatScrollArea: {
    flex: 1,
  },
  chatScrollContent: {
    paddingVertical: spacing.xs,
    paddingHorizontal: 2,
    gap: 8,
  },
  emptyChatWelcome: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  emptyWelcomeIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  emptyWelcomeTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
    marginBottom: 4,
  },
  emptyWelcomeSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  chatBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginVertical: 3,
    paddingHorizontal: 2,
    width: '100%',
  },
  chatBubbleRowPatient: {
    justifyContent: 'flex-end',
  },
  chatBubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  assistantAvatarSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatBubble: {
    maxWidth: '92%', // Widened chat field from left and right
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chatBubblePatient: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  chatBubbleAssistant: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.soft,
  },
  chatBubbleText: {
    fontSize: typography.fontSize.md,
    lineHeight: 22,
  },
  chatBubbleTextPatient: {
    color: '#FFFFFF',
  },
  chatBubbleTextAssistant: {
    color: colors.textPrimary,
  },
  chatBubbleAudioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  chatBubbleAudioLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primary,
  },
  chatRemedyCard: {
    backgroundColor: '#F0FAF8',
    borderRadius: 12,
    padding: spacing.xs,
    marginTop: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  chatRemedyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  chatRemedyTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  chatRemedyPrep: {
    fontSize: 11,
    color: colors.textPrimary,
  },
  chatRemedyDose: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chatTypingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  chatTypingText: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  // In-Feed Assessment & Pre-Consultation Summary Cards
  chatReportCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 16,
    padding: 12,
    marginVertical: 6,
    marginHorizontal: 2,
    ...shadows.soft,
  },
  chatReportIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  chatReportTextCol: {
    flex: 1,
  },
  chatReportTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: '#065F46',
  },
  chatReportSubtitle: {
    fontSize: typography.fontSize.xs,
    color: '#047857',
    marginTop: 2,
  },
  chatEscalationCard: {
    marginVertical: 6,
    marginHorizontal: 2,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 16,
    padding: 14,
    ...shadows.card,
  },
  chatEscalationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.error,
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  chatEscalationBtnText: {
    color: '#FFFFFF',
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.xs,
  },

  // Gemini-Style Floating Pill Input Bar (Permanently Anchored & Full Width)
  chatInputPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    marginTop: 4,
    marginBottom: 4,
    marginHorizontal: 2,
    ...shadows.card,
  },
  chatTextInput: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    maxHeight: 90,
    paddingHorizontal: spacing.xs,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
  },
  chatInputButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
  },
  sendIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIconBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  micShortcutBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(10, 77, 82, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Escalation Preview Banner (Shared)
  escalationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  escalationTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.error,
  },
  escalationDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight.xs + 2,
    marginBottom: spacing.sm,
  },

  // Active Companion Compact Status Pill
  compactStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: spacing.sm,
  },
  compactStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  compactStatusDotListening: {
    backgroundColor: '#059669',
  },
  compactStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primaryDark,
  },

  // History Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  historyModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    ...shadows.elevated,
  },
  historyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  historyHeaderTitleCol: {
    flex: 1,
  },
  historyModalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  historyModalSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  historyLoadingBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  historyLoadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
  },
  historyEmptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  historyEmptyTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  historyEmptySubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  historyListScroll: {
    marginBottom: spacing.md,
  },
  historyItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyItemCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#F0FDF4',
  },
  historyItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyItemDate: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.medium,
  },
  historyStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeOpen: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  badgeResolved: {
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
  },
  historyStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  historyItemComplaint: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  historyItemFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  historyItemViewPrompt: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    fontWeight: typography.fontWeight.semiBold,
  },
});

export default VoiceAgentScreen;
