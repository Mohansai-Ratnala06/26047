import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { ScreenContainer, Header, GlassCard, Card, Badge, Button } from '../../components';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useTranslation } from '../../i18n';
import {
  fetchRecommendedFacilities,
  RecommendedFacility,
} from '../../services/facility.service';

type ClinicalResultsRouteProp = RouteProp<RootStackParamList, 'ClinicalResults'>;

export const ClinicalResultsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ClinicalResultsRouteProp>();
  const { t } = useTranslation();
  const clinicalOutput = route.params?.clinicalOutput || {};

  const [activeTab, setActiveTab] = useState<'summary' | 'questions' | 'pathway' | 'remedies' | 'dashavidha'>('summary');
  const [showRawNarrative, setShowRawNarrative] = useState(false);

  // Facility discovery state in Care Pathway tab
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(false);
  const [facilityResults, setFacilityResults] = useState<RecommendedFacility[]>([]);
  const [facilitySearchLoc, setFacilitySearchLoc] = useState<string | null>(null);

  // Extract structured fields from clinicalOutput
  const safetyFindings = clinicalOutput.safety_findings || {};
  const isEmergency = Boolean(safetyFindings.immediate_attention_required);
  const redFlags: string[] = safetyFindings.red_flags || [];

  const riskAssessment = clinicalOutput.risk_assessment || {};
  const riskLevel: string = (riskAssessment.risk_level || 'LOW').toUpperCase();
  const riskScore: number | null =
    typeof riskAssessment.risk_score === 'number'
      ? riskAssessment.risk_score
      : typeof clinicalOutput.severity_score === 'number'
      ? clinicalOutput.severity_score
      : null;
  const riskSignals: string[] = riskAssessment.risk_signals || [];

  const careNav = clinicalOutput.care_navigation || {};
  const carePathway: string =
    careNav.care_pathway ||
    clinicalOutput.clinical_case?.care_pathway_status ||
    (riskLevel === 'URGENT' ? 'Emergency Care' : riskLevel === 'HIGH' ? 'Urgent Consultation' : 'Routine Consultation');
  const recommendedSpecialty: string =
    careNav.recommended_specialty ||
    clinicalOutput.pre_consultation_report?.recommendedSpecialty ||
    'General Medicine';

  const clinicalSummary = clinicalOutput.clinical_summary || {};
  const narrative: string = clinicalSummary.summary_narrative || '';
  const completeness: string = clinicalSummary.data_completeness || 'complete';
  const conflicts: string[] = clinicalSummary.conflicts_identified || [];
  const soap = clinicalSummary.soap || clinicalOutput.pre_consultation_report?.doctorSummarySOAP || {};

  // Structured HPI & Intake Elements (Dual-Fallback)
  const intakeSummary = clinicalOutput.intake_summary || {};
  const intakeSlots = clinicalOutput.intake_slots || {};
  const hpiSection = clinicalSummary.history_of_present_illness || {};
  const hpiStructured = hpiSection.structured_data || {};
  const ccSection = clinicalSummary.chief_complaint || {};
  const ccStructured = ccSection.structured_data || {};

  const chiefComplaint =
    ccStructured.chief_complaint ||
    intakeSummary.chief_complaint ||
    clinicalSummary.primary_concern ||
    clinicalOutput.pre_consultation_report?.chiefComplaint ||
    'Clinical Consultation';

  const severity =
    hpiStructured.severity ||
    intakeSummary.severity ||
    (intakeSlots.severity ? String(intakeSlots.severity) : null) ||
    (riskScore != null ? `${riskScore}/100` : null);

  const duration =
    hpiStructured.duration ||
    intakeSummary.duration ||
    intakeSlots.duration ||
    null;

  const location =
    hpiStructured.location ||
    intakeSummary.location ||
    intakeSlots.location ||
    null;

  const natureOfPain =
    hpiStructured.nature_of_pain ||
    intakeSummary.nature_of_pain ||
    intakeSlots.character ||
    null;

  const associatedSymptoms: string[] = Array.isArray(hpiStructured.associated_symptoms) && hpiStructured.associated_symptoms.length > 0
    ? hpiStructured.associated_symptoms
    : Array.isArray(intakeSummary.associated_symptoms) && intakeSummary.associated_symptoms.length > 0
    ? intakeSummary.associated_symptoms
    : Array.isArray(intakeSlots.associatedSymptoms)
    ? intakeSlots.associatedSymptoms
    : [];

  const pastMedicalConditions: string[] =
    clinicalSummary.past_medical_history?.structured_data?.medical_conditions || [];
  const pastSurgeries: string[] =
    clinicalSummary.past_surgical_history?.structured_data?.surgical_history || [];
  const medicationsList: any[] =
    clinicalSummary.medication_history?.structured_data?.medications || [];
  const allergiesList: string[] =
    clinicalSummary.allergy_history?.structured_data?.allergies || [];

  const consultationQuestionsObj = clinicalOutput.consultation_questions || {};
  const questions: any[] = consultationQuestionsObj.questions || [];

  // Phase 8B Ayurveda Recommendations & Tracked Adherence
  const ayurRec = clinicalOutput.ayurveda_recommendation || {};
  const recommendations: any[] = ayurRec.recommendations || [];
  const remediesTracked: any[] =
    ayurRec.remedies_tracked ||
    clinicalOutput.pre_consultation_report?.remediesTried ||
    [];
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

  const formatPathway = (pathway: string) => {
    return pathway
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatArticle = (word: string) => {
    const firstLetter = word.trim().charAt(0).toLowerCase();
    return ['a', 'e', 'i', 'o', 'u'].includes(firstLetter) ? 'an' : 'a';
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

  // Location-based hospital recommendation handler
  const handleLocateSpecializedHospitals = async () => {
    setIsLoadingFacilities(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      let coords: { latitude?: number; longitude?: number } = {};

      if (status === 'granted') {
        const locationData = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coords = {
          latitude: locationData.coords.latitude,
          longitude: locationData.coords.longitude,
        };
      }

      const result = await fetchRecommendedFacilities({
        latitude: coords.latitude,
        longitude: coords.longitude,
        chiefComplaint,
        recommendedSpecialty,
        severityScore: riskScore ?? undefined,
        isEmergency,
      });

      if (result && Array.isArray(result.matched_facilities)) {
        setFacilityResults(result.matched_facilities);
        setFacilitySearchLoc(result.search_location || null);
      }
    } catch (err: any) {
      console.warn('[ClinicalResults] Failed to fetch facilities:', err.message);
      Alert.alert(
        'Facility Search Notice',
        'Could not obtain precise GPS coordinates. Providing regional specialized healthcare centers for your condition.'
      );
      // Fallback call without coordinates
      try {
        const fallback = await fetchRecommendedFacilities({
          chiefComplaint,
          recommendedSpecialty,
          severityScore: riskScore ?? undefined,
          isEmergency,
        });
        if (fallback?.matched_facilities) {
          setFacilityResults(fallback.matched_facilities);
        }
      } catch (fallbackErr) {}
    } finally {
      setIsLoadingFacilities(false);
    }
  };

  // Share summary as text
  const handleShare = async () => {
    try {
      const shareContent = [
        'VAIDYAARC CLINICAL ASSESSMENT SUMMARY',
        '----------------------------------------',
        `Risk Level: ${riskLevel} ${riskScore !== null ? `(${riskScore}/100)` : ''}`,
        `Care Pathway: ${formatPathway(carePathway)} (${recommendedSpecialty})`,
        '',
        `PRIMARY COMPLAINT: ${chiefComplaint}`,
        soap.highlightedProblem ? `FOCAL ISSUE: ${soap.highlightedProblem}` : '',
        '',
        'CLINICAL SOAP SUMMARY:',
        `• Subjective: ${soap.subjective || narrative || 'Not documented'}`,
        `• Objective: ${soap.objective || 'Vitals stable'}`,
        `• Assessment: ${soap.assessment || 'Under evaluation'}`,
        `• Plan: ${soap.plan || 'Direct physician evaluation'}`,
        '',
        'QUESTIONS FOR PHYSICIAN:',
        ...questions.map((q: any, i: number) => `${i + 1}. [${q.priority || 'standard'}] ${q.question}`),
        '',
        ...(recommendations.length > 0
          ? [
              'SUPPORTIVE AYURVEDIC HOME CARE (STATUTORY & CLASSICAL TREATISES):',
              ...recommendations.map(
                (r: any) =>
                  `• ${r.name || r.remedy_name || r.classical_name || 'Home Remedy'}: ${r.preparation_summary || r.preparation_instructions || ''} (Source: ${
                    r.provenance?.document_title || 'Statutory / Classical Treatise'
                  })`
              ),
              '',
            ]
          : []),
        'Disclaimer: Physician-ready decision support summary. Not a direct medical prescription.',
      ].filter(Boolean).join('\n');

      await Share.share({
        message: shareContent,
        title: 'VaidyaArc Clinical Summary',
      });
    } catch (err) {
      console.warn('Share error:', err);
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
            <Text style={styles.metricLabel}>Recommended Pathway ({recommendedSpecialty})</Text>
          </View>
        </View>

        {riskSignals.length > 0 ? (
          <View style={styles.signalsBox}>
            <Text style={styles.signalsTitle}>Identified Clinical Signals:</Text>
            {riskSignals.map((sig, idx) => (
              <Text key={idx} style={styles.signalText}>• {formatPathway(sig)}</Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.nonDiagDisclaimer}>
          Assessment output for clinical guidance only — not a direct medical prescription.
        </Text>
      </GlassCard>

      {/* 3. Segmented Section Tabs (Flexbox Fixed Height - No Stretching) */}
      <View style={styles.tabContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
          style={styles.tabScroll}
        >
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
        </ScrollView>
      </View>

      {/* TAB 1: CLINICAL SUMMARY NARRATIVE & STRUCTURED CARDS */}
      {activeTab === 'summary' ? (
        <View style={styles.tabContent}>
          {/* Card 1: Primary Chief Complaint & Key Intake Metrics */}
          <Card variant="mintWash" style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconTagRow}>
                <Ionicons name="pulse-outline" size={20} color={colors.primary} />
                <Text style={styles.cardSectionTitle}>Primary Presenting Complaint</Text>
              </View>
              <Badge
                label={`Status: ${completeness}`}
                variant={completeness === 'complete' ? 'success' : 'neutral'}
                size="sm"
              />
            </View>

            <Text style={styles.chiefComplaintTitle}>{chiefComplaint}</Text>

            <View style={styles.pillRow}>
              {severity ? (
                <Badge
                  label={`Severity: ${severity.toUpperCase()}`}
                  variant={severity.toLowerCase().includes('severe') || severity.toLowerCase().includes('high') ? 'error' : severity.toLowerCase().includes('moderate') ? 'warning' : 'success'}
                  size="sm"
                />
              ) : null}
              {duration ? (
                <Badge
                  label={`Duration: ${duration}`}
                  variant="mint"
                  size="sm"
                />
              ) : null}
              {natureOfPain ? (
                <Badge
                  label={`Character: ${natureOfPain}`}
                  variant="neutral"
                  size="sm"
                />
              ) : null}
              {location ? (
                <Badge
                  label={`Location: ${location}`}
                  variant="neutral"
                  size="sm"
                />
              ) : null}
            </View>
          </Card>

          {/* Card 2: Highlighted Clinical Problem Callout */}
          {soap.highlightedProblem ? (
            <View style={styles.highlightProblemCard}>
              <View style={styles.highlightProblemHeader}>
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text style={styles.highlightProblemTag}>Focal Clinical Concern</Text>
              </View>
              <Text style={styles.highlightProblemText}>{soap.highlightedProblem}</Text>
              <Text style={styles.highlightProblemSub}>
                Synthesized from patient reported trajectory and active symptom presentation.
              </Text>
            </View>
          ) : null}

          {/* Card 3: History of Present Illness (HPI) Structured Breakdown */}
          <Card variant="default" style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconTagRow}>
                <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                <Text style={styles.cardSectionTitle}>History of Present Illness (HPI)</Text>
              </View>
            </View>

            <View style={styles.hpiTable}>
              <View style={styles.hpiRow}>
                <Text style={styles.hpiLabel}>Character / Quality</Text>
                <Text style={styles.hpiValue}>{natureOfPain || 'Reported as ongoing discomfort'}</Text>
              </View>
              <View style={styles.hpiRow}>
                <Text style={styles.hpiLabel}>Anatomical Location</Text>
                <Text style={styles.hpiValue}>{location || 'Localized to presenting region'}</Text>
              </View>
              <View style={styles.hpiRow}>
                <Text style={styles.hpiLabel}>Onset & Duration</Text>
                <Text style={styles.hpiValue}>{duration || 'Ongoing episode'}</Text>
              </View>
              <View style={styles.hpiRow}>
                <Text style={styles.hpiLabel}>Reported Severity</Text>
                <Text style={styles.hpiValue}>{severity ? (severity.charAt(0).toUpperCase() + severity.slice(1)) : 'Mild-to-Moderate'}</Text>
              </View>
              <View style={[styles.hpiRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.hpiLabel}>Associated Symptoms</Text>
                <Text style={styles.hpiValue}>
                  {associatedSymptoms.length > 0 ? associatedSymptoms.join(', ') : 'None documented'}
                </Text>
              </View>
            </View>
          </Card>

          {/* Card 4: Redesigned Physician SOAP Structured Breakdown */}
          <Card variant="default" style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconTagRow}>
                <Ionicons name="clipboard-outline" size={18} color={colors.primary} />
                <Text style={styles.cardSectionTitle}>Structured Physician Summary (SOAP)</Text>
              </View>
              <Badge label="Doctor Ready" variant="mint" size="sm" />
            </View>

            <View style={styles.soapContainer}>
              {/* S: Subjective */}
              <View style={[styles.soapSection, { borderLeftColor: colors.primary }]}>
                <View style={styles.soapSectionHeader}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
                  <Text style={styles.soapSectionTitle}>Subjective (Patient Narrative)</Text>
                </View>
                <Text style={styles.soapText}>
                  {soap.subjective || narrative || `Patient presents with ${chiefComplaint}, duration: ${duration || 'unspecified'}.`}
                </Text>
              </View>

              {/* O: Objective */}
              <View style={[styles.soapSection, { borderLeftColor: '#0284C7' }]}>
                <View style={styles.soapSectionHeader}>
                  <Ionicons name="pulse-outline" size={16} color="#0284C7" />
                  <Text style={styles.soapSectionTitle}>Objective Findings & Vitals</Text>
                </View>
                <Text style={styles.soapText}>
                  {soap.objective || `Clinical Severity Score: ${riskScore ?? 30}/100. Ambulatory status preserved.`}
                </Text>
              </View>

              {/* A: Assessment */}
              <View style={[styles.soapSection, { borderLeftColor: colors.warning }]}>
                <View style={styles.soapSectionHeader}>
                  <Ionicons name="analytics-outline" size={16} color={colors.warning} />
                  <Text style={styles.soapSectionTitle}>Clinical Assessment & Triage</Text>
                </View>
                <Text style={styles.soapText}>
                  {soap.assessment || (isEmergency ? 'Urgent triage requirement.' : 'Clinical evaluation indicated for symptom resolution.')}
                </Text>
              </View>

              {/* P: Plan */}
              <View style={[styles.soapSection, { borderLeftColor: colors.success }]}>
                <View style={styles.soapSectionHeader}>
                  <Ionicons name="medical-outline" size={16} color={colors.success} />
                  <Text style={styles.soapSectionTitle}>Recommended Action Plan</Text>
                </View>
                <Text style={styles.soapText}>
                  {soap.plan || `Direct consultation with a specialist in ${recommendedSpecialty}.`}
                </Text>
              </View>
            </View>

            {/* Collapsible raw narrative toggle */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowRawNarrative(!showRawNarrative)}
              style={styles.rawNarrativeToggle}
            >
              <Text style={styles.rawNarrativeToggleText}>
                {showRawNarrative ? 'Hide Full Text Transcript' : 'View Full Text Summary'}
              </Text>
              <Ionicons
                name={showRawNarrative ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={16}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {showRawNarrative && narrative ? (
              <View style={styles.narrativeContainer}>
                <Text style={styles.narrativeCleanText}>{narrative}</Text>
              </View>
            ) : null}

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

          {/* Card 5: Baseline Patient Profile */}
          <Card variant="subtle" style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconTagRow}>
                <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.cardSectionTitle}>Baseline Medical Profile</Text>
              </View>
            </View>

            <View style={styles.historyList}>
              <View style={styles.historyItem}>
                <Text style={styles.historyItemLabel}>Chronic Conditions:</Text>
                <Text style={styles.historyItemVal}>
                  {pastMedicalConditions.length > 0 ? pastMedicalConditions.join(', ') : 'None documented'}
                </Text>
              </View>
              <View style={styles.historyItem}>
                <Text style={styles.historyItemLabel}>Surgical History:</Text>
                <Text style={styles.historyItemVal}>
                  {pastSurgeries.length > 0 ? pastSurgeries.join(', ') : 'None documented'}
                </Text>
              </View>
              <View style={styles.historyItem}>
                <Text style={styles.historyItemLabel}>Current Medications:</Text>
                <Text style={styles.historyItemVal}>
                  {medicationsList.length > 0
                    ? (typeof medicationsList[0] === 'string' ? medicationsList.join(', ') : medicationsList.map((m: any) => m.name || m).join(', '))
                    : 'None documented'}
                </Text>
              </View>
              <View style={styles.historyItem}>
                <Text style={styles.historyItemLabel}>Allergies:</Text>
                <Text style={styles.historyItemVal}>
                  {allergiesList.length > 0 ? allergiesList.join(', ') : 'No known drug allergies reported'}
                </Text>
              </View>
            </View>
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
              Tailored clinical questions synthesized from your reported symptoms to lead an informed discussion with your healthcare provider.
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

      {/* TAB 3: CARE PATHWAY & SPECIALIZED HOSPITAL DISCOVERY */}
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
                `Based on clinical intake and risk stratification, ${formatArticle(carePathway)} ${formatPathway(carePathway)} with a specialist in ${recommendedSpecialty} is recommended.`}
            </Text>
          </Card>

          {/* Interactive Specialization-First Hospital Discovery Section */}
          <Card variant="mintWash" style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconTagRow}>
                <Ionicons name="business-outline" size={18} color={colors.primaryDark} />
                <Text style={styles.cardSectionTitle}>Specialized Hospitals For My Issue</Text>
              </View>
              <Badge label={`Focus: ${recommendedSpecialty}`} variant="mint" size="sm" />
            </View>

            <Text style={styles.hospitalToolDesc}>
              Locate verified hospitals equipped with specialized {recommendedSpecialty} facilities, diagnostic units, and emergency services prioritized for your condition.
            </Text>

            <Button
              title={isLoadingFacilities ? "Finding Specialized Hospitals..." : "Find Specialized Hospitals Near Me"}
              variant="primary"
              onPress={handleLocateSpecializedHospitals}
              disabled={isLoadingFacilities}
              icon={<Ionicons name="locate-outline" size={18} color="#FFFFFF" />}
              style={styles.locateBtn}
            />

            {isLoadingFacilities ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Analyzing regional healthcare centers specializing in {recommendedSpecialty}...</Text>
              </View>
            ) : null}
          </Card>

          {/* Matched Hospitals List */}
          {facilityResults.length > 0 ? (
            <View style={styles.facilitySection}>
              <Text style={styles.subSectionTitle}>
                Recommended Specialized Centers {facilitySearchLoc ? `(${facilitySearchLoc})` : ''}
              </Text>
              {facilityResults.map((fac: RecommendedFacility, idx: number) => (
                <Card key={idx} variant="default" style={styles.facilityCard}>
                  <View style={styles.facilityHeader}>
                    <View style={{ flex: 1, marginRight: spacing.xs }}>
                      <Text style={styles.facilityName}>{fac.facility_name}</Text>
                      <Text style={styles.facilityType}>{fac.facility_type}</Text>
                    </View>
                    <Badge
                      label={fac.tier}
                      variant="mint"
                      size="sm"
                    />
                  </View>

                  <View style={styles.specialtyMatchBox}>
                    <Ionicons name="medkit-outline" size={14} color={colors.primaryDark} />
                    <Text style={styles.specialtyMatchText}>
                      <Text style={{ fontWeight: 'bold' }}>Specialized Department:</Text> {fac.matched_specialty}
                    </Text>
                  </View>

                  {fac.match_rationale ? (
                    <Text style={styles.matchRationaleText}>{fac.match_rationale}</Text>
                  ) : null}

                  <View style={styles.facilityMetaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                      <Text style={styles.metaText}>{fac.address} {fac.distance_km ? `(${fac.distance_km})` : ''}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
                      <Text style={styles.metaText}>{fac.timings}</Text>
                    </View>
                  </View>

                  <View style={styles.facilityActionsRow}>
                    {fac.contact_phone ? (
                      <TouchableOpacity
                        style={styles.facilityActionBtn}
                        onPress={() => Linking.openURL(`tel:${fac.contact_phone.replace(/[^0-9+]/g, '')}`)}
                      >
                        <Ionicons name="call-outline" size={15} color={colors.primary} />
                        <Text style={styles.facilityActionText}>Call Hospital</Text>
                      </TouchableOpacity>
                    ) : null}

                    {fac.maps_url ? (
                      <TouchableOpacity
                        style={[styles.facilityActionBtn, styles.facilityMapBtn]}
                        onPress={() => Linking.openURL(fac.maps_url)}
                      >
                        <Ionicons name="map-outline" size={15} color="#FFFFFF" />
                        <Text style={[styles.facilityActionText, { color: '#FFFFFF' }]}>View on Map</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>
          ) : !isLoadingFacilities ? (
            <Card variant="outlined" style={styles.emptyCard}>
              <Text style={styles.emptyText}>Tap "Find Specialized Hospitals Near Me" above to get verified facilities equipped for your condition.</Text>
            </Card>
          ) : null}
        </View>
      ) : null}

      {/* TAB 4: AYURVEDA SUPPORTIVE HOME CARE & REMEDIES TAKEN */}
      {activeTab === 'remedies' ? (
        <View style={styles.tabContent}>
          {/* Section 4A: Remedies Taken & Patient Outcomes (if any) */}
          {remediesTracked.length > 0 ? (
            <Card variant="default" style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.iconTagRow}>
                  <Ionicons name="checkmark-done-circle" size={20} color={colors.success} />
                  <Text style={styles.cardSectionTitle}>Remedies Followed by Patient</Text>
                </View>
                <Badge label="Follow-up Tracking" variant="mint" size="sm" />
              </View>

              {remediesTracked.map((item: any, rIdx: number) => {
                const name = typeof item === 'string' ? item : item.remedyName || item.remedy;
                const status = typeof item === 'object' ? item.status : 'taken';
                const relief = typeof item === 'object' ? item.reliefReported : null;
                const feedback = typeof item === 'object' ? item.patientFeedback : null;

                return (
                  <View key={rIdx} style={styles.trackedRemedyBox}>
                    <View style={styles.trackedRemedyHeader}>
                      <Text style={styles.trackedRemedyName}>{name}</Text>
                      {relief ? (
                        <Badge
                          label={relief.replace(/_/g, ' ').toUpperCase()}
                          variant={relief === 'significant_relief' || relief === 'partial_relief' ? 'success' : relief === 'worsened' ? 'error' : 'neutral'}
                          size="sm"
                        />
                      ) : (
                        <Badge label="TAKEN" variant="success" size="sm" />
                      )}
                    </View>
                    {feedback ? (
                      <Text style={styles.trackedRemedyFeedback}>Patient feedback: "{feedback}"</Text>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          ) : null}

          {/* Section 4B: Approved Classical & Statutory Supportive Care */}
          <Card variant="mintWash" style={styles.remedyDisclaimerCard}>
            <View style={styles.iconTagRow}>
              <Ionicons name="shield-checkmark" size={18} color={colors.primaryDark} />
              <Text style={styles.remedyDisclaimerTitle}>Approved Classical & Statutory Supportive Care</Text>
            </View>
            <Text style={styles.remedyDisclaimerText}>
              Traditional supportive care reference grounded strictly in verified statutory repositories and classical treatises (CCRAS, API Part II, Charaka Saṃhitā, Suśruta Saṃhitā, Aṣṭāṅga Hṛdaya, Sahasrayogam). Not a medical prescription. If symptoms persist or worsen, direct physician consultation is required.
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
                        <Text style={styles.remedyClassical}>Classical formulation: {rec.classical_name}</Text>
                      ) : null}
                    </View>
                    <Badge
                      label={
                        rec.remedy_type === 'classical_treatise_formulation'
                          ? 'Classical Treatise'
                          : rec.remedy_type === 'statutory_monograph'
                          ? 'Statutory Monograph'
                          : rec.remedy_type
                          ? rec.remedy_type.replace(/_/g, ' ')
                          : 'Home Care'
                      }
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
                        Verified Source: {prov.document_title}
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
              <Text style={styles.emptyTitle}>No Self-Administered Home Remedies Recommended</Text>
              <Text style={styles.emptyText}>
                {recSummary ||
                  (blockedReasons.length > 0
                    ? blockedReasons.join(' ')
                    : 'Clinical safety protocols recommend direct physician examination without self-administered home therapies for this presentation.')}
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
              Classical 10-parameter Ayurvedic clinical assessment. Conversational indicators and baseline profile metrics are dynamically extracted; anatomical parameters requiring in-person palpation remain strictly identified.
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

                    {/* Structured Findings */}
                    {param.key === 'vaya' && structFindings?.classical_life_stage ? (
                      <View style={styles.structuredBox}>
                        <Text style={styles.structuredLabel}>Classical Life Stage (Charaka Vimāna 8/122):</Text>
                        <Text style={styles.structuredVal}>{structFindings.classical_life_stage}</Text>
                      </View>
                    ) : null}

                    {param.key === 'pramana' && structFindings?.modern_measurements ? (
                      <View style={styles.structuredBox}>
                        <Text style={styles.structuredLabel}>Objective Clinical Measurements:</Text>
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
                            <Text style={styles.structuredLabel}>Documented Allergies/Tolerances:</Text>
                            <Text style={styles.structuredVal}>{structFindings.reported_allergies.join(', ')}</Text>
                          </View>
                        ) : null}
                      </>
                    ) : null}

                    {/* Descriptive Observations */}
                    {observations.length > 0 ? (
                      <View style={styles.obsBox}>
                        <Text style={styles.obsHeading}>Extracted Clinical Observations:</Text>
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

                    {/* Limitations */}
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
    marginVertical: 1,
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
  tabContainer: {
    marginBottom: spacing.md,
  },
  tabScroll: {
    flexGrow: 0,
    maxHeight: 46,
  },
  tabScrollContent: {
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.sm,
    padding: 3,
    alignItems: 'center',
    height: 42,
  },
  tabBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm - 2,
    height: 36,
    marginRight: 4,
    backgroundColor: colors.surfaceSubtle,
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
  chiefComplaintTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
    marginVertical: spacing.xs,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  highlightProblemCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1.5,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  highlightProblemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  highlightProblemTag: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.error,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  highlightProblemText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    lineHeight: typography.lineHeight.sm,
  },
  highlightProblemSub: {
    fontSize: typography.fontSize.xs - 2,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  hpiTable: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  hpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(10, 77, 82, 0.08)',
  },
  hpiLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
    flex: 1,
  },
  hpiValue: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
    flex: 1.5,
    textAlign: 'right',
  },
  soapContainer: {
    gap: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  soapSection: {
    backgroundColor: colors.surfaceSubtle,
    borderLeftWidth: 4,
    borderRadius: borderRadius.sm - 2,
    padding: spacing.xs + 3,
  },
  soapSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  soapSectionTitle: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  soapText: {
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
    lineHeight: typography.lineHeight.xs + 3,
  },
  rawNarrativeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  rawNarrativeToggleText: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.semiBold,
  },
  narrativeContainer: {
    marginTop: spacing.xs,
  },
  narrativeCleanText: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.textPrimary,
    lineHeight: typography.lineHeight.xs + 4,
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
  historyList: {
    gap: spacing.xs,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  historyItemLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  historyItemVal: {
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semiBold,
    maxWidth: '60%',
    textAlign: 'right',
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
    lineHeight: typography.lineHeight.xs + 2,
    marginTop: spacing.xs,
  },
  hospitalToolDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight.xs + 1,
    marginBottom: spacing.sm,
  },
  locateBtn: {
    marginTop: spacing.xs,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
    padding: spacing.xs,
  },
  loadingText: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.primary,
    flex: 1,
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
    marginBottom: spacing.xs,
  },
  facilityCard: {
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(10, 77, 82, 0.12)',
  },
  facilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  specialtyMatchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 77, 82, 0.06)',
    padding: spacing.xs,
    borderRadius: borderRadius.sm - 2,
    marginTop: spacing.xs,
  },
  specialtyMatchText: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.primaryDark,
    flex: 1,
  },
  matchRationaleText: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight.xs,
    marginTop: spacing.xs,
  },
  facilityMetaRow: {
    gap: 3,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: typography.fontSize.xs - 2,
    color: colors.textSecondary,
    flex: 1,
  },
  facilityActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
  },
  facilityActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  facilityMapBtn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  facilityActionText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  trackedRemedyBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.sm,
    padding: spacing.xs + 3,
    marginBottom: spacing.xs,
  },
  trackedRemedyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackedRemedyName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  trackedRemedyFeedback: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.textSecondary,
    fontStyle: 'italic',
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
