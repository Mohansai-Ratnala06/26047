import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { IconArrowLeft, IconCheck, IconAlertCircle } from '@tabler/icons-react-native';
import { QueueStackParamList } from '../../navigation/types';
import { colors, typography, spacing } from '../../theme';
import { SectionCard, CollapsedRow, Chip, SegmentedToggle } from '../../components/doctor';
import { ProfileSlider } from '../../components/doctor/ProfileSlider';

type Props = NativeStackScreenProps<QueueStackParamList, 'PatientSummary'>;

export const PatientSummary: React.FC<Props> = ({ navigation, route }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <IconArrowLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleGroup}>
            <View style={styles.nameRow}>
              <Text style={styles.patientName}>Ramesh Iyer</Text>
              <Chip label="priority" role="danger" />
            </View>
            <Text style={styles.subtitle}>Token 07 · 58 · male</Text>
          </View>
        </View>
        <SegmentedToggle options={['EN', 'HI']} activeIndex={0} onChange={() => {}} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.badgeRow}>
          <View style={styles.abhaBadge}>
            <IconCheck size={14} color={colors.successText} />
            <Text style={styles.abhaText}>ABHA verified</Text>
          </View>
        </View>

        <Text style={styles.draftNotice}>Draft summary — review each section before accepting</Text>

        <ProfileSlider />

        <SectionCard title="Chief complaint" onEditPress={() => {}}>
          <Text style={styles.bodyText}>Chest pain since this morning, associated with breathlessness</Text>
        </SectionCard>

        <SectionCard title="History of present illness" onEditPress={() => {}}>
          <View style={styles.tableRow}>
            <Text style={styles.tableKey}>Onset</Text>
            <Text style={styles.tableValue}>Sudden, 3 hours ago</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableKey}>Character</Text>
            <Text style={styles.tableValue}>Dull, pressure-like</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableKey}>Radiation</Text>
            <Text style={styles.tableValue}>Left arm</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableKey}>Aggravating</Text>
            <Text style={styles.tableValue}>Exertion</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableKey}>Relieving</Text>
            <Text style={styles.tableValue}>Rest</Text>
          </View>
        </SectionCard>

        <SectionCard title="Drug and allergy" onEditPress={() => {}}>
          <Text style={styles.bodyText}>Metformin 500mg BD, Atenolol 50mg OD</Text>
          <View style={styles.allergyChip}>
            <IconAlertCircle size={14} color={colors.warningText} />
            <Text style={styles.allergyText}>Allergy: penicillin — rash</Text>
          </View>
        </SectionCard>

        <SectionCard title="Prior investigations" onEditPress={() => {}}>
          <View style={[styles.investigationRow, styles.investigationDanger]}>
            <View>
              <Text style={styles.investigationTitleDanger}>Total cholesterol</Text>
              <Text style={styles.investigationRefDanger}>Ref: 125–200 mg/dL</Text>
            </View>
            <Text style={styles.investigationValueDanger}>265</Text>
          </View>
          <View style={styles.investigationRow}>
            <Text style={styles.investigationTitle}>ECG (12 Aug)</Text>
            <Text style={styles.investigationValue}>Sinus tachycardia</Text>
          </View>
        </SectionCard>

        <CollapsedRow title="Past medical and surgical" onPress={() => {}} />
        <CollapsedRow title="Family history" onPress={() => {}} />
        <CollapsedRow title="Personal history" onPress={() => {}} />
        <CollapsedRow title="Review of systems" onPress={() => {}} />

        <TouchableOpacity style={styles.primaryAction} activeOpacity={0.8}>
          <Text style={styles.primaryActionText}>Accept and push to HIS</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkAction} hitSlop={{ top: 10, bottom: 10 }}>
          <Text style={styles.linkActionText}>View original conversation</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  headerTitleGroup: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  patientName: {
    fontSize: 16,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  container: {
    padding: spacing.md,
    paddingBottom: 40,
  },
  badgeRow: {
    marginBottom: spacing.sm,
  },
  abhaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
    gap: 4,
  },
  abhaText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.medium,
    color: colors.successText,
  },
  draftNotice: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  bodyText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  tableRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  tableKey: {
    width: 100,
    fontSize: 13,
    color: colors.textSecondary,
  },
  tableValue: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
  },
  allergyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 12,
    gap: 4,
  },
  allergyText: {
    fontSize: 12,
    color: colors.warningText,
    fontWeight: typography.fontWeight.medium,
  },
  investigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  investigationDanger: {
    backgroundColor: colors.dangerBg,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: -8,
  },
  investigationTitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  investigationValue: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  investigationTitleDanger: {
    fontSize: 13,
    color: colors.dangerText,
    fontWeight: typography.fontWeight.medium,
  },
  investigationRefDanger: {
    fontSize: 11,
    color: colors.dangerText,
    opacity: 0.8,
  },
  investigationValueDanger: {
    fontSize: 14,
    fontWeight: typography.fontWeight.medium,
    color: colors.dangerText,
  },
  primaryAction: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  primaryActionText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: typography.fontWeight.medium,
  },
  linkAction: {
    alignItems: 'center',
  },
  linkActionText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: typography.fontWeight.medium,
  },
});
