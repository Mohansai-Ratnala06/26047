import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, Header, GlassCard, Badge, Button } from '../../components';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';

export const VoiceAgentScreen: React.FC = () => {
  const [isListening, setIsListening] = useState(false);

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
          onPress={() => setIsListening(!isListening)}
          style={[
            styles.voiceOrb,
            isListening ? styles.voiceOrbListening : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={isListening ? 'Stop listening' : 'Start speaking with VaidyaAI'}
        >
          <Ionicons
            name={isListening ? 'mic' : 'mic-outline'}
            size={48}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <Badge
          label={isListening ? 'Listening (Simulated UI)...' : 'Tap to Activate Voice Shell'}
          variant={isListening ? 'success' : 'mint'}
          style={styles.statusBadge}
        />

        <Text style={styles.voicePrompt}>
          {isListening
            ? '"How can I help you navigate your care pathway today?"'
            : 'Press the microphone to begin voice interaction.'}
        </Text>
      </View>

      <GlassCard tint="white" style={styles.integrationNotice}>
        <View style={styles.noticeRow}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <View style={styles.noticeTextCol}>
            <Text style={styles.noticeTitle}>ConversationService Boundary</Text>
            <Text style={styles.noticeDesc}>
              This screen is a foundational UI shell. Multimodal voice transcription, LLM reasoning, and audio playback integrate here in future phases.
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
