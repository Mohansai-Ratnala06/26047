import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
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
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { sttApi } from '../../api/sttApi';
import { ttsApi } from '../../api/ttsApi';
import { conversationApi, TurnResponseData } from '../../api/conversationApi';
import { episodeApi } from '../../api/episodeApi';
import { RootStackParamList } from '../../navigation/types';

export const VoiceAgentScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Voice & STT state
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessingBrain, setIsProcessingBrain] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('en-IN');
  const [sttStatus, setSttStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clinical Brain conversation state
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [brainResponse, setBrainResponse] = useState<TurnResponseData | null>(null);

  // Native audio recorder hook from expo-audio (SDK 57)
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Native audio player hook from expo-audio (SDK 57) for TTS playback
  const audioPlayer = useAudioPlayer(null);
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const [lastAudioBase64, setLastAudioBase64] = useState<string | null>(null);
  const [isSynthesizingTts, setIsSynthesizingTts] = useState(false);

  // Play assistant spoken speech audio from Base64 via expo-audio
  const playSpokenAudio = async (base64Audio: string) => {
    try {
      setLastAudioBase64(base64Audio);
      const audioUri = `${FileSystem.cacheDirectory}vaidya_assistant_tts.wav`;
      await FileSystem.writeAsStringAsync(audioUri, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      audioPlayer.replace(audioUri);
      audioPlayer.play();
    } catch (playErr: any) {
      console.warn('[VoiceAgentScreen] Audio playback warning:', playErr?.message || playErr);
    }
  };

  // Replay or on-demand synthesize audio for the latest assistant message
  const handleReplaySpokenAudio = async () => {
    if (audioStatus.playing) {
      audioPlayer.pause();
      return;
    }

    if (lastAudioBase64) {
      await playSpokenAudio(lastAudioBase64);
    } else if (brainResponse?.assistantMessage?.content) {
      try {
        setIsSynthesizingTts(true);
        setSttStatus('Synthesizing speech via Sarvam Bulbul v3...');
        const ttsRes = await ttsApi.synthesizeSpeech(
          brainResponse.assistantMessage.content,
          detectedLanguage
        );
        if (ttsRes.success && ttsRes.data?.audioBase64) {
          await playSpokenAudio(ttsRes.data.audioBase64);
        }
      } catch (ttsErr: any) {
        console.warn('[VoiceAgentScreen] Manual TTS replay failed:', ttsErr?.message || ttsErr);
      } finally {
        setIsSynthesizingTts(false);
        setSttStatus(null);
      }
    }
  };

  // User-controlled session reset: starts a 100% clean intake
  const handleStartNewConsultation = () => {
    if (audioStatus.playing) {
      audioPlayer.pause();
    }
    setConversationId(null);
    setBrainResponse(null);
    setTranscript('');
    setLastAudioBase64(null);
    setErrorMessage(null);
    setSttStatus('New consultation ready. Press the microphone to describe symptoms.');
  };

  // Helper to obtain an open episode or create a new triage intake episode
  const getOrCreateActiveEpisode = async (): Promise<string> => {
    try {
      const res = await episodeApi.getEpisodes();
      const episodeList = res?.success && Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
      const openEpisode = episodeList.find((ep: any) => ep.status === 'open');
      if (openEpisode && openEpisode._id) {
        return openEpisode._id;
      }
    } catch (err) {
      console.warn('Could not fetch existing episodes:', err);
    }
    const createRes = await episodeApi.createEpisode({
      chiefComplaint: 'Voice Consultation / AI Triage Intake',
      type: 'symptom',
    });
    if (createRes?.success && createRes.data?._id) {
      return createRes.data._id;
    }
    throw new Error('Failed to create or link an active medical episode.');
  };

  // Initialize or verify conversation on mount
  useEffect(() => {
    let isMounted = true;
    const initConversation = async () => {
      try {
        const episodeId = await getOrCreateActiveEpisode();
        const res = await conversationApi.createConversation({
          episodeId,
          channel: 'voice',
          language: 'en',
        });
        if (isMounted && res.success && res.data?._id) {
          setConversationId(res.data._id);
        }
      } catch (err: any) {
        console.warn('Initial conversation setup note:', err.message);
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

  // Start recording audio
  const startRecording = async () => {
    if (audioStatus.playing) {
      audioPlayer.pause();
    }
    setErrorMessage(null);
    setTranscript('');
    setBrainResponse(null);

    try {
      // 1. Request microphone permission
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage('Microphone permission is required to record speech.');
        return;
      }

      // 2. Set audio mode for recording
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // 3. Prepare and start native audio recording
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      setIsListening(true);
      setSttStatus('Listening for clinical symptoms in Telugu, Hindi, or English...');
    } catch (micErr: any) {
      console.error('Recording initialization error:', micErr);
      setErrorMessage('Could not start microphone recording: ' + (micErr.message || micErr));
      setIsListening(false);
    }
  };

  // Stop recording and process STT → Brain pipeline
  const stopRecordingAndTranscribe = async () => {
    setIsListening(false);
    setIsTranscribing(true);
    setSttStatus('Transcribing speech via Sarvam Saaras v3...');

    try {
      // 1. Stop native recording and obtain real device audio file URI
      await audioRecorder.stop();
      const recordedUri = audioRecorder.uri;

      if (!recordedUri) {
        throw new Error('No audio recording found on device.');
      }

      // Format payload for existing sttApi.transcribeAudio
      const audioPayload = {
        uri: recordedUri,
        name: 'recording.m4a',
        type: 'audio/m4a',
      };

      // 2. Upstream STT call to Sarvam Saaras v3 proxy
      const sttRes = await sttApi.transcribeAudio(audioPayload, 'unknown');

      if (!sttRes.success || !sttRes.data?.text) {
        throw new Error(sttRes.message || 'No clear speech recognized. Please try speaking again.');
      }

      const recognizedText = sttRes.data.text;
      const recognizedLang = sttRes.data.language || 'en-IN';

      setTranscript(recognizedText);
      setDetectedLanguage(recognizedLang);
      setIsTranscribing(false);

      // 3. Dispatch transcript to VaidyaArc Clinical Brain pipeline
      await sendTranscriptToBrain(recognizedText, recognizedLang);
    } catch (err: any) {
      console.error('STT/Brain error:', err);
      setIsTranscribing(false);
      setIsProcessingBrain(false);
      setErrorMessage(err.message || 'Speech recognition failed. Please try again.');
    }
  };

  // Dispatch recognized transcript to Node message endpoint (which calls ClinicalBrainService)
  const sendTranscriptToBrain = async (text: string, language: string) => {
    setIsProcessingBrain(true);
    const isRegional = language && !language.toLowerCase().startsWith('en');
    setSttStatus(
      isRegional
        ? `NMT translating from ${language} & consulting Clinical Brain...`
        : 'Consulting VaidyaArc Clinical Intelligence Brain...'
    );

    try {
      // Ensure conversation exists
      let activeConvId = conversationId;
      if (!activeConvId) {
        const episodeId = await getOrCreateActiveEpisode();
        const convRes = await conversationApi.createConversation({
          episodeId,
          channel: 'voice',
          language: language || 'en',
        });
        if (convRes.success && convRes.data?._id) {
          activeConvId = convRes.data._id;
          setConversationId(activeConvId);
        } else {
          throw new Error('Could not establish an active clinical session.');
        }
      }

      // Invoke message endpoint (runs Inbound NMT -> Clinical Brain -> Outbound NMT)
      const messageRes = await conversationApi.sendMessage(activeConvId, {
        content: text,
        inputType: 'voice',
        language: language || 'en',
      });

      if (!messageRes.success || !messageRes.data) {
        throw new Error(messageRes.message || 'Clinical Brain processing failed.');
      }

      setBrainResponse(messageRes.data);
      setIsProcessingBrain(false);
      setSttStatus(null);

      // Auto-play spoken assistant response if audio was synthesized
      if (messageRes.data.audioBase64) {
        await playSpokenAudio(messageRes.data.audioBase64);
      }
    } catch (brainErr: any) {
      console.error('Brain dispatch error:', brainErr);
      setIsProcessingBrain(false);
      setErrorMessage(brainErr.message || 'Failed to receive clinical guidance from Brain.');
    }
  };

  const handleVoiceToggle = async () => {
    if (!isListening) {
      await startRecording();
    } else {
      await stopRecordingAndTranscribe();
    }
  };

  const isEmergency =
    brainResponse?.immediateAttentionRequired === true ||
    brainResponse?.turnStatus === 'emergency';

  return (
    <ScreenContainer scrollable hasBottomTabs contentContainerStyle={styles.container}>
      <Header
        title="VaidyaAI Voice Agent"
        subtitle="AI Clinical Intelligence & Triage Assistant"
        rightAction={
          <TouchableOpacity
            onPress={handleStartNewConsultation}
            style={styles.headerResetBtn}
            accessibilityLabel="Start New Medical Consultation"
          >
            <Ionicons name="refresh-circle-outline" size={26} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      {/* Center Voice Orb Stage */}
      <View style={styles.centerStage}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleVoiceToggle}
          style={[
            styles.voiceOrb,
            isListening ? styles.voiceOrbListening : null,
            isEmergency ? styles.voiceOrbEmergency : null,
            audioStatus.playing ? styles.voiceOrbSpeaking : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            audioStatus.playing
              ? 'VaidyaAI is speaking'
              : isListening
              ? 'Stop listening'
              : 'Start speaking with VaidyaAI'
          }
        >
          {isTranscribing || isProcessingBrain || isSynthesizingTts ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : audioStatus.playing ? (
            <Ionicons name="volume-high" size={44} color="#FFFFFF" />
          ) : (
            <Ionicons
              name={isListening ? 'stop' : 'mic'}
              size={44}
              color="#FFFFFF"
            />
          )}
        </TouchableOpacity>

        {/* Status Badge */}
        <Badge
          label={
            audioStatus.playing
              ? `Speaking (${detectedLanguage})...`
              : isProcessingBrain
              ? 'Evaluating Clinical Brain...'
              : isSynthesizingTts
              ? 'Synthesizing Voice (Bulbul v3)...'
              : isTranscribing
              ? 'Transcribing (Saaras v3)...'
              : isListening
              ? 'Listening (Tap to send)...'
              : isEmergency
              ? 'RED FLAG DETECTED'
              : transcript
              ? `Recognized (${detectedLanguage})`
              : 'Tap to Speak Symptoms'
          }
          variant={
            isEmergency
              ? 'error'
              : audioStatus.playing
              ? 'success'
              : isListening || isTranscribing || isProcessingBrain || isSynthesizingTts
              ? 'warning'
              : transcript
              ? 'success'
              : 'mint'
          }
          style={styles.statusBadge}
        />

        <Text style={styles.voicePrompt}>
          {audioStatus.playing
            ? 'VaidyaAI is speaking... Tap the microphone anytime to reply.'
            : isListening
            ? 'Speak your symptoms clearly in Telugu, Hindi, or English...'
            : isTranscribing || isProcessingBrain || isSynthesizingTts
            ? sttStatus
            : 'Press the microphone to describe symptoms, medications, or health queries.'}
        </Text>
      </View>

      {/* Error Alert Card */}
      {errorMessage ? (
        <Card variant="outlined" style={styles.errorCard}>
          <View style={styles.alertRow}>
            <Ionicons name="alert-circle" size={22} color={colors.error} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        </Card>
      ) : null}

      {/* Emergency High-Priority Red Flag Banner */}
      {isEmergency ? (
        <View style={styles.emergencyBanner}>
          <View style={styles.emergencyHeaderRow}>
            <Ionicons name="warning" size={24} color="#FFFFFF" />
            <Text style={styles.emergencyTitle}>EMERGENCY / RED FLAG ALERT</Text>
          </View>
          <Text style={styles.emergencySubtitle}>
            Immediate medical attention required. Please seek emergency care or consult a doctor immediately.
          </Text>
        </View>
      ) : null}

      {/* Patient Transcript Card */}
      {transcript ? (
        <Card variant="default" style={styles.transcriptCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconTagRow}>
              <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.cardHeaderLabel}>You Said (Transcribed)</Text>
            </View>
            <Badge label={detectedLanguage} variant="neutral" size="sm" />
          </View>
          <Text style={styles.transcriptText}>"{transcript}"</Text>
          {brainResponse?.patientMessage?.structuredData?.englishTranslation ? (
            <View style={styles.translationSubRow}>
              <Ionicons name="language-outline" size={14} color={colors.primary} />
              <Text style={styles.translationSubText}>
                Clinical English: "{brainResponse.patientMessage.structuredData.englishTranslation}"
              </Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* VaidyaArc Clinical Brain Response Card */}
      {brainResponse?.assistantMessage?.content ? (
        <GlassCard tint="mint" style={styles.brainResponseCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconTagRow}>
              <Ionicons name="medkit" size={18} color={colors.primaryDark} />
              <Text style={styles.brainHeaderLabel}>VaidyaArc Clinical Brain</Text>
            </View>
            <View style={styles.headerControlsRow}>
              <TouchableOpacity
                onPress={handleReplaySpokenAudio}
                style={styles.speakerBtn}
                accessibilityLabel={audioStatus.playing ? 'Pause voice' : 'Play voice'}
              >
                <Ionicons
                  name={audioStatus.playing ? 'volume-high' : 'volume-medium-outline'}
                  size={20}
                  color={colors.primaryDark}
                />
              </TouchableOpacity>
              <Badge
                label={
                  brainResponse.turnStatus === 'emergency'
                    ? 'Emergency'
                    : brainResponse.informationComplete
                    ? 'Triage Complete'
                    : 'In Progress'
                }
                variant={brainResponse.turnStatus === 'emergency' ? 'error' : 'mint'}
                size="sm"
              />
            </View>
          </View>

          <Text style={styles.brainMessageText}>
            {brainResponse.assistantMessage.content}
          </Text>

          {brainResponse.englishAssistantMessage &&
          brainResponse.englishAssistantMessage !== brainResponse.assistantMessage.content ? (
            <View style={styles.translationSubRow}>
              <Ionicons name="globe-outline" size={14} color={colors.primaryDark} />
              <Text style={styles.translationSubText}>
                Clinical English: "{brainResponse.englishAssistantMessage}"
              </Text>
            </View>
          ) : null}

          {/* Missing Clinical Information prompts */}
          {brainResponse.missingInformation && brainResponse.missingInformation.length > 0 ? (
            <View style={styles.missingInfoBox}>
              <Text style={styles.missingInfoTitle}>Key details that will help clarify your care:</Text>
              {brainResponse.missingInformation.map((info, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <Ionicons name="help-circle-outline" size={14} color={colors.primary} />
                  <Text style={styles.bulletText}>{info.replace(/_/g, ' ')}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Action button inside Brain card if clinical output is present */}
          {brainResponse.clinicalOutput ? (
            <View style={styles.cardActionRow}>
              <Button
                title="View Full Clinical Results & Doctor Questions"
                variant="primary"
                onPress={() =>
                  navigation.navigate('ClinicalResults', {
                    clinicalOutput: brainResponse.clinicalOutput!,
                    conversationId: conversationId || undefined,
                  })
                }
                style={styles.cardActionBtn}
              />
            </View>
          ) : null}
        </GlassCard>
      ) : null}

      {/* Completed Clinical Assessment Card (Prominent standalone section when complete) */}
      {brainResponse?.clinicalOutput ? (
        <Card variant="mintWash" style={styles.completedResultsCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconTagRow}>
              <Ionicons name="clipboard-outline" size={20} color={colors.primary} />
              <Text style={styles.completedCardTitle}>Clinical Assessment Summary</Text>
            </View>
            <Badge
              label={brainResponse.turnStatus === 'emergency' ? 'Urgent Review' : 'Triage Complete'}
              variant={brainResponse.turnStatus === 'emergency' ? 'error' : 'success'}
              size="sm"
            />
          </View>
          <Text style={styles.completedCardDesc}>
            Your structured clinical intake and risk convergence evaluation is complete. View your narrative summary, risk scores, care pathway, and questions prepared for your doctor.
          </Text>
          <View style={styles.completedActionsRow}>
            <Button
              title="Open Clinical Assessment Report"
              variant="secondary"
              onPress={() =>
                navigation.navigate('ClinicalResults', {
                  clinicalOutput: brainResponse.clinicalOutput!,
                  conversationId: conversationId || undefined,
                })
              }
              style={styles.viewResultsBtn}
            />
            <Button
              title="Start New Consultation"
              variant="outline"
              onPress={handleStartNewConsultation}
              style={styles.newConsultationBtn}
            />
          </View>
        </Card>
      ) : null}

      {/* Integration Technical Metadata Notice */}
      <GlassCard tint="white" style={styles.integrationNotice}>
        <View style={styles.noticeRow}>
          <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
          <View style={styles.noticeTextCol}>
            <Text style={styles.noticeTitle}>Sarvam Saaras v3 + In-Process NMT + VaidyaArc Brain</Text>
            <Text style={styles.noticeDesc}>
              Speech transcribed via Saaras v3, translated to clinical English for AI reasoning, and translated back to your native language.
            </Text>
          </View>
        </View>
      </GlassCard>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 100,
  },
  centerStage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  voiceOrb: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.mintWash,
    ...shadows.voiceOrb,
  },
  voiceOrbListening: {
    backgroundColor: colors.mintAccent,
    borderColor: colors.mintWash,
  },
  voiceOrbEmergency: {
    backgroundColor: colors.error,
    borderColor: colors.errorLight,
  },
  voiceOrbSpeaking: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.mintAccent,
    ...shadows.elevated,
  },
  statusBadge: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  voicePrompt: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: typography.lineHeight.xs,
  },
  errorCard: {
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
    marginBottom: spacing.md,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    color: colors.dangerText,
    flex: 1,
  },
  emergencyBanner: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.elevated,
  },
  emergencyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  emergencyTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  emergencySubtitle: {
    fontSize: typography.fontSize.xs,
    color: '#FFFFFF',
    lineHeight: typography.lineHeight.xs,
    opacity: 0.95,
  },
  transcriptCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  iconTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardHeaderLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
  },
  transcriptText: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    lineHeight: typography.lineHeight.sm,
    fontStyle: 'italic',
  },
  brainResponseCard: {
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(10, 77, 82, 0.2)',
  },
  brainHeaderLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  brainMessageText: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    lineHeight: typography.lineHeight.sm + 2,
    marginTop: spacing.xs,
  },
  missingInfoBox: {
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(10, 77, 82, 0.1)',
  },
  missingInfoTitle: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 2,
  },
  bulletText: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  integrationNotice: {
    marginBottom: spacing.md,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  noticeTextCol: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  noticeDesc: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: typography.lineHeight.xs,
  },
  cardActionRow: {
    marginTop: spacing.md,
    paddingTop: spacing.xs,
  },
  cardActionBtn: {
    marginTop: spacing.xs,
  },
  completedResultsCard: {
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
  },
  completedCardTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  completedCardDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight.xs + 2,
    marginVertical: spacing.xs,
  },
  viewResultsBtn: {
    marginTop: spacing.xs,
  },
  translationSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(10, 77, 82, 0.08)',
  },
  translationSubText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },
  headerResetBtn: {
    padding: spacing.xs,
  },
  headerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  speakerBtn: {
    padding: 6,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(10, 77, 82, 0.1)',
  },
  completedActionsRow: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  newConsultationBtn: {
    marginTop: 4,
  },
});
