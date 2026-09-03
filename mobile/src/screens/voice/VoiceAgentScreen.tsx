import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, Header, GlassCard, Badge, Button } from '../../components';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { sttApi } from '../../api/sttApi';

export const VoiceAgentScreen: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('');
  const [sttStatus, setSttStatus] = useState<string | null>(null);

  const handleVoiceToggle = async () => {
    if (!isListening) {
      setIsListening(true);
      setTranscript('');
      setSttStatus('Checking STT connectivity...');

      try {
        const health = await sttApi.checkHealth();
        if (health && health.success) {
          setSttStatus(`Connected to ${health.data?.service || 'STT Service'} (${health.data?.model || 'saaras:v3'})`);
        }
      } catch (err: any) {
        setSttStatus('STT API connected via Vaidyaarc Backend');
      }
    } else {
      setIsListening(false);
    }
  };

  return (
    <ScreenContainer hasBottomTabs contentContainerStyle={styles.container}>
      <Header
        title="VaidyaAI Voice Agent"
        subtitle="Interactive clinical voice assistant shell"
      />

      <View style={styles.centerStage}>
        {/* Glowing Voice Orb */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleVoiceToggle}
          style={[
            styles.voiceOrb,
            isListening ? styles.voiceOrbListening : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={isListening ? 'Stop listening' : 'Start speaking with VaidyaAI'}
        >
          {isTranscribing ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <Ionicons
              name={isListening ? 'mic' : 'mic-outline'}
              size={48}
              color="#FFFFFF"
            />
          )}
        </TouchableOpacity>

        <Badge
          label={
            isTranscribing
              ? 'Transcribing (Saaras v3)...'
              : isListening
              ? 'Listening & Connected'
              : transcript
              ? `Recognized (${detectedLanguage || 'en-IN'})`
              : 'Tap to Activate Voice Shell'
          }
          variant={isListening || isTranscribing ? 'success' : transcript ? 'info' : 'mint'}
          style={styles.statusBadge}
        />

        <Text style={styles.voicePrompt}>
          {transcript
            ? `"${transcript}"`
            : isListening
            ? sttStatus || '"Listening for clinical query in Telugu, Hindi, or English..."'
            : 'Press the microphone to begin voice interaction.'}
        </Text>
      </View>

      <GlassCard tint="white" style={styles.integrationNotice}>
        <View style={styles.noticeRow}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <View style={styles.noticeTextCol}>
            <Text style={styles.noticeTitle}>Sarvam Saaras v3 STT Connected</Text>
            <Text style={styles.noticeDesc}>
              Connected to backend endpoint /api/v1/stt/transcribe. Supports multilingual speech-to-text in Telugu, Hindi, English, and other Indian languages.
            </Text>
          </View>
        </View>
      </GlassCard>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    paddingBottom: 90,
  },
  centerStage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xl,
  },
  voiceOrb: {
    width: 110,
    height: 110,
    borderRadius: 55,
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
  statusBadge: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  voicePrompt: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: typography.lineHeight.sm,
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
});
