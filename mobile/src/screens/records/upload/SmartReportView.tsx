import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  LayoutAnimation,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../../theme';
import { useTranslation } from '../../../i18n';

export interface SmartReportData {
  patientName?: string;
  reportedDate?: string;
  clinicName?: string;
  healthDocumentType?: string;
  diagnoses?: string[];
  immunizations?: string[];
  procedures?: string[];
  medications?: Array<string | { name: string; dosage?: string | null; frequency?: string | null; duration?: string | null }>;
  investigations?: Array<string | { test_name: string; result: string; unit?: string | null; reference_range?: string | null }>;
  tests?: Array<{ test_name: string; result: string; unit?: string | null; reference_range?: string | null }>;
  vitals?: Array<{ parameter: string; value: string; unit?: string | null }>;
  advice?: string[];
  safetyAlerts?: Array<{ severity: string; type: string; message: string }>;
}

export interface SmartReportViewProps {
  data: SmartReportData;
  documentCode?: string;
  onViewOriginal?: () => void;
}

interface AccordionSectionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  count?: number;
  isOpenDefault?: boolean;
  children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  icon,
  count = 0,
  isOpenDefault = false,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(isOpenDefault);

  const toggleOpen = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsOpen(!isOpen);
  };

  return (
    <View style={styles.accordionContainer}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={toggleOpen}
        style={[styles.accordionHeader, isOpen && styles.accordionHeaderOpen]}
      >
        <View style={styles.accordionHeaderLeft}>
          <View style={styles.accordionIconWrap}>
            <Ionicons name={icon} size={18} color={colors.primary} />
          </View>
          <Text style={styles.accordionTitle}>{title}</Text>
          {count > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{count}</Text>
            </View>
          )}
        </View>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
      {isOpen && <View style={styles.accordionBody}>{children}</View>}
    </View>
  );
};

export const SmartReportView: React.FC<SmartReportViewProps> = ({
  data,
  documentCode,
  onViewOriginal,
}) => {
  const { t } = useTranslation();

  // Normalize medications
  const normalizedMeds = (data.medications || []).map((m) => {
    if (typeof m === 'string') return { name: m, dosage: null, frequency: null, duration: null };
    return m;
  });

  // Normalize tests
  const testsList = data.tests && data.tests.length > 0 ? data.tests : [];
  const investigationsList = (data.investigations || []).map((inv) => {
    if (typeof inv === 'string') return { test_name: inv, result: '', unit: '', reference_range: '' };
    return inv;
  });
  const allTests = testsList.length > 0 ? testsList : investigationsList;

  const diagnosesList = data.diagnoses || [];
  const immunizationsList = data.immunizations || [];
  const proceduresList = data.procedures || [];
  const vitalsList = data.vitals || [];
  const adviceList = data.advice || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      {/* 1. AI Clinical Disclaimer Banner */}
      <View style={styles.disclaimerBanner}>
        <Ionicons name="information-circle" size={20} color={colors.primary} style={styles.disclaimerIcon} />
        <Text style={styles.disclaimerText}>
          This data has been extracted using AI. Please refer to the original document for clinical purposes.
        </Text>
      </View>

      {/* 2. Patient Summary Card */}
      <View style={styles.patientSummaryCard}>
        <View style={styles.summaryCardHeader}>
          <Text style={styles.summaryCardHeaderTitle}>PATIENT & CLINICAL METADATA</Text>
          {documentCode && (
            <View style={styles.codeBadge}>
              <Text style={styles.codeBadgeText}>{documentCode}</Text>
            </View>
          )}
        </View>

        <View style={styles.summaryGrid}>
          {/* Row 1: Patient Name & Reported Date */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Patient Name</Text>
              <View style={styles.summaryValRow}>
                <Ionicons name="person-outline" size={15} color={colors.primary} />
                <Text style={styles.summaryValue} numberOfLines={1}>
                  {data.patientName || 'Not Specified'}
                </Text>
              </View>
            </View>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Reported Date</Text>
              <View style={styles.summaryValRow}>
                <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                <Text style={styles.summaryValue} numberOfLines={1}>
                  {data.reportedDate || 'Not Specified'}
                </Text>
              </View>
            </View>
          </View>

          {/* Row 2: Document Type & Clinic */}
          <View style={[styles.summaryRow, { marginTop: spacing.md }]}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Health Document Type</Text>
              <View style={styles.summaryValRow}>
                <Ionicons name="document-text-outline" size={15} color={colors.primary} />
                <Text style={styles.summaryValue} numberOfLines={1}>
                  {data.healthDocumentType || 'Prescription / Clinical Record'}
                </Text>
              </View>
            </View>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Clinic / Hospital</Text>
              <View style={styles.summaryValRow}>
                <Ionicons name="business-outline" size={15} color={colors.primary} />
                <Text style={styles.summaryValue} numberOfLines={1}>
                  {data.clinicName || 'Self Uploaded'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* 3. Safety Alerts (if any) */}
      {data.safetyAlerts && data.safetyAlerts.length > 0 && (
        <View style={styles.safetyAlertsContainer}>
          <View style={styles.safetyHeader}>
            <Ionicons name="warning" size={18} color="#B91C1C" />
            <Text style={styles.safetyHeaderText}>{t('smartReport.safetyAlerts')}</Text>
          </View>
          {data.safetyAlerts.map((alert, idx) => (
            <View key={idx} style={styles.safetyItem}>
              <Text style={styles.safetyItemText}>{alert.message}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 4. Expandable Accordions */}
      <View style={styles.accordionsWrapper}>
        {/* A. Diagnostics */}
        <AccordionSection
          title={t('smartReport.diagnoses')}
          icon="fitness-outline"
          count={diagnosesList.length}
          isOpenDefault={diagnosesList.length > 0}
        >
          {diagnosesList.length > 0 ? (
            diagnosesList.map((item, index) => (
              <View key={index} style={styles.bulletItem}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyAccordionText}>No specific diagnostic findings noted.</Text>
          )}
        </AccordionSection>

        {/* B. Immunization */}
        <AccordionSection
          title="Immunization"
          icon="shield-checkmark-outline"
          count={immunizationsList.length}
          isOpenDefault={immunizationsList.length > 0}
        >
          {immunizationsList.length > 0 ? (
            immunizationsList.map((item, index) => (
              <View key={index} style={styles.bulletItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={[styles.bulletText, { marginLeft: spacing.xs }]}>{item}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyAccordionText}>No immunization records in this document.</Text>
          )}
        </AccordionSection>

        {/* C. Procedures */}
        <AccordionSection
          title="Procedures"
          icon="medkit-outline"
          count={proceduresList.length}
          isOpenDefault={proceduresList.length > 0}
        >
          {proceduresList.length > 0 ? (
            proceduresList.map((item, index) => (
              <View key={index} style={styles.bulletItem}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyAccordionText}>No surgical or clinical procedures recorded.</Text>
          )}
        </AccordionSection>

        {/* D. Medications */}
        <AccordionSection
          title={t('smartReport.medications')}
          icon="bandage-outline"
          count={normalizedMeds.length}
          isOpenDefault={normalizedMeds.length > 0}
        >
          {normalizedMeds.length > 0 ? (
            normalizedMeds.map((med, index) => (
              <View key={index} style={styles.medCard}>
                <View style={styles.medHeader}>
                  <Ionicons name="ellipse" size={10} color={colors.primary} />
                  <Text style={styles.medName}>{med.name}</Text>
                </View>
                {(med.dosage || med.frequency || med.duration) && (
                  <View style={styles.medMetaRow}>
                    {med.dosage ? <Text style={styles.medPillBadge}>{med.dosage}</Text> : null}
                    {med.frequency ? <Text style={styles.medPillBadge}>{med.frequency}</Text> : null}
                    {med.duration ? <Text style={styles.medPillBadge}>{med.duration}</Text> : null}
                  </View>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.emptyAccordionText}>No prescribed medications found.</Text>
          )}
        </AccordionSection>

        {/* E. Diagnostic Investigations / Tests */}
        <AccordionSection
          title={t('smartReport.labTests')}
          icon="flask-outline"
          count={allTests.length}
          isOpenDefault={allTests.length > 0}
        >
          {allTests.length > 0 ? (
            allTests.map((t: any, index: number) => (
              <View key={index} style={styles.testRow}>
                <View style={styles.testNameCol}>
                  <Text style={styles.testNameText}>{t.test_name}</Text>
                  {t.reference_range ? (
                    <Text style={styles.testRefText}>Ref: {t.reference_range}</Text>
                  ) : null}
                </View>
                <View style={styles.testResultCol}>
                  <Text style={styles.testResultText}>
                    {t.result} {t.unit || ''}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyAccordionText}>No diagnostic investigations present.</Text>
          )}
        </AccordionSection>

        {/* F. Vitals */}
        {vitalsList.length > 0 && (
          <AccordionSection
            title={t('smartReport.vitals')}
            icon="pulse-outline"
            count={vitalsList.length}
            isOpenDefault={true}
          >
            <View style={styles.vitalsGrid}>
              {vitalsList.map((v, index) => (
                <View key={index} style={styles.vitalCard}>
                  <Text style={styles.vitalParamText}>{v.parameter}</Text>
                  <Text style={styles.vitalValText}>
                    {v.value} {v.unit || ''}
                  </Text>
                </View>
              ))}
            </View>
          </AccordionSection>
        )}

        {/* G. Advice / Recommendations */}
        <AccordionSection
          title={t('smartReport.doctorAdvice')}
          icon="clipboard-outline"
          count={adviceList.length}
          isOpenDefault={adviceList.length > 0}
        >
          {adviceList.length > 0 ? (
            adviceList.map((adv, index) => (
              <View key={index} style={styles.bulletItem}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
                <Text style={[styles.bulletText, { marginLeft: spacing.xs }]}>{adv}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyAccordionText}>No specific doctor advice recorded.</Text>
          )}
        </AccordionSection>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F4F1',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(10, 77, 82, 0.15)',
  },
  disclaimerIcon: {
    marginRight: spacing.xs,
  },
  disclaimerText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    flex: 1,
    lineHeight: 18,
    fontWeight: typography.fontWeight.medium,
  },
  patientSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.soft,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: spacing.sm,
  },
  summaryCardHeaderTitle: {
    fontSize: typography.fontSize.xs - 1,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  codeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  summaryGrid: {
    marginTop: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCol: {
    flex: 1,
    paddingRight: spacing.xs,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
    fontWeight: typography.fontWeight.medium,
  },
  summaryValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textPrimary,
    flex: 1,
  },
  safetyAlertsContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  safetyHeaderText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: '#B91C1C',
  },
  safetyItem: {
    marginTop: 2,
  },
  safetyItemText: {
    fontSize: typography.fontSize.xs,
    color: '#991B1B',
    lineHeight: 17,
  },
  accordionsWrapper: {
    gap: spacing.sm,
  },
  accordionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    backgroundColor: '#FFFFFF',
  },
  accordionHeaderOpen: {
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accordionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  accordionTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semiBold,
  },
  countBadge: {
    marginLeft: spacing.xs + 2,
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  accordionBody: {
    padding: spacing.md,
    backgroundColor: '#FFFFFF',
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs + 2,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 7,
    marginRight: spacing.sm,
  },
  bulletText: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  emptyAccordionText: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  medCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs + 2,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  medHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  medName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textPrimary,
  },
  medMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  medPillBadge: {
    fontSize: 11,
    backgroundColor: '#E6F4F1',
    color: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: typography.fontWeight.medium,
  },
  testRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  testNameCol: {
    flex: 2,
  },
  testNameText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textPrimary,
  },
  testRefText: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.textMuted,
    marginTop: 2,
  },
  testResultCol: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  testResultText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  vitalCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  vitalParamText: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.medium,
  },
  vitalValText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    marginTop: 2,
  },
});
