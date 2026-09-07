import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, Header, GlassCard, Card, Badge, Button } from '../../components';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { RootStackParamList } from '../../navigation/types';

type ClinicalResultsRouteProp = RouteProp<RootStackParamList, 'ClinicalResults'>;

export const ClinicalResultsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ClinicalResultsRouteProp>();
  const clinicalOutput = route.params?.clinicalOutput || {};

  const [activeTab, setActiveTab] = useState<'summary' | 'questions' | 'pathway' | 'remedies' | 'dashavidha'>('summary');

  // Extract structured fields from clinicalOutput
  const safetyFindings = clinicalOutput.safety_findings || {};
  const isEmergency = Boolean(safetyFindings.immediate_attention_required);
  const redFlags: string[] = safetyFindings.red_flags || [];

  const riskAssessment = clinicalOutput.risk_assessment || {};
  const riskLevel: string = (riskAssessment.risk_level || 'LOW').toUpperCase();
  const riskScore: number | null = typeof riskAssessment.risk_score === 'number' ? riskAssessment.risk_score : null;
  const riskSignals: string[] = riskAssessment.risk_signals || [];

  const careNav = clinicalOutput.care_navigation || {};
  const carePathway: string = careNav.care_pathway || clinicalOutput.clinical_case?.care_pathway_status || 'Routine Consultation';
  const matchedFacilities: any[] = careNav.matched_facilities || [];

  const clinicalSummary = clinicalOutput.clinical_summary || {};
  const narrative: string = clinicalSummary.summary_narrative || '';
  const completeness: string = clinicalSummary.data_completeness || 'complete';
  const conflicts: string[] = clinicalSummary.conflicts_identified || [];

  const consultationQuestionsObj = clinicalOutput.consultation_questions || {};
  const questions: any[] = consultationQuestionsObj.questions || [];

  // Phase 8B Ayurveda Recommendations
  const ayurRec = clinicalOutput.ayurveda_recommendation || {};
  const recommendations: any[] = ayurRec.recommendations || [];
  const recDecision: string = ayurRec.decision || 'not_eligible';
  const recSummary: string = ayurRec.summary || '';
  const blockedReasons: string[] = ayurRec.blocked_reasons || [];

  // Phase 12 Dashavidha Atura Pariksha
  const dashavidhaRoot = clinicalOutput.dashavidha_atura_pariksha || {};
  const dashavidhaProfile = dashavidhaRoot.dashavidha_atura_pariksha || dashavidhaRoot;

  const DASHAVIDHA_PARAMETERS = [
    { key: 'prakriti', label: 'Prakriti', sanskrit: 'प्रकृति', desc: 'Constitutional Examination' },
    { key: 'vikriti', label: 'Vikriti', sanskrit: 'विकृति', desc: 'Pathological Morbidity / Observations' },
    { key: 'sara', label: 'Sara', sanskrit: 'सार', desc: 'Tissue Quality / Excellence' },
    { key: 'samhanana', label: 'Samhanana', sanskrit: 'संहनन', desc: 'Body Compactness / Symmetry' },
    { key: 'pramana', label: 'Pramana', sanskrit: 'प्रमाण', desc: 'Anthropometric Proportions' },
    { key: 'satmya', label: 'Satmya', sanskrit: 'सात्म्य', desc: 'Habituation / Adaptability' },
    { key: 'sattva', label: 'Sattva', sanskrit: 'सत्त्व', desc: 'Mental Strength / Resilience' },
    { key: 'ahara_shakti', label: 'Ahara Shakti', sanskrit: 'आहारशक्ति', desc: 'Digestive & Ingestion Power' },
    { key: 'vyayama_shakti', label: 'Vyayama Shakti', sanskrit: 'व्यायामशक्ति', desc: 'Physical Work Capacity' },
    { key: 'vaya', label: 'Vaya', sanskrit: 'वय', desc: 'Age / Chronological Stage' },
  ];

  const getEpistemicBadgeVariant = (status?: string): 'mint' | 'neutral' | 'info' => {
    switch (status) {
      case 'explicitly_reported':
        return 'mint';
      case 'structurally_extracted':
        return 'info';
      case 'not_assessed':
      default:
        return 'neutral';
    }
  };

  const formatEpistemicStatus = (status?: string): string => {
    switch (status) {
      case 'explicitly_reported':
        return 'Explicitly Reported';
      case 'structurally_extracted':
        return 'Structurally Extracted';
      case 'not_assessed':
      default:
        return 'Not Assessed';
    }
  };

  // Share summary as text
  const handleShare = async () => {
    try {
      const shareContent = [
        'VAIDYAARC CLINICAL ASSESSMENT SUMMARY',
        '----------------------------------------',
        `Risk Level: ${riskLevel} ${riskScore !== null ? `(${riskScore}/100)` : ''}`,
        `Care Pathway: ${formatPathway(carePathway)}`,
        '',
        narrative || 'Summary not available.',
        '',
        'CONSULTATION QUESTIONS FOR PHYSICIAN:',
        ...questions.map((q: any, i: number) => `${i + 1}. [${q.priority || 'standard'}] ${q.question}`),
        '',
        ...(recommendations.length > 0
          ? [
              'SUPPORTIVE AYURVEDIC HOME CARE (CCRAS/API):',
              ...recommendations.map(
                (r: any) =>
                  `• ${r.name || r.remedy_name || r.classical_name || 'Home Remedy'}: ${r.preparation_summary || r.preparation_instructions || r.context || ''} (Source: ${
                    r.provenance?.document_title || 'CCRAS'
                  })`
              ),
              '',
            ]
          : []),
        'Disclaimer: Decision-support assessment only. Not a medical diagnosis.',
      ].join('\n');

      await Share.share({
        message: shareContent,
        title: 'VaidyaArc Clinical Summary',
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const formatPathway = (pathway: string) => {
    return pathway
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case 'URGENT':
      case 'HIGH':
        return 'error';
      case 'MODERATE':
        return 'warning';
      case 'LOW':
      case 'ROUTINE':
      default:
        return 'success';
    }
  };

  return (
    <ScreenContainer scrollable contentContainerStyle={styles.container}>
      <Header
        title="Clinical Assessment"
        subtitle="Physician-Ready Triage & Consultation Summary"
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn} accessibilityLabel="Share summary">
            <Ionicons name="share-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      {/* 1. Emergency Banner (Highest Priority) */}
      {isEmergency ? (
        <View style={styles.emergencyCard}>
          <View style={styles.emergencyHeaderRow}>
            <Ionicons name="warning" size={24} color="#FFFFFF" />
            <Text style={styles.emergencyTitle}>EMERGENCY / RED FLAG ALERT</Text>
          </View>
          <Text style={styles.emergencyBody}>
            Clinical red flags or high-risk indicators were detected. Please seek immediate emergency medical care.
          </Text>
          {redFlags.length > 0 ? (
            <View style={styles.flagList}>
              {redFlags.map((flag, idx) => (
                <Text key={idx} style={styles.flagItem}>• {flag}</Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 2. Triage & Risk Level Overview Banner */}
      <GlassCard tint="mint" style={styles.triageBanner}>
        <View style={styles.triageHeader}>
          <View>
            <Text style={styles.triageLabel}>Triage Risk Classification</Text>
            <Text style={styles.triageSubLabel}>Authoritative Decision-Support Assessment</Text>
          </View>
          <Badge
            label={riskLevel}
            variant={getRiskBadgeVariant(riskLevel)}
            size="md"
          />
        </View>

        <View style={styles.triageDetailsRow}>
          {riskScore !== null ? (
            <View style={styles.metricBox}>
              <Text style={styles.metricVal}>{riskScore}<Text style={styles.metricMax}>/100</Text></Text>
              <Text style={styles.metricLabel}>Risk Score</Text>
            </View>
          ) : null}

          <View style={styles.pathwayBox}>
            <Text style={styles.pathwayVal}>{formatPathway(carePathway)}</Text>
            <Text style={styles.metricLabel}>Recommended Pathway</Text>
          </View>
        </View>

        {riskSignals.length > 0 ? (
          <View style={styles.signalsBox}>
            <Text style={styles.signalsTitle}>Identified Risk Signals:</Text>
            {riskSignals.map((sig, idx) => (
              <Text key={idx} style={styles.signalText}>• {sig}</Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.nonDiagDisclaimer}>
          Assessment output for clinical guidance only — not a medical diagnosis.
        </Text>
      </GlassCard>

      {/* 3. Segmented Section Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'summary' && styles.tabBtnActive]}
            onPress={() => setActiveTab('summary')}
          >
            <Text style={[styles.tabText, activeTab === 'summary' && styles.tabTextActive]}>Summary</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'questions' && styles.tabBtnActive]}
            onPress={() => setActiveTab('questions')}
          >
            <Text style={[styles.tabText, activeTab === 'questions' && styles.tabTextActive]}>
              Questions ({questions.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'pathway' && styles.tabBtnActive]}
            onPress={() => setActiveTab('pathway')}
          >
            <Text style={[styles.tabText, activeTab === 'pathway' && styles.tabTextActive]}>Care Pathway</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'remedies' && styles.tabBtnActive]}
            onPress={() => setActiveTab('remedies')}
          >
            <Text style={[styles.tabText, activeTab === 'remedies' && styles.tabTextActive]}>
              Home Care {recommendations.length > 0 ? `(${recommendations.length})` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'dashavidha' && styles.tabBtnActive]}
            onPress={() => setActiveTab('dashavidha')}
          >
            <Text style={[styles.tabText, activeTab === 'dashavidha' && styles.tabTextActive]}>
              Daśavidha
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* TAB 1: CLINICAL SUMMARY NARRATIVE */}
      {activeTab === 'summary' ? (
        <View style={styles.tabContent}>
          <Card variant="default" style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconTagRow}>
                <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                <Text style={styles.cardSectionTitle}>Physician-Ready Narrative</Text>
              </View>
              <Badge
                label={`Completeness: ${completeness}`}
                variant={completeness === 'complete' ? 'success' : 'neutral'}
                size="sm"
              />
            </View>

            <Text style={styles.narrativeText}>
              {narrative || 'Structured narrative summary not generated.'}
            </Text>

            {conflicts.length > 0 ? (
              <View style={styles.conflictsBox}>
                <View style={styles.conflictsHeader}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
                  <Text style={styles.conflictsTitle}>Documented Discrepancies Requiring Clarification:</Text>
                </View>
                {conflicts.map((conf, idx) => (
                  <Text key={idx} style={styles.conflictText}>- {conf}</Text>
                ))}
              </View>
            ) : null}
          </Card>
        </View>
      ) : null}

      {/* TAB 2: CONSULTATION QUESTIONS */}
      {activeTab === 'questions' ? (
        <View style={styles.tabContent}>
          <Card variant="subtle" style={styles.questionsIntroCard}>
            <View style={styles.iconTagRow}>
              <Ionicons name="chatbubbles-outline" size={18} color={colors.primary} />
              <Text style={styles.questionsIntroTitle}>Questions for Your Doctor</Text>
            </View>
            <Text style={styles.questionsIntroDesc}>
              These tailored clinical questions were synthesized from your reported symptoms to help you lead an informed discussion with your healthcare provider.
            </Text>
          </Card>

          {questions.length === 0 ? (
            <Card variant="outlined" style={styles.emptyCard}>
              <Text style={styles.emptyText}>No consultation questions generated for this session.</Text>
            </Card>
          ) : (
            questions.map((q: any, idx: number) => (
              <Card key={q.question_id || idx} variant="default" style={styles.questionCard}>
                <View style={styles.questionHeader}>
                  <Badge
                    label={`Priority: ${(q.priority || 'standard').toUpperCase()}`}
                    variant={q.priority === 'high' ? 'error' : q.priority === 'medium' ? 'warning' : 'neutral'}
                    size="sm"
                  />
                  {q.category ? (
                    <Badge
                      label={q.category.replace(/_/g, ' ')}
                      variant="mint"
                      size="sm"
                    />
                  ) : null}
                </View>

                <Text style={styles.questionText}>"{q.question}"</Text>

                {q.rationale ? (
                  <View style={styles.rationaleRow}>
                    <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.rationaleText}>{q.rationale}</Text>
                  </View>
                ) : null}
              </Card>
            ))
          )}
        </View>
      ) : null}

      {/* TAB 3: CARE PATHWAY & FACILITIES */}
      {activeTab === 'pathway' ? (
        <View style={styles.tabContent}>
          <Card variant="default" style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconTagRow}>
                <Ionicons name="navigate-outline" size={18} color={colors.primary} />
                <Text style={styles.cardSectionTitle}>Recommended Care Pathway</Text>
              </View>
              <Badge label={formatPathway(carePathway)} variant="mint" size="sm" />
            </View>

            <Text style={styles.pathwayDesc}>
              {careNav.navigation_explanation ||
                `Based on clinical intake and risk stratification, an ${formatPathway(carePathway)} evaluation is recommended.`}
            </Text>
          </Card>

          {matchedFacilities.length > 0 ? (
            <View style={styles.facilitySection}>
              <Text style={styles.subSectionTitle}>Matched Healthcare Facilities</Text>
              {matchedFacilities.map((facMatch: any, idx: number) => {
                const fac = facMatch.facility || {};
                return (
                  <Card key={idx} variant="outlined" style={styles.facilityCard}>
                    <View style={styles.facilityHeader}>
                      <Text style={styles.facilityName}>{fac.facility_name || 'Healthcare Facility'}</Text>
                      <Badge
                        label={`Match: ${facMatch.match_tier || 'Tier 1'}`}
                        variant="success"
                        size="sm"
                      />
                    </View>
                    <Text style={styles.facilityType}>{fac.facility_type || 'Hospital / Clinic'}</Text>
                    {fac.city ? (
                      <Text style={styles.facilityCity}>Location: {fac.city}</Text>
                    ) : null}
                    {facMatch.match_summary ? (
                      <Text style={styles.facilitySummary}>{facMatch.match_summary}</Text>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          ) : (
            <Card variant="outlined" style={styles.emptyCard}>
              <Text style={styles.emptyText}>No specific facility matches requested or available for this encounter.</Text>
            </Card>
          )}
        </View>
      ) : null}

      {/* TAB 4: AYURVEDA SUPPORTIVE HOME CARE (CCRAS / API-II) */}
      {activeTab === 'remedies' ? (
        <View style={styles.tabContent}>
          {/* Mandatory Non-Prescriptive Supportive Care Disclaimer */}
          <Card variant="mintWash" style={styles.remedyDisclaimerCard}>
            <View style={styles.iconTagRow}>
              <Ionicons name="shield-checkmark" size={18} color={colors.primaryDark} />
              <Text style={styles.remedyDisclaimerTitle}>Approved Supportive Home Care</Text>
            </View>
            <Text style={styles.remedyDisclaimerText}>
              Traditional supportive-care reference from the approved VaidyaArc source dataset. Not a medical prescription. Follow clinician advice, especially for persistent, worsening, or severe symptoms.
            </Text>
          </Card>

          {recommendations.length > 0 ? (
            recommendations.map((rec: any, idx: number) => {
              const prov = rec.provenance || {};
              return (
                <Card key={rec.recommendation_id || idx} variant="default" style={styles.remedyCard}>
                  <View style={styles.remedyHeader}>
                    <View style={styles.remedyTitleCol}>
                      <Text style={styles.remedyName}>
                        {rec.name || rec.remedy_name || rec.classical_name || 'Ayurvedic Home Remedy'}
                      </Text>
                      {rec.classical_name && rec.classical_name !== (rec.name || rec.remedy_name) ? (
                        <Text style={styles.remedyClassical}>Classical name: {rec.classical_name}</Text>
                      ) : null}
                    </View>
                    <Badge
                      label={rec.remedy_type ? rec.remedy_type.replace(/_/g, ' ') : 'Home Care'}
                      variant="mint"
                      size="sm"
                    />
                  </View>

                  {rec.matching_symptom || rec.indication_matched || rec.context ? (
                    <View style={styles.remedyFieldRow}>
                      <Text style={styles.remedyFieldLabel}>Matched Indication:</Text>
                      <Text style={styles.remedyFieldVal}>{rec.matching_symptom || rec.indication_matched || rec.context}</Text>
                    </View>
                  ) : null}

                  {rec.preparation_summary || rec.preparation_instructions ? (
                    <View style={styles.remedySectionBox}>
                      <Text style={styles.remedySubHeading}>Traditional Preparation & Use:</Text>
                      <Text style={styles.remedyBodyText}>{rec.preparation_summary || rec.preparation_instructions}</Text>
                    </View>
                  ) : null}

                  {rec.source_dosage_reference ? (
                    <View style={styles.remedySectionBox}>
                      <Text style={styles.remedySubHeading}>Source Reference Dosage:</Text>
                      <Text style={styles.remedyBodyText}>{rec.source_dosage_reference}</Text>
                    </View>
                  ) : null}

                  {(rec.safety_notes && rec.safety_notes.length > 0) || (rec.safety_precautions && rec.safety_precautions.length > 0) ? (
                    <View style={styles.remedyWarningBox}>
                      <Text style={styles.remedyWarningTitle}>Precautions & Limitations:</Text>
                      {(rec.safety_notes || rec.safety_precautions).map((p: string, pIdx: number) => (
                        <Text key={pIdx} style={styles.remedyWarningItem}>• {p}</Text>
                      ))}
                    </View>
                  ) : null}

                  {prov.document_title ? (
                    <View style={styles.provenanceRow}>
                      <Ionicons name="book-outline" size={13} color={colors.textSecondary} />
                      <Text style={styles.provenanceText}>
                        Source: {prov.document_title}
                        {prov.page ? `, Page ${prov.page}` : ''}
                        {prov.publisher ? ` (${prov.publisher})` : ''}
                      </Text>
                    </View>
                  ) : null}
                </Card>
              );
            })
          ) : (
            <Card variant="outlined" style={styles.emptyCard}>
              <Ionicons name="shield-checkmark-outline" size={32} color={colors.primary} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyTitle}>No Eligible Ayurveda Recommendation Identified</Text>
              <Text style={styles.emptyText}>
                {recSummary ||
                  (blockedReasons.length > 0
                    ? blockedReasons.join(' ')
                    : 'No matching indication in approved reference documents, or clinical safety criteria recommend physician evaluation without self-administered remedies.')}
              </Text>
            </Card>
          )}
        </View>
      ) : null}

      {/* TAB 5: AYURVEDIC DASHAVIDHA ATURA PARIKSHA */}
      {activeTab === 'dashavidha' ? (
        <View style={styles.tabContent}>
          <Card variant="default" style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconTagRow}>
                <Ionicons name="leaf-outline" size={18} color={colors.primary} />
                <Text style={styles.cardSectionTitle}>Daśavidha Ātura Parīkṣā</Text>
              </View>
              <Badge label="Charaka Vimāna 8/94" variant="mint" size="sm" />
            </View>

            <Text style={styles.ayurNotice}>
              Classical 10-parameter Ayurvedic clinical examination framework. Individual parameters without direct clinical observations remain explicitly not assessed.
            </Text>

            <View style={styles.dashavidhaList}>
              {DASHAVIDHA_PARAMETERS.map((param) => {
                const record = dashavidhaProfile?.[param.key];
                const status = record?.status || 'not_assessed';
                const observations: string[] = record?.reported_observations || [];
                const limitations: string[] = record?.clinical_limitations || [];
                const note: string = record?.assessment_note || '';
                const structFindings = record?.structured_findings;

                return (
                  <Card key={param.key} variant="subtle" style={styles.dashavidhaCard}>
                    <View style={styles.paramHeader}>
                      <View style={styles.paramTitleRow}>
                        <Text style={styles.paramName}>{param.label}</Text>
                        <Text style={styles.paramSanskrit}>({param.sanskrit})</Text>
                      </View>
                      <Badge
                        label={formatEpistemicStatus(status)}
                        variant={getEpistemicBadgeVariant(status)}
                        size="sm"
                      />
                    </View>
                    <Text style={styles.paramDesc}>{param.desc}</Text>

                    {/* Structured Findings (e.g. classical life stage, modern vitals, dietary habits) */}
                    {param.key === 'vaya' && structFindings?.classical_life_stage ? (
                      <View style={styles.structuredBox}>
                        <Text style={styles.structuredLabel}>Classical Life Stage (Charaka Vimāna 8/122):</Text>
                        <Text style={styles.structuredVal}>{structFindings.classical_life_stage}</Text>
                      </View>
                    ) : null}

                    {param.key === 'pramana' && structFindings?.modern_measurements ? (
                      <View style={styles.structuredBox}>
                        <Text style={styles.structuredLabel}>Modern Clinical Measurements (Objective Data):</Text>
                        {Object.entries(structFindings.modern_measurements).map(([k, v]) => (
                          <Text key={k} style={styles.structuredItem}>• {k.toUpperCase()}: {String(v)}</Text>
                        ))}
                      </View>
                    ) : null}

                    {param.key === 'satmya' && structFindings ? (
                      <>
                        {structFindings.dietary_habits ? (
                          <View style={styles.structuredBox}>
                            <Text style={styles.structuredLabel}>Reported Dietary Habits:</Text>
                            <Text style={styles.structuredVal}>{structFindings.dietary_habits}</Text>
                          </View>
                        ) : null}
                        {structFindings.reported_allergies && Array.isArray(structFindings.reported_allergies) ? (
                          <View style={styles.structuredBox}>
                            <Text style={styles.structuredLabel}>Reported Allergies/Intolerances:</Text>
                            <Text style={styles.structuredVal}>{structFindings.reported_allergies.join(', ')}</Text>
                          </View>
                        ) : null}
                      </>
                    ) : null}

                    {/* Descriptive Observations */}
                    {observations.length > 0 ? (
                      <View style={styles.obsBox}>
                        <Text style={styles.obsHeading}>Descriptive Clinical Observations (Non-Diagnostic):</Text>
                        {observations.map((obs, oIdx) => (
                          <Text key={oIdx} style={styles.obsItem}>• {obs}</Text>
                        ))}
                      </View>
                    ) : null}

                    {/* Assessment Note */}
                    {note ? (
                      <Text style={status === 'not_assessed' ? styles.notAssessedText : styles.paramNote}>
                        {note}
                      </Text>
                    ) : status === 'not_assessed' && observations.length === 0 ? (
                      <Text style={styles.notAssessedText}>
                        Not assessed. Requires in-person clinical assessment by a qualified Ayurvedic physician.
                      </Text>
                    ) : null}

                    {/* Limitations & Clinical Boundaries */}
                    {limitations.length > 0 ? (
                      <View style={styles.limitationsBox}>
                        {limitations.map((lim, lIdx) => (
                          <Text key={lIdx} style={styles.limitationText}>⚠️ {lim}</Text>
                        ))}
                      </View>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          </Card>
        </View>
      ) : null}

      {/* Action to return */}
      <View style={styles.bottomActions}>
        <Button
          title="Done / Return to Voice Assistant"
          variant="primary"
          onPress={() => navigation.goBack()}
          style={styles.bottomBtn}
        />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  shareBtn: {
    padding: spacing.xs,
  },
  emergencyCard: {
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
  emergencyBody: {
    fontSize: typography.fontSize.xs,
    color: '#FFFFFF',
    lineHeight: typography.lineHeight.xs,
    opacity: 0.95,
  },
  flagList: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  flagItem: {
    fontSize: typography.fontSize.xs,
    color: '#FFFFFF',
    fontWeight: typography.fontWeight.semiBold,
  },
  triageBanner: {
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(10, 77, 82, 0.15)',
  },
  triageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  triageLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  triageSubLabel: {
    fontSize: typography.fontSize.xs - 2,
    color: colors.textSecondary,
    marginTop: 2,
  },
  triageDetailsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(10, 77, 82, 0.1)',
  },
  metricBox: {
    flex: 1,
  },
  metricVal: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  metricMax: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.regular,
  },
  metricLabel: {
    fontSize: typography.fontSize.xs - 2,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pathwayBox: {
    flex: 2,
  },
  pathwayVal: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primary,
  },
  signalsBox: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(10, 77, 82, 0.08)',
  },
  signalsTitle: {
    fontSize: typography.fontSize.xs - 1,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  signalText: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.textPrimary,
  },
  nonDiagDisclaimer: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  tabScroll: {
    marginBottom: spacing.md,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.sm,
    padding: 3,
  },
  tabBtn: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    alignItems: 'center',
    borderRadius: borderRadius.sm - 2,
  },
  tabBtnActive: {
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  tabText: {
    fontSize: typography.fontSize.xs - 1,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  tabContent: {
    gap: spacing.md,
  },
  sectionCard: {
    marginBottom: spacing.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  narrativeText: {
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
    lineHeight: typography.lineHeight.xs + 4,
    fontFamily: 'monospace',
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  conflictsBox: {
    marginTop: spacing.md,
    backgroundColor: colors.warningLight,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderColor: colors.warning,
    borderWidth: 1,
  },
  conflictsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  conflictsTitle: {
    fontSize: typography.fontSize.xs - 1,
    fontWeight: typography.fontWeight.bold,
    color: colors.warningText,
  },
  conflictText: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.textPrimary,
    marginTop: 2,
  },
  questionsIntroCard: {
    marginBottom: spacing.xs,
  },
  questionsIntroTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  questionsIntroDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight.xs,
    marginTop: 4,
  },
  questionCard: {
    marginBottom: spacing.xs,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  questionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textPrimary,
    lineHeight: typography.lineHeight.sm,
  },
  rationaleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: spacing.xs,
  },
  rationaleText: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: typography.lineHeight.xs - 2,
  },
  pathwayDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
    lineHeight: typography.lineHeight.xs,
    marginTop: spacing.xs,
  },
  facilitySection: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  subSectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  facilityCard: {
    marginBottom: spacing.xs,
  },
  facilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  facilityName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  facilityType: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.primary,
    marginTop: 2,
  },
  facilityCity: {
    fontSize: typography.fontSize.xs - 2,
    color: colors.textSecondary,
    marginTop: 2,
  },
  facilitySummary: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.textSecondary,
    marginTop: 4,
  },
  remedyDisclaimerCard: {
    marginBottom: spacing.xs,
    borderColor: 'rgba(10, 77, 82, 0.2)',
  },
  remedyDisclaimerTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  remedyDisclaimerText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight.xs + 2,
    marginTop: 4,
  },
  remedyCard: {
    marginBottom: spacing.sm,
  },
  remedyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  remedyTitleCol: {
    flex: 1,
    marginRight: spacing.xs,
  },
  remedyName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  remedyClassical: {
    fontSize: typography.fontSize.xs - 2,
    fontStyle: 'italic',
    color: colors.textSecondary,
    marginTop: 2,
  },
  remedyFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginVertical: 4,
  },
  remedyFieldLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
  },
  remedyFieldVal: {
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
  remedySectionBox: {
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.xs + 2,
    borderRadius: borderRadius.sm,
  },
  remedySubHeading: {
    fontSize: typography.fontSize.xs - 1,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
    marginBottom: 2,
  },
  remedyBodyText: {
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
    lineHeight: typography.lineHeight.xs + 2,
  },
  remedyWarningBox: {
    marginTop: spacing.xs,
    padding: spacing.xs,
    backgroundColor: colors.warningLight,
    borderRadius: borderRadius.sm,
  },
  remedyWarningTitle: {
    fontSize: typography.fontSize.xs - 1,
    fontWeight: typography.fontWeight.bold,
    color: colors.warningText,
    marginBottom: 2,
  },
  remedyWarningItem: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.textPrimary,
    marginTop: 1,
  },
  provenanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  provenanceText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },
  ayurNotice: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  dashavidhaList: {
    gap: spacing.sm,
  },
  dashavidhaCard: {
    marginBottom: spacing.xs,
  },
  paramHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  paramTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paramName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  paramSanskrit: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  paramDesc: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  notAssessedText: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  obsBox: {
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  obsHeading: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
    marginBottom: 2,
  },
  obsItem: {
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
    marginVertical: 1,
  },
  paramNote: {
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
    marginTop: 4,
  },
  structuredBox: {
    marginTop: spacing.xs,
    backgroundColor: 'rgba(10, 77, 82, 0.05)',
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  structuredLabel: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
    marginBottom: 2,
  },
  structuredVal: {
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
  },
  structuredItem: {
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
    marginVertical: 1,
  },
  limitationsBox: {
    marginTop: spacing.xs,
    padding: spacing.xs,
    backgroundColor: 'rgba(10, 77, 82, 0.05)',
    borderRadius: borderRadius.sm,
  },
  limitationText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  emptyCard: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: typography.lineHeight.xs + 2,
  },
  bottomActions: {
    marginTop: spacing.lg,
  },
  bottomBtn: {
    width: '100%',
  },
});
