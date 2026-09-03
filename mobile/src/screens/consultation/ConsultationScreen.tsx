import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, Header, EmptyState, Card } from '../../components';
import { colors, spacing, typography } from '../../theme';

export const ConsultationScreen: React.FC = () => {
  return (
    <ScreenContainer scrollable hasBottomTabs>
      <Header
        title="Consultations"
        subtitle="Telemedicine episodes & doctor reviews"
      />

      <EmptyState
        title="No Active Consultation"
        description="Connect with verified doctors, view AI clinical summaries, upload symptom records, and review follow-up outcomes."
        icon={<Ionicons name="videocam-outline" size={32} color={colors.primary} />}
        actionTitle="Schedule New Consultation"
        onAction={() => {}}
      />

      <Card variant="subtle" style={styles.moduleCard}>
        <Text style={styles.moduleTitle}>Consultation Capabilities (Upcoming)</Text>
        <View style={styles.moduleList}>
          <Text style={styles.moduleItem}>• AI-assisted Clinical Summary Generation</Text>
          <Text style={styles.moduleItem}>• Diagnostic Document Review & OCR</Text>
          <Text style={styles.moduleItem}>• Clinical Risk & Safety Triaging</Text>
          <Text style={styles.moduleItem}>• Secure Doctor Collaborative Follow-ups</Text>
        </View>
      </Card>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  moduleCard: {
    marginTop: spacing.md,
  },
  moduleTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  moduleList: {
    gap: spacing.xxs,
  },
  moduleItem: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight.xs,
  },
});
