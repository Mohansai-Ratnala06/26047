import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, Header, EmptyState, Card } from '../../components';
import { colors, spacing, typography } from '../../theme';

export const RecordsScreen: React.FC = () => {
  return (
    <ScreenContainer scrollable hasBottomTabs>
      <Header
        title="Health Records"
        subtitle="Unified medical timeline & diagnostic reports"
      />

      <EmptyState
        title="No Clinical Records Linked Yet"
        description="Prescriptions, laboratory tests, imaging reports, and hospital discharge summaries will populate here automatically upon clinical upload."
        icon={<Ionicons name="folder-open-outline" size={32} color={colors.primary} />}
        actionTitle="Refresh Records"
        onAction={() => {}}
      />

      <Card variant="subtle" style={styles.roadmapCard}>
        <Text style={styles.roadmapTitle}>Supported Record Types (Upcoming)</Text>
        <View style={styles.typeList}>
          <Text style={styles.typeItem}>• Doctor Prescriptions (e-Rx & scanned)</Text>
          <Text style={styles.typeItem}>• Pathology & Laboratory Reports (CBC, LFT, KFT)</Text>
          <Text style={styles.typeItem}>• Discharge Summaries & Inpatient Records</Text>
          <Text style={styles.typeItem}>• Longitudinal Medical Timeline</Text>
        </View>
      </Card>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  roadmapCard: {
    marginTop: spacing.md,
  },
  roadmapTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  typeList: {
    gap: spacing.xxs,
  },
  typeItem: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight.xs,
  },
});
